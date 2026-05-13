import { NextRequest, NextResponse } from 'next/server'
import {
  InsufficientStockError,
  ReservationExpiredError,
  ReservationNotFoundError,
  InvalidStatusError,
} from './errors'

type RouteHandler = (req: NextRequest, context: any) => Promise<NextResponse>

export function withErrorHandler(handler: RouteHandler): RouteHandler {
  return async (req, context) => {
    try {
      return await handler(req, context)
    } catch (err) {
      if (err instanceof InsufficientStockError) {
        return NextResponse.json(
          { error: err.message, code: 'INSUFFICIENT_STOCK', status: 409 },
          { status: 409 }
        )
      }
      if (err instanceof ReservationExpiredError) {
        return NextResponse.json(
          { error: err.message, code: 'RESERVATION_EXPIRED', status: 410 },
          { status: 410 }
        )
      }
      if (err instanceof ReservationNotFoundError) {
        return NextResponse.json(
          { error: err.message, code: 'NOT_FOUND', status: 404 },
          { status: 404 }
        )
      }
      if (err instanceof InvalidStatusError) {
        return NextResponse.json(
          { error: err.message, code: 'INVALID_STATUS', status: 400 },
          { status: 400 }
        )
      }

      console.error('[API Error]', err)
      return NextResponse.json(
        { error: 'Internal server error', code: 'INTERNAL_ERROR', status: 500 },
        { status: 500 }
      )
    }
  }
}