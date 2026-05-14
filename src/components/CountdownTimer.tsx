'use client'

import { useState, useEffect } from 'react'

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export default function CountdownTimer({ endTimestamp }: { endTimestamp: number }) {
  const [timeLeft, setTimeLeft] = useState(() => Math.max(0, endTimestamp - Date.now()))

  useEffect(() => {
    const tick = () => setTimeLeft(Math.max(0, endTimestamp - Date.now()))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [endTimestamp])

  if (timeLeft <= 0) return <span className="text-red-400 font-bold text-sm">Ended</span>

  const totalSeconds = Math.floor(timeLeft / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return (
    <div className="flex items-center gap-1.5">
      {days > 0 && (
        <>
          <span className="text-white font-bold text-lg tabular-nums">{days}</span>
          <span className="text-gray-500 text-xs">d</span>
        </>
      )}
      <span className="text-white font-bold text-lg tabular-nums">{pad(hours)}</span>
      <span className="text-gray-500 text-xs">h</span>
      <span className="text-white font-bold text-lg tabular-nums">{pad(minutes)}</span>
      <span className="text-gray-500 text-xs">m</span>
      <span className="text-white font-bold text-lg tabular-nums">{pad(seconds)}</span>
      <span className="text-gray-500 text-xs">s</span>
    </div>
  )
}
