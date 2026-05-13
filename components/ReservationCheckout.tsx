'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import CountdownTimer from './CountdownTimer'

type Reservation = {
  id: string
  status: string
  quantity: number
  expiresAt: string
  createdAt: string
  confirmedAt: string | null
  releasedAt: string | null
  product:   { name: string; sku: string }
  warehouse: { name: string; location: string | null }
}

export default function ReservationCheckout({ reservation: initial }: { reservation: Reservation }) {
  const router = useRouter()
  const [status, setStatus]   = useState(initial.status)
  const [loading, setLoading] = useState<'confirm' | 'cancel' | null>(null)
  const statusRef = useRef(initial.status)

  useEffect(() => {
    statusRef.current = status
  }, [status])

  const handleExpire = useCallback(async () => {
    if (statusRef.current !== 'PENDING') return

    try {
      await fetch(`/api/reservations/${initial.id}/release`, { method: 'POST' })
    } catch {
      // The cron job and lazy expiry path still provide a backend fallback.
    } finally {
      setStatus('RELEASED')
    }
  }, [initial.id])

  async function handleConfirm() {
    setLoading('confirm')
    try {
      const res  = await fetch(`/api/reservations/${initial.id}/confirm`, { method: 'POST' })
      const json = await res.json()

      if (res.status === 410) {
        toast.error('Reservation expired before we could confirm it.')
        setStatus('RELEASED')
        return
      }
      if (!res.ok) {
        toast.error(json.error ?? 'Confirm failed')
        return
      }

      setStatus('CONFIRMED')
      toast.success('Order confirmed! 🎉')
    } catch {
      toast.error('Network error.')
    } finally {
      setLoading(null)
    }
  }

  async function handleCancel() {
    setLoading('cancel')
    try {
      const res  = await fetch(`/api/reservations/${initial.id}/release`, { method: 'POST' })
      const json = await res.json()

      if (!res.ok) {
        toast.error(json.error ?? 'Cancel failed')
        return
      }

      setStatus('RELEASED')
      toast.info('Reservation cancelled.')
    } catch {
      toast.error('Network error.')
    } finally {
      setLoading(null)
    }
  }

  const isPending   = status === 'PENDING'
  const isConfirmed = status === 'CONFIRMED'
  const isReleased  = status === 'RELEASED'

  return (
    <main className="max-w-lg mx-auto px-4 py-10">
      {/* Back */}
      <button
        onClick={() => router.push('/')}
        className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors mb-8"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to products
      </button>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        {/* Status bar */}
        <div
          className={`px-6 py-3 text-sm font-medium flex items-center gap-2 ${
            isConfirmed
              ? 'bg-emerald-500/10 border-b border-emerald-500/20 text-emerald-400'
              : isReleased
              ? 'bg-zinc-800 border-b border-zinc-700 text-zinc-500'
              : 'bg-indigo-500/10 border-b border-indigo-500/20 text-indigo-400'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isConfirmed ? 'bg-emerald-400' : isReleased ? 'bg-zinc-500' : 'bg-indigo-400 animate-pulse'
            }`}
          />
          {isConfirmed
            ? 'Order Confirmed'
            : isReleased
            ? 'Reservation Released'
            : 'Awaiting Confirmation'}
        </div>

        <div className="p-6 space-y-6">
          {/* Product info */}
          <div>
            <h1 className="text-xl font-semibold text-white">{initial.product.name}</h1>
            <p className="text-xs text-zinc-500 font-mono mt-0.5">{initial.product.sku}</p>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Warehouse', value: initial.warehouse.name },
              { label: 'Location', value: initial.warehouse.location ?? '—' },
              { label: 'Quantity', value: initial.quantity },
              { label: 'Reservation ID', value: initial.id.slice(0, 8) + '…' },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">{label}</p>
                <p className="text-sm text-zinc-300 mt-0.5 font-mono">{value}</p>
              </div>
            ))}
          </div>

          {/* Timer */}
          {isPending && (
            <div className="flex justify-center py-4">
              <CountdownTimer expiresAt={initial.expiresAt} onExpire={handleExpire} />
            </div>
          )}

          {/* Confirmed state */}
          {isConfirmed && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center">
              <div className="text-3xl mb-2">✓</div>
              <p className="text-emerald-400 font-medium">Purchase confirmed</p>
              <p className="text-zinc-500 text-sm mt-1">Thank you for your order.</p>
            </div>
          )}

          {/* Released/expired state */}
          {isReleased && (
            <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 text-center">
              <p className="text-zinc-400 font-medium">Reservation released</p>
              <p className="text-zinc-600 text-sm mt-1">
                This hold has been cancelled or expired.
              </p>
            </div>
          )}

          {/* Actions */}
          {isPending && (
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleCancel}
                disabled={!!loading}
                className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 text-sm font-medium rounded-xl transition-colors"
              >
                {loading === 'cancel' ? 'Cancelling…' : 'Cancel'}
              </button>
              <button
                onClick={handleConfirm}
                disabled={!!loading}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors active:scale-[0.98]"
              >
                {loading === 'confirm' ? 'Confirming…' : 'Confirm Purchase'}
              </button>
            </div>
          )}

          {(isConfirmed || isReleased) && (
            <button
              onClick={() => router.push('/')}
              className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium rounded-xl transition-colors"
            >
              Back to Products
            </button>
          )}
        </div>
      </div>
    </main>
  )
}