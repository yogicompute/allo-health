'use client'

import { useState } from 'react'
import ReserveDialog from './ReserveDialog'

type StockItem = {
  warehouseId: string
  availableUnits: number
  totalUnits: number
  warehouse: { name: string; location: string | null }
}

type Product = {
  id: string
  name: string
  sku: string
  description: string | null
  stock: StockItem[]
}

export default function ProductCard({ product }: { product: Product }) {
  const [open, setOpen] = useState(false)
  const totalAvailable = product.stock.reduce((s, w) => s + w.availableUnits, 0)
  const outOfStock = totalAvailable === 0

  return (
    <>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col gap-4 hover:border-zinc-700 transition-all duration-200 group">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-semibold text-white truncate">{product.name}</h2>
            <p className="text-xs text-zinc-500 font-mono mt-0.5">{product.sku}</p>
          </div>
          <span
            className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-medium border ${
              outOfStock
                ? 'bg-red-500/10 text-red-400 border-red-500/20'
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            }`}
          >
            {outOfStock ? 'Out of Stock' : 'In Stock'}
          </span>
        </div>

        {product.description && (
          <p className="text-sm text-zinc-400 leading-relaxed">{product.description}</p>
        )}

        <div className="space-y-2.5">
          <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">
            Stock by Warehouse
          </p>
          {product.stock.map(s => (
            <div key={s.warehouseId} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`w-1.5 h-1.5 rounded-full ${
                    s.availableUnits > 0 ? 'bg-emerald-400' : 'bg-zinc-600'
                  }`}
                />
                <span className="text-sm text-zinc-300">{s.warehouse.name}</span>
                {s.warehouse.location && (
                  <span className="text-xs text-zinc-600">{s.warehouse.location}</span>
                )}
              </div>
              <div className="text-right">
                <span
                  className={`text-xs font-mono ${
                    s.availableUnits > 0 ? 'text-zinc-300' : 'text-zinc-600'
                  }`}
                >
                  {s.availableUnits}
                  <span className="text-zinc-600"> / {s.totalUnits}</span>
                </span>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => setOpen(true)}
          disabled={outOfStock}
          className="mt-1 w-full py-2.5 text-sm font-medium rounded-lg transition-all duration-150
            bg-indigo-600 hover:bg-indigo-500 text-white
            disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed
            active:scale-[0.98]"
        >
          {outOfStock ? 'Unavailable' : 'Reserve'}
        </button>
      </div>

      <ReserveDialog open={open} onClose={() => setOpen(false)} product={product} />
    </>
  )
}