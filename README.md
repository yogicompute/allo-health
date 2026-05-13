# allo-health

Inventory reservation demo built with Next.js + Prisma + Postgres, including reservation expiry and Upstash Redis acceleration.

## Tech stack

- Next.js (App Router)
- React
- Prisma + PostgreSQL
- Upstash Redis (optional but recommended for expiry scans)

## Local setup

### 1) Prerequisites

- Node.js 20+
- Postgres instance
- Upstash Redis database (optional for local, required to match production behavior)

### 2) Environment variables

Create `.env` in project root:

```env
# Postgres used by app runtime
DATABASE_URL="postgres://user:password@localhost:5432/allo_health"

# Postgres used by Prisma migrations/CLI
DIRECT_URL="postgres://user:password@localhost:5432/allo_health"

# Reservation hold duration (10 min default)
RESERVATION_TTL_MS="600000"

# Protects cron endpoint
CRON_SECRET="replace-with-a-strong-secret"

# Upstash Redis (optional locally, recommended)
UPSTASH_REDIS_REST_URL="https://<your-upstash-endpoint>"
UPSTASH_REDIS_REST_TOKEN="<your-upstash-token>"
```

Notes:
- If Redis vars are missing, app still runs. Expiry falls back to DB scanning.
- `DATABASE_URL` and `DIRECT_URL` can point to the same database in local dev.

### 3) Install dependencies

```bash
npm install
```

### 4) Run migrations

```bash
npx prisma migrate dev
```

### 5) Seed data

```bash
npm run db:seed
```

### 6) Start app

```bash
npm run dev
```

Open http://localhost:3000

## User flow summary

User browses products, selects warehouse + quantity, creates a reservation (`PENDING`), and is redirected to reservation checkout page. User can confirm purchase before expiry (`CONFIRMED`) or cancel (`RELEASED`). If user does nothing, reservation expires and stock is released.

## App flow chart

```mermaid
flowchart TD
		A[User opens Products page] --> B[View product availability]
		B --> C[POST /api/reservations]
		C --> D{Stock available?}
		D -->|No| E[Return 409 insufficient stock]
		D -->|Yes| F[Create PENDING reservation in DB]
		F --> G[Track reservation in Redis ZSET]
		G --> H[Redirect to /reservations/:id]

		H --> I{User action}
		I -->|Confirm| J[POST /api/reservations/:id/confirm]
		I -->|Cancel| K[POST /api/reservations/:id/release]
		I -->|No action| L[Time passes]

		J --> M{Still PENDING and not expired?}
		M -->|Yes| N[Decrement totalUnits and reservedUnits]
		N --> O[Mark reservation CONFIRMED]
		O --> P[Remove id from Redis ZSET]
		M -->|No| Q[Return error 410/400]

		K --> R[Decrement reservedUnits]
		R --> S[Mark reservation RELEASED]
		S --> T[Remove id from Redis ZSET]

		L --> U[Cron GET /api/cron/expire-reservations]
		U --> V{Redis configured?}
		V -->|Yes| W[Fetch expired ids from ZSET by score]
		V -->|No| X[Find expired PENDING rows in DB]
		W --> Y[releaseReservation(id) for each]
		X --> Y
		Y --> Z[Return released/failed counts]
```

## Expiry mechanism in production

Expiry is implemented with a layered strategy:

1. Active expiry via cron endpoint
	 - Route: `GET /api/cron/expire-reservations`
	 - Requires header: `Authorization: Bearer <CRON_SECRET>`
	 - Scheduler (Vercel Cron, external cron, or worker) calls it on an interval (for example every minute).

2. Redis-accelerated expiry lookup
	 - On reservation create, reservation id is added to Redis sorted set `reservations` with score = `expiresAt` timestamp.
	 - Cron reads expired ids by score and releases them.
	 - On confirm/release, id is removed from Redis.

3. Safe fallback
	 - If Redis is not configured or fails, cron falls back to DB query (`PENDING` + `expiresAt < now`) and releases those reservations.

4. Lazy expiry safeguard
	 - When fetching reservation details, if a reservation is still `PENDING` but already expired, app releases it immediately.
	 - This ensures correctness even if cron is delayed.

## Routes and how they work

### UI routes

- `GET /`
	- Renders products and stock availability.
	- Data source: Postgres via Prisma.

- `GET /reservations/:id`
	- Shows reservation checkout state and countdown.
	- Performs lazy expiry check for expired `PENDING` reservations.

### API routes

- `GET /api/products`
	- Returns products + stock + computed `availableUnits`.

- `GET /api/warehouses`
	- Returns warehouses ordered by name.

- `POST /api/reservations`
	- Body: `{ productId, warehouseId, quantity }`
	- Validates input, atomically reserves stock, creates `PENDING` reservation with TTL.
	- Redis: adds reservation id to expiry ZSET (best effort).

- `GET /api/reservations/:id`
	- Returns reservation by id.
	- If expired and still `PENDING`, releases it first (lazy expiry).

- `POST /api/reservations/:id/confirm`
	- Confirms reservation if valid and not expired.
	- Stock update: decrements both `totalUnits` and `reservedUnits`.
	- Redis: removes reservation id from ZSET.

- `POST /api/reservations/:id/release`
	- Releases reservation hold.
	- Stock update: decrements `reservedUnits`.
	- Redis: removes reservation id from ZSET.

- `GET /api/cron/expire-reservations`
	- Protected by `CRON_SECRET` bearer token.
	- Expires stale reservations in batch using Redis first, DB fallback second.
	- Returns `{ ok, released, failed }`.

### Error handling behavior

Standard API mapping via shared error handler:

- `409` insufficient stock
- `410` reservation expired
- `404` reservation not found
- `400` invalid reservation status
- `500` internal server error

## Trade-offs and what I'd improve with more time

Trade-offs made:

- Best-effort Redis updates
	- Redis write/remove failures do not fail main DB transaction.
	- Pro: checkout remains reliable even if Redis is transiently down.
	- Con: Redis index can become temporarily stale.

- Dual expiry strategy (cron + lazy)
	- Pro: correctness preserved even with scheduler delay.
	- Con: some expiry work is deferred to read-time.

- DB as source of truth
	- Pro: consistency and durability remain in Postgres.
	- Con: cron fallback can be heavier than pure queue-driven expiry.

With more time, I would:

- Add distributed lock around cron execution to avoid overlap under retries/concurrency.
- Add idempotency handling for reservation create/confirm/release endpoints.
- Add request tracing/metrics around expiry success/fail counts and Redis fallback rate.
- Add integration tests for race conditions and expiry edge cases.
- Add periodic cleanup for old idempotency keys and historical reservations.

## Useful commands

```bash
# run
npm run dev

# Build
npm run build

# Re-seed local database
npm run db:seed
```
