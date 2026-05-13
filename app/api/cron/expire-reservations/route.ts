import { NextRequest, NextResponse } from 'next/server'
import { expireStaleReservations } from '@/lib/expiry-service'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await expireStaleReservations()
  return NextResponse.json({ ok: true, ...result })
}