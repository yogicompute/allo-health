import { NextRequest } from 'next/server'
import { apiSuccess } from '@/lib/api-response'
import { withErrorHandler } from '@/lib/with-error-handler'
import { confirmReservation } from '@/lib/reservation-service'

export const POST = withErrorHandler(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params
    const reservation = await confirmReservation(id)
    return apiSuccess(reservation)
  }
)