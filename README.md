# allo-health

Inventory reservation system built with Next.js, Prisma, PostgreSQL, and Redis.  
Supports real-time stock reservation, automatic expiry handling, reservation confirmation, and fail-safe stock recovery.

Designed with production-style backend patterns:
- atomic reservation handling
- expiry-safe workflows
- Redis accelerated scans
- DB fallback reliability
- lazy expiry recovery

---

# Overview

This project demonstrates how e-commerce or healthcare inventory systems can safely reserve stock for users during checkout.

Instead of immediately deducting inventory, the system creates a temporary reservation (`PENDING`) with a TTL (time-to-live). Users can:
- confirm purchase
- cancel reservation
- or let it expire automatically

Expired reservations automatically release inventory back into stock.

---

# Tech Stack

## Frontend
- Next.js (App Router)
- React
- Tailwind CSS

## Backend
- Next.js API Routes
- Prisma ORM
- PostgreSQL

## Infrastructure
- Upstash Redis
- Cron-based expiry worker

---

# Key Features

- Inventory reservation with expiry
- Atomic stock locking
- Reservation confirmation flow
- Reservation cancellation flow
- Automatic stock recovery
- Redis accelerated expiry lookup
- Database fallback mechanism
- Lazy expiry protection
- Production-oriented error handling

---

# Reservation Lifecycle

```text
PENDING
   │
   ├── CONFIRMED
   │
   ├── RELEASED
   │
   └── EXPIRED → RELEASED
```

---

# System Flow

```mermaid
flowchart TD

    %% =========================
    %% USER RESERVATION FLOW
    %% =========================

    A([User Opens App]) --> B[Browse Products]
    B --> C[Select Warehouse & Quantity]
    C --> D[Create Reservation Request]

    D --> E{Stock Available?}

    E -->|No| F[[409 Insufficient Stock]]

    E -->|Yes| G[Create PENDING Reservation]
    G --> H[Increase reservedUnits]
    H --> I[Store Expiry in Redis ZSET]
    I --> J[Redirect to Checkout Page]

    %% =========================
    %% USER ACTIONS
    %% =========================

    J --> K{User Action}

    K -->|Confirm Purchase| L[Confirm Reservation API]
    K -->|Cancel Reservation| M[Release Reservation API]
    K -->|No Action| N[Wait Until Expiry]

    %% =========================
    %% CONFIRM FLOW
    %% =========================

    L --> O{Reservation Still Valid?}

    O -->|No| P[[410 Reservation Expired]]

    O -->|Yes| Q[Decrease totalUnits]
    Q --> R[Decrease reservedUnits]
    R --> S[Mark Reservation CONFIRMED]
    S --> T[Remove Reservation from Redis]
    T --> U([Purchase Completed])

    %% =========================
    %% MANUAL RELEASE FLOW
    %% =========================

    M --> V[Decrease reservedUnits]
    V --> W[Mark Reservation RELEASED]
    W --> X[Remove Reservation from Redis]
    X --> Y([Reservation Cancelled])

    %% =========================
    %% EXPIRY / CRON FLOW
    %% =========================

    N --> Z[Cron Job Runs]

    Z --> AA{Redis Available?}

    AA -->|Yes| AB[Fetch Expired IDs from Redis]
    AA -->|No| AC[Query Expired PENDING Rows from DB]

    AB --> AD[Release Expired Reservations]
    AC --> AD

    AD --> AE[Decrease reservedUnits]
    AE --> AF[Mark Reservation RELEASED]
    AF --> AG[Cleanup Redis Entries]

    AG --> AH([Expiry Process Complete])
```

---

# Local Setup

## 1. Clone Repository

```bash
git clone <your-repo-url>
cd allo-health
```

---

## 2. Install Dependencies

```bash
npm install
```

---

## 3. Configure Environment Variables

Create a `.env` file:

```env
# PostgreSQL
DATABASE_URL="postgres://user:password@localhost:5432/allo_health"

# Prisma CLI
DIRECT_URL="postgres://user:password@localhost:5432/allo_health"

# Reservation expiry duration
RESERVATION_TTL_MS="600000"

# Protects cron endpoint
CRON_SECRET="your-secret"

# Redis
UPSTASH_REDIS_REST_URL="https://your-upstash-url"
UPSTASH_REDIS_REST_TOKEN="your-upstash-token"
```

