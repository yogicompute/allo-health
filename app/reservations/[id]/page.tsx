import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { releaseReservation } from '@/lib/reservation-service'
import ReservationCheckout from '@/components/ReservationCheckout'

export const dynamic = 'force-dynamic'

export default async function ReservationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  let reservation = await prisma.reservation.findUnique({
    where: { id },
    include: { product: true, warehouse: true },
  })

  if (!reservation) notFound()

  // Lazy expiry
  if (reservation.status === 'PENDING' && reservation.expiresAt < new Date()) {
    await releaseReservation(id).catch(() => null)
    reservation = await prisma.reservation.findUnique({
      where: { id },
      include: { product: true, warehouse: true },
    })
  }

  const data = {
    ...reservation!,
    expiresAt:   reservation!.expiresAt.toISOString(),
    createdAt:   reservation!.createdAt.toISOString(),
    confirmedAt: reservation!.confirmedAt?.toISOString() ?? null,
    releasedAt:  reservation!.releasedAt?.toISOString() ?? null,
  }

  return <ReservationCheckout reservation={data} />
}