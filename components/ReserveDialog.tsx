'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

type StockItem = {
  warehouseId: string
  availableUnits: number
  warehouse: { name: string }
}

type Product = {
  id: string
  name: string
  stock: StockItem[]
}

export default function ReserveDialog({
  open,
  onClose,
  product,
}: {
  open: boolean
  onClose: () => void
  product: Product
}) {
  const router = useRouter()
  const available = product.stock.filter(s => s.availableUnits > 0)
  const [warehouseId, setWarehouseId] = useState(available[0]?.warehouseId ?? '')
  const [quantity, setQuantity] = useState(1)
  const [loading, setLoading] = useState(false)

  const maxQty = product.stock.find(s => s.warehouseId === warehouseId)?.availableUnits ?? 0

  async function handleReserve() {
    setLoading(true)
    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id, warehouseId, quantity }),
      })
      const json = await res.json()

      if (res.status === 409) {
        toast.error(json.error ?? 'Not enough stock available')
        return
      }
      if (!res.ok) {
        toast.error(json.error ?? 'Something went wrong')
        return
      }

      toast.success('Reservation created!')
      onClose()
      router.push(`/reservations/${json.data.id}`)
    } catch {
      toast.error('Network error. Try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl shadow-black/50">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-white">{product.name}</h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            Your hold lasts <span className="text-zinc-300">10 minutes</span>
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
              Warehouse
            </label>
            <select
              value={warehouseId}
              onChange={e => { setWarehouseId(e.target.value); setQuantity(1) }}
              className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
            >
              {available.map(s => (
                <option key={s.warehouseId} value={s.warehouseId}>
                  {s.warehouse.name} — {s.availableUnits} available
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
              Quantity
            </label>
            <input
              type="number"
              min={1}
              max={maxQty}
              value={quantity}
              onChange={e =>
                setQuantity(Math.min(maxQty, Math.max(1, parseInt(e.target.value) || 1)))
              }
              className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <p className="text-xs text-zinc-600 mt-1.5">Max available: {maxQty}</p>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleReserve}
            disabled={loading || !warehouseId || quantity < 1 || quantity > maxQty}
            className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-sm font-medium rounded-lg transition-colors active:scale-[0.98]"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Reserving…
              </span>
            ) : 'Confirm Reserve'}
          </button>
        </div>
      </div>
    </div>
  )
}