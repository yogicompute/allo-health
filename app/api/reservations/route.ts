import { NextRequest, NextResponse } from 'next/server'
import { apiSuccess } from '@/lib/api-response'
import { withErrorHandler } from '@/lib/with-error-handler'
import { CreateReservationSchema } from '@/lib/zod-schema'
import { createReservation } from '@/lib/reservation-service'

export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = await req.json()
  const parsed = CreateReservationSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { productId, warehouseId, quantity } = parsed.data
  const reservation = await createReservation(productId, warehouseId, quantity)
  return apiSuccess(reservation, 201)
})