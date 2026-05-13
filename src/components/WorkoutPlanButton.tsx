'use client'

import { useState } from 'react'
import Link from 'next/link'

const TYPE_EMOJI: Record<string, string> = {
  strength: '🏋️',
  hiit: '⚡',
  cardio: '🏃',
  sports: '⚽',
  flexibility: '🧘',
  other: '💪',
}

interface Plan {
  type: string
  duration_minutes: number
  points: number
  title: string
  description: string
}

interface Props {
  pointsNeeded: number
  hoursLeft: number
  daysLeft: number
}

export default function WorkoutPlanButton({ pointsNeeded, hoursLeft, daysLeft }: Props) {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  async function fetchPlan() {
    if (open) { setOpen(false); return }
    if (plans.length > 0) { setOpen(true); return }
    setLoading(true)
    try {
      const res = await fetch('/api/workout-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pointsNeeded, hoursLeft, daysLeft }),
      })
      const data = await res.json()
      if (data.plans) { setPlans(data.plans); setOpen(true) }
    } catch {}
    setLoading(false)
  }

  return (
    <div>
      <button
        onClick={fetchPlan}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-blue-900/30 hover:bg-blue-900/50 border border-blue-700/40 text-blue-300 text-xs font-medium py-2 rounded-xl transition-colors"
      >
        {loading ? (
          <>
            <span className="animate-spin">⚙️</span> Building your plan...
          </>
        ) : open ? (
          '▲ Hide plan'
        ) : (
          <>💡 Get my workout plan</>
        )}
      </button>

      {open && plans.length > 0 && (
        <div className="mt-2 space-y-2">
          {plans.map((plan, i) => (
            <div key={i} className="bg-gray-800 rounded-xl p-3 flex items-start gap-3">
              <span className="text-xl mt-0.5">{TYPE_EMOJI[plan.type] || '💪'}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-white text-sm font-semibold">{plan.title}</p>
                  <span className="text-green-400 text-sm font-bold shrink-0">+{plan.points} pts</span>
                </div>
                <p className="text-gray-400 text-xs mt-0.5">{plan.duration_minutes} min · {plan.description}</p>
              </div>
              <Link
                href={`/log-workout?type=${plan.type}&duration=${plan.duration_minutes}&notes=${encodeURIComponent(plan.title)}`}
                className="shrink-0 bg-green-600 hover:bg-green-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors self-center"
              >
                Log
              </Link>
            </div>
          ))}
          <p className="text-xs text-gray-600 text-center">Tap Log to pre-fill the workout form</p>
        </div>
      )}
    </div>
  )
}
