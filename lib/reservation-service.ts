import {
  InsufficientStockError,
  InvalidStatusError,
  ReservationExpiredError,
  ReservationNotFoundError,
} from "./errors";

import { prisma } from "./prisma";
import getRedis from "./redis";

const TTL_MS = parseInt(process.env.RESERVATION_TTL_MS ?? "600000", 10);

// ======================================================
// CREATE RESERVATION
// ======================================================

export async function createReservation(
  productId: string,
  warehouseId: string,
  quantity: number,
) {
  console.log("[CREATE] starting reservation", {
    productId,
    warehouseId,
    quantity,
  });

  try {
    const reservation = await prisma.$transaction(
      async (tx) => {
        console.log("[CREATE] attempting atomic stock reservation");

        const affectedRows = await tx.$executeRaw`
          UPDATE "Stock"
          SET "reservedUnits" = "reservedUnits" + ${quantity}
          WHERE "productId" = ${productId}
          AND "warehouseId" = ${warehouseId}
          AND ("totalUnits" - "reservedUnits") >= ${quantity}
        `;

        console.log("[CREATE] affected rows:", affectedRows);

        if (affectedRows === 0) {
          console.log("[CREATE] insufficient stock");
          throw new InsufficientStockError();
        }

        console.log("[CREATE] creating reservation row");

        const reservation = await tx.reservation.create({
          data: {
            productId,
            warehouseId,
            quantity,
            status: "PENDING",
            expiresAt: new Date(Date.now() + TTL_MS),
          },
        });

        console.log("[CREATE] reservation created:", reservation.id);

        return reservation;
      },
      {
        timeout: 10000, // 10s transaction timeout
      },
    );

    // ------------------------------------------
    // REDIS TRACKING (best effort)
    // ------------------------------------------

    try {
      console.log("[REDIS] tracking reservation");

      await trackReservationInRedis(
        reservation.id,
        reservation.expiresAt,
      );

      console.log("[REDIS] tracked reservation");
    } catch (err) {
      console.error("[REDIS] tracking failed", err);
    }

    console.log("[CREATE] completed");

    return reservation;
  } catch (err) {
    console.error("[CREATE] FAILED", err);
    throw err;
  }
}

// ======================================================
// CONFIRM RESERVATION
// ======================================================

export async function confirmReservation(id: string) {
  console.log("[CONFIRM] starting", id);

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const reservation = await tx.reservation.findUnique({
          where: { id },
        });

        console.log("[CONFIRM] reservation lookup:", reservation?.id);

        if (!reservation) {
          throw new ReservationNotFoundError();
        }

        if (reservation.status !== "PENDING") {
          throw new InvalidStatusError(
            "Reservation is not pending",
          );
        }

        if (reservation.expiresAt < new Date()) {
          throw new ReservationExpiredError();
        }

        console.log("[CONFIRM] decrementing stock");

        await tx.stock.update({
          where: {
            productId_warehouseId: {
              productId: reservation.productId,
              warehouseId: reservation.warehouseId,
            },
          },
          data: {
            totalUnits: {
              decrement: reservation.quantity,
            },
            reservedUnits: {
              decrement: reservation.quantity,
            },
          },
        });

        console.log("[CONFIRM] updating reservation");

        return tx.reservation.update({
          where: { id },
          data: {
            status: "CONFIRMED",
            confirmedAt: new Date(),
          },
          include: {
            product: true,
            warehouse: true,
          },
        });
      },
      {
        timeout: 10000,
      },
    );

    // ------------------------------------------
    // REDIS CLEANUP
    // ------------------------------------------

    try {
      const redis = getRedis();

      if (redis) {
        console.log("[REDIS] removing confirmed reservation");

        await redis.zrem("reservations", id);
      }
    } catch (err) {
      console.error("[REDIS] zrem failed", err);
    }

    console.log("[CONFIRM] completed");

    return result;
  } catch (err) {
    console.error("[CONFIRM] FAILED", err);
    throw err;
  }
}

// ======================================================
// RELEASE RESERVATION
// ======================================================

export async function releaseReservation(id: string) {
  console.log("[RELEASE] starting", id);

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const reservation = await tx.reservation.findUnique({
          where: { id },
        });

        console.log("[RELEASE] reservation lookup:", reservation?.id);

        if (!reservation) {
          throw new ReservationNotFoundError();
        }

        if (reservation.status === "CONFIRMED") {
          throw new InvalidStatusError(
            "Cannot release confirmed reservation",
          );
        }

        if (reservation.status === "RELEASED") {
          console.log("[RELEASE] already released");
          return reservation;
        }

        console.log("[RELEASE] decrementing reserved stock");

        await tx.stock.update({
          where: {
            productId_warehouseId: {
              productId: reservation.productId,
              warehouseId: reservation.warehouseId,
            },
          },
          data: {
            reservedUnits: {
              decrement: reservation.quantity,
            },
          },
        });

        console.log("[RELEASE] updating reservation");

        return tx.reservation.update({
          where: { id },
          data: {
            status: "RELEASED",
            releasedAt: new Date(),
          },
          include: {
            product: true,
            warehouse: true,
          },
        });
      },
      {
        timeout: 10000,
      },
    );

    // ------------------------------------------
    // REDIS CLEANUP
    // ------------------------------------------

    try {
      const redis = getRedis();

      if (redis) {
        console.log("[REDIS] removing released reservation");

        await redis.zrem("reservations", id);
      }
    } catch (err) {
      console.error("[REDIS] zrem failed", err);
    }

    console.log("[RELEASE] completed");

    return result;
  } catch (err) {
    console.error("[RELEASE] FAILED", err);
    throw err;
  }
}

// ======================================================
// REDIS HELPERS
// ======================================================

async function trackReservationInRedis(
  reservationId: string,
  expiresAt: Date,
) {
  console.log("[REDIS] connecting");

  const redis = getRedis();

  if (!redis) {
    console.log("[REDIS] unavailable");
    return;
  }

  console.log("[REDIS] zadd start");

  await redis.zadd("reservations", {
    score: expiresAt.getTime(),
    member: reservationId,
  });

  console.log("[REDIS] zadd complete");
}