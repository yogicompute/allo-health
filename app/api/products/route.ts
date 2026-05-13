import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api-response'
import { withErrorHandler } from '@/lib/with-error-handler'

export const GET = withErrorHandler(async (_req: NextRequest) => {
  const products = await prisma.product.findMany({
    orderBy: { name: 'asc' },
    include: { stock: { include: { warehouse: true } } },
  })

  const shaped = products.map(p => ({
    ...p,
    stock: p.stock.map(s => ({
      ...s,
      availableUnits: s.totalUnits - s.reservedUnits,
    })),
  }))

  return apiSuccess(shaped)
})