import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api-response'
import { withErrorHandler } from '@/lib/with-error-handler'

export const GET = withErrorHandler(async (_req: NextRequest) => {
  const products = await prisma.product.findMany({
    orderBy: { name: 'asc' },
    include: {
      stock: {
        include: {
          warehouse: true,
        },
      },
    },
  })

  const shaped = products.map((product) => ({
    id:          product.id,
    name:        product.name,
    sku:         product.sku,
    description: product.description,
    imageUrl:    product.imageUrl,
    stock: product.stock.map((s) => ({
      warehouseId:    s.warehouseId,
      warehouseName:  s.warehouse.name,
      location:       s.warehouse.location,
      totalUnits:     s.totalUnits,
      reservedUnits:  s.reservedUnits,
      availableUnits: s.totalUnits - s.reservedUnits,
    })),
  }))

  return apiSuccess(shaped)
})