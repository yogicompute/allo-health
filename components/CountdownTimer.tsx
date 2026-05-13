'use client'

import { useEffect, useState } from 'react'

export default function CountdownTimer({
  expiresAt,
  onExpire,
}: {
  expiresAt: string
  onExpire: () => void
}) {
  const [ms, setMs] = useState(() => Math.max(0, new Date(expiresAt).getTime() - Date.now()))

  useEffect(() => {
    const tick = setInterval(() => {
      const left = Math.max(0, new Date(expiresAt).getTime() - Date.now())
      setMs(left)
      if (left === 0) {
        clearInterval(tick)
        onExpire()
      }
    }, 500)
    return () => clearInterval(tick)
  }, [expiresAt, onExpire])

  const totalMs   = 10 * 60 * 1000
  const pct       = (ms / totalMs) * 100
  const mins      = Math.floor(ms / 60000)
  const secs      = Math.floor((ms % 60000) / 1000)
  const isUrgent  = ms < 60000
  const isExpired = ms === 0

  const color = isExpired
    ? '#52525b'
    : isUrgent
    ? '#ef4444'
    : '#6366f1'

  const radius = 54
  const circ   = 2 * Math.PI * radius
  const dash   = circ - (pct / 100) * circ

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-36 h-36">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <circle cx="60" cy="60" r={radius} stroke="#27272a" strokeWidth="8" fill="none" />
          <circle
            cx="60" cy="60" r={radius}
            stroke={color}
            strokeWidth="8"
            fill="none"
            strokeDasharray={circ}
            strokeDashoffset={dash}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.5s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-2xl font-bold font-mono tabular-nums"
            style={{ color: isExpired ? '#52525b' : isUrgent ? '#ef4444' : '#fff' }}
          >
            {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
          </span>
          <span className="text-[10px] text-zinc-500 mt-0.5">
            {isExpired ? 'EXPIRED' : 'remaining'}
          </span>
        </div>
      </div>
      {isUrgent && !isExpired && (
        <p className="text-xs text-red-400 animate-pulse font-medium">
          Hurry — your hold is almost up!
        </p>
      )}
    </div>
  )
}