---

## 4. Run Database Migration

```bash
npx prisma migrate dev
```

---

## 5. Seed Database

```bash
npm run db:seed
```

---

## 6. Start Development Server

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

---

# How Reservation Expiry Works

This project uses a layered expiry strategy for reliability.

## 1. Redis Expiry Index

Every reservation is added to a Redis Sorted Set:

```text
key: reservations
score: expiresAt timestamp
value: reservationId
```

This allows extremely fast lookup of expired reservations.

---

## 2. Cron-based Cleanup

A cron endpoint runs periodically:

```text
GET /api/cron/expire-reservations
```

The worker:
- fetches expired reservation IDs
- releases stock
- updates DB state
- removes Redis entries

---

## 3. Database Fallback

If Redis fails or is unavailable:
- the system scans PostgreSQL directly
- expired reservations are still released safely

This makes PostgreSQL the ultimate source of truth.

---

## 4. Lazy Expiry Protection

Even if cron is delayed:
- opening a reservation page checks expiry
- expired reservations are instantly released

This prevents stale reservations from blocking inventory.

---

# API Routes

## Products

### `GET /api/products`

Returns:
- products
- stock
- available inventory

---

## Warehouses

### `GET /api/warehouses`

Returns all warehouses.

---

## Create Reservation

### `POST /api/reservations`

Request:

```json
{
  "productId": "1",
  "warehouseId": "2",
  "quantity": 3
}
```

Behavior:
- validates stock
- creates `PENDING` reservation
- increases `reservedUnits`
- stores expiry in Redis

---

## Fetch Reservation

### `GET /api/reservations/:id`

Returns reservation details.

Also performs lazy expiry check.

---

## Confirm Reservation

### `POST /api/reservations/:id/confirm`

Behavior:
- validates reservation
- deducts inventory
- marks reservation `CONFIRMED`
- removes Redis tracking

---

## Release Reservation

### `POST /api/reservations/:id/release`

Behavior:
- releases reserved stock
- marks reservation `RELEASED`
- removes Redis entry

---

## Expiry Worker

### `GET /api/cron/expire-reservations`

Protected using:

```text
Authorization: Bearer <CRON_SECRET>
```

Behavior:
- finds expired reservations
- releases inventory
- returns cleanup statistics

---

# Error Handling

| Status Code | Meaning |
|---|---|
| 400 | Invalid reservation state |
| 404 | Reservation not found |
| 409 | Insufficient stock |
| 410 | Reservation expired |
| 500 | Internal server error |

---

# Design Decisions

## PostgreSQL as Source of Truth

Redis is treated as an optimization layer.

Why:
- durability
- consistency
- crash safety

---

## Best-effort Redis Writes

Redis failures do not fail checkout.

Why:
- reservation integrity matters more than cache consistency

Tradeoff:
- temporary Redis staleness possible

---

## Dual Expiry Protection

Using:
- cron cleanup
- lazy expiry

Why:
- guarantees eventual consistency

---

# Scalability Improvements

With more time, I would add:

- distributed locking for cron workers
- idempotency keys
- retry-safe reservation APIs
- observability + metrics
- queue-based expiry workers
- integration tests for race conditions
- reservation analytics dashboard

---

# Useful Commands

## Run Development Server

```bash
npm run dev
```

## Build Project

```bash
npm run build
```

## Seed Database

```bash
npm run db:seed
```

---

# Production Notes

Recommended production setup:

- Vercel / Docker deployment
- Managed PostgreSQL
- Upstash Redis
- Scheduled cron execution every minute
- Monitoring + tracing

---

# Why This Architecture?

This architecture is designed to solve a real production problem:

> Prevent overselling inventory while still allowing smooth checkout experiences.

The system prioritizes:
- consistency
- fault tolerance
- recovery safety
- operational simplicity

Basically:
your stock system should not explode because someone refreshed checkout 17 times like a speedrunner possessed by chaos. 💀

