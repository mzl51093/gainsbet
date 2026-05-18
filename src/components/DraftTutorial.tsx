'use client'

import { useState } from 'react'

const STEPS = [
  {
    emoji: '🏆',
    title: 'Welcome to Team Draft',
    description:
      'Two teams, one goal. First team to reach the point target wins — but every member must pull their weight.',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10 border-yellow-500/30',
  },
  {
    emoji: '🗳️',
    title: 'Vote for Captains',
    description:
      'Everyone votes. Top 2 vote-getters become team captains. Ties are broken randomly.',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/30',
  },
  {
    emoji: '🐍',
    title: 'Snake Draft',
    description:
      'Captains take turns picking their team. Last pick = back-to-back picks. No excuses for a bad team.',
    color: 'text-green-400',
    bg: 'bg-green-500/10 border-green-500/30',
  },
  {
    emoji: '💪',
    title: 'Win Together',
    description:
      'Race to the point goal. Catch: every teammate must contribute at least 25% or your team cannot win. Push each other.',
    color: 'text-red-400',
    bg: 'bg-red-500/10 border-red-500/30',
  },
]

const STORAGE_KEY = 'draft-tutorial-seen-v1'

interface Props {
  onDismiss: () => void
  pointGoal?: number
}

export default function DraftTutorial({ onDismiss, pointGoal }: Props) {
  const [step, setStep] = useState(0)

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1')
    onDismiss()
  }

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  // Replace [X] with actual point goal if provided
  const description = pointGoal
    ? current.description.replace('[X]', String(pointGoal))
    : current.description

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-sm bg-gray-900 rounded-2xl overflow-hidden shadow-2xl">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 pt-5 pb-1">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? 'w-6 bg-green-400' : 'w-1.5 bg-gray-700'
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="px-6 py-6 text-center space-y-4">
          <div
            className={`inline-flex items-center justify-center w-20 h-20 rounded-2xl border ${current.bg} text-5xl`}
          >
            {current.emoji}
          </div>
          <div>
            <h2 className={`text-xl font-bold ${current.color}`}>{current.title}</h2>
            <p className="text-gray-400 text-sm mt-2 leading-relaxed">{description}</p>
          </div>
        </div>

        {/* Buttons */}
        <div className="px-6 pb-6 flex gap-3">
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="flex-1 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium transition-colors"
            >
              Back
            </button>
          )}
          <button
            onClick={isLast ? dismiss : () => setStep((s) => s + 1)}
            className="flex-1 py-3 rounded-xl bg-green-500 hover:bg-green-400 text-black font-bold text-sm transition-colors"
          >
            {isLast ? "Let's go! 🚀" : 'Next →'}
          </button>
        </div>

        {/* Skip */}
        {!isLast && (
          <button
            onClick={dismiss}
            className="w-full text-center text-xs text-gray-600 hover:text-gray-500 pb-4 transition-colors"
          >
            Skip tutorial
          </button>
        )}
      </div>
    </div>
  )
}

export function hasDraftTutorialBeenSeen(): boolean {
  if (typeof window === 'undefined') return false
  return !!localStorage.getItem(STORAGE_KEY)
}
