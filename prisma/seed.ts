
import { PrismaPg } from "@prisma/adapter-pg"
import {PrismaClient} from "../app/generated/prisma/client"

const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!
})

const prisma = new PrismaClient({adapter})

async function main() {
  console.log('🌱 Seeding database...')

  // ---- Clean existing data (order matters — respect FK constraints) ----
  await prisma.reservation.deleteMany()
  await prisma.stock.deleteMany()
  await prisma.product.deleteMany()
  await prisma.warehouse.deleteMany()

  // ---- Warehouses ----
  const [north, south, west] = await Promise.all([
    prisma.warehouse.create({
      data: { name: 'North Warehouse', location: 'Delhi, IN' },
    }),
    prisma.warehouse.create({
      data: { name: 'South Warehouse', location: 'Bangalore, IN' },
    }),
    prisma.warehouse.create({
      data: { name: 'West Warehouse', location: 'Mumbai, IN' },
    }),
  ])

  console.log('✅ Warehouses created')

  // ---- Products ----
  const [tshirt, shoes, bottle, headphones, bag] = await Promise.all([
    prisma.product.create({
      data: { name: 'Classic T-Shirt', sku: 'SKU-TSHIRT-001', description: 'Cotton crew neck' },
    }),
    prisma.product.create({
      data: { name: 'Running Shoes', sku: 'SKU-SHOES-002', description: 'Lightweight trainers' },
    }),
    prisma.product.create({
      data: { name: 'Water Bottle', sku: 'SKU-BOTTLE-003', description: '1L stainless steel' },
    }),
    prisma.product.create({
      data: { name: 'Wireless Headphones', sku: 'SKU-AUDIO-004', description: 'Noise cancelling' },
    }),
    prisma.product.create({
      data: { name: 'Laptop Bag', sku: 'SKU-BAG-005', description: '15" padded sleeve' },
    }),
  ])

  console.log('✅ Products created')

  // ---- Stock levels ----
  // Intentional scarcity on some items to demo the race condition
  await prisma.stock.createMany({
    data: [
      // T-Shirt — plenty of stock
      { productId: tshirt.id, warehouseId: north.id, totalUnits: 50, reservedUnits: 0 },
      { productId: tshirt.id, warehouseId: south.id, totalUnits: 30, reservedUnits: 0 },

      // Shoes — limited in West (good for demo)
      { productId: shoes.id, warehouseId: north.id, totalUnits: 10, reservedUnits: 0 },
      { productId: shoes.id, warehouseId: west.id,  totalUnits: 1,  reservedUnits: 0 }, // ← race condition demo

      // Bottle — out of stock in South
      { productId: bottle.id, warehouseId: north.id, totalUnits: 20, reservedUnits: 0 },
      { productId: bottle.id, warehouseId: south.id, totalUnits: 0,  reservedUnits: 0 }, // ← 409 demo

      // Headphones — scarce everywhere
      { productId: headphones.id, warehouseId: north.id, totalUnits: 2, reservedUnits: 0 },
      { productId: headphones.id, warehouseId: south.id, totalUnits: 1, reservedUnits: 0 },

      // Laptop Bag — only in West
      { productId: bag.id, warehouseId: west.id, totalUnits: 15, reservedUnits: 0 },
    ],
  })

  console.log('✅ Stock levels created')
  console.log('🎉 Seed complete!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })