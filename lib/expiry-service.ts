import { prisma } from "./prisma";
import { releaseReservation } from "./reservation-service";

export async function expireStaleReservations() {
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
