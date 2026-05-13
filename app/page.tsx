import { prisma } from '@/lib/prisma'
import ProductCard from '@/components/ProductCard'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
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

  return (
    <main className="max-w-6xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Products</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Reservations hold for 10 minutes while you complete checkout.
        </p>
      </div>

      {shaped.length === 0 ? (
        <div className="text-center py-24 text-zinc-600">
          No products found. Run <code className="text-zinc-400">npm run db:seed</code>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {shaped.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </main>
  )
}