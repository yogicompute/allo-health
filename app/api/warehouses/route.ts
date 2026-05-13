import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api-response'
import { withErrorHandler } from '@/lib/with-error-handler'

export const GET = withErrorHandler(async (_req: NextRequest) => {
  const warehouses = await prisma.warehouse.findMany({
    orderBy: { name: 'asc' },
  })

  return apiSuccess(warehouses)
})