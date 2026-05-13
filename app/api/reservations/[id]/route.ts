import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api-response'
import { withErrorHandler } from '@/lib/with-error-handler'
import { ReservationNotFoundError } from '@/lib/errors'

export const GET = withErrorHandler(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params

    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        product:   true,
        warehouse: true,
      },
    })

    if (!reservation) throw new ReservationNotFoundError()

    // Lazy expiry check — if expired and still PENDING, mark it released
    if (reservation.status === 'PENDING' && reservation.expiresAt < new Date()) {
      const updated = await prisma.$transaction(async (tx) => {
        await tx.stock.update({
          where: {
            productId_warehouseId: {
              productId:   reservation.productId,
              warehouseId: reservation.warehouseId,
            },
          },
          data: { reservedUnits: { decrement: reservation.quantity } },
        })

        return tx.reservation.update({
          where: { id },
          data:  { status: 'RELEASED', releasedAt: new Date() },
          include: { product: true, warehouse: true },
        })
      })

      return apiSuccess(updated)
    }

    return apiSuccess(reservation)
  }
)