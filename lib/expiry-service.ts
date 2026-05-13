import { prisma } from "./prisma";
import { releaseReservation } from "./reservation-service";
import getRedis from './redis';

export async function expireStaleReservations() {
  const redis = getRedis()

  // If Redis is configured, prefer it for fast lookup of expired reservation ids.
  if (redis) {
    try {
      const now = Date.now()
      const rawExpiredIds = await redis.zrange('reservations', 0, now, { byScore: true })
      const expiredIds = rawExpiredIds.filter((id): id is string => typeof id === 'string')
      if (!expiredIds || expiredIds.length === 0) return { released: 0, failed: 0 }

      const results = await Promise.allSettled(
        expiredIds.map((id: string) => releaseReservation(id)),
      )

      const failed = results.filter((r) => r.status === 'rejected').length
      if (failed) console.error(`[EXPIRY] ${failed} reservation failed to release`)

      // remove processed ids from redis (best-effort)
      try { await redis.zrem('reservations', ...expiredIds) } catch {}

      return { released: expiredIds.length - failed, failed }
    } catch (err) {
      console.error('[EXPIRY] redis expiry check failed, falling back to db', err)
    }
  }

  // fallback to DB scan if Redis not available or failed
  const expired = await prisma.reservation.findMany({
    where: { status: "PENDING", expiresAt: { lt: new Date() } },
    select: { id: true },
  });

  const results = await Promise.allSettled(
    expired.map((r) => releaseReservation(r.id)),
  );

  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed) console.error(`[EXPIRY] ${failed} reservation failed to release`);

  return {released: expired.length - failed, failed}
}
