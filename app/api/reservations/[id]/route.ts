import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api-response'
import { withErrorHandler } from '@/lib/with-error-handler'
import { ReservationNotFoundError } from '@/lib/errors'
import { releaseReservation } from '@/lib/reservation-service'

export const GET = withErrorHandler(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params

    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: { product: true, warehouse: true },
    })

    if (!reservation) throw new ReservationNotFoundError()

    // Lazy expiry
    if (reservation.status === 'PENDING' && reservation.expiresAt < new Date()) {
      const released = await releaseReservation(id)
      return apiSuccess(released)
    }

    return apiSuccess(reservation)
  }
)