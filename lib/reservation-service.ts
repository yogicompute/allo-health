import {
  InsufficientStockError,
  InvalidStatusError,
  ReservationExpiredError,
  ReservationNotFoundError,
} from "./errors";
import { prisma } from "./prisma";

const TTL_MS = parseInt(process.env.RESERVATION_TTL_MS ?? "600000"); // 10 Min default

export async function createReservation(
  productId: string,
  warehouseId: string,
  quantity: number,
) {
  // --> a trans for checkign enf stock + race condition (LAST UNIT) => serial
  return await prisma.$transaction(async (tx) => {
    const affectedRows = await tx.$executeRaw`
        UPDATE "Stock"
        SET "reservedUnits" = "reservedUnits" + ${quantity}
        WHERE "productId" = ${productId}
        AND "warehouseId" = ${warehouseId}
        AND ("totalUnits" - "reservedUnits") >= ${quantity}`;

    if (affectedRows === 0) throw new InsufficientStockError();

    return tx.reservation.create({
      data: {
        productId,
        warehouseId,
        quantity,
        status: "PENDING",
        expiresAt: new Date(Date.now() + TTL_MS),
      },
    });
  });
}

export async function confirmReservation(id: string) {
  return await prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findUnique({ where: { id } });

    if (!reservation) throw new ReservationNotFoundError();
    if (reservation.status !== "PENDING")
      throw new InvalidStatusError(
        "Rservation is not the pending the brother what u doing stupid!",
      );
    if (reservation.expiresAt < new Date()) throw new ReservationExpiredError();

    await tx.stock.update({
      where: {
        productId_warehouseId: {
          productId: reservation.productId,
          warehouseId: reservation.warehouseId,
        },
      },
      data: {
        totalUnits: { decrement: reservation.quantity },
        reservedUnits: { decrement: reservation.quantity },
      },
    });

    return tx.reservation.update({
      where: { id },
      data: { status: "CONFIRMED", confirmedAt: new Date() },
      include: { product: true, warehouse: true },
    });
  });
}

export async function releaseReservation(id: string) {
  return await prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findUnique({ where: { id } });

    if (!reservation) throw new ReservationNotFoundError();
    if (reservation.status === "CONFIRMED")
      throw new InvalidStatusError("ALREADY CONFIRmed brother, cannot release");
    if (reservation.status === "RELEASED") return reservation;

    await tx.stock.update({
      where: {
        productId_warehouseId: {
          productId: reservation.productId,
          warehouseId: reservation.warehouseId,
        },
      },
      data: {
        reservedUnits: { decrement: reservation.quantity },
      },
    });

    return tx.reservation.update({
      where: { id },
      data: {
        status: "RELEASED",
        releasedAt: new Date(),
      },
      include: { product: true, warehouse: true },
    });
  });
}
