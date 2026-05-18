'use client'

import { useState } from 'react'

const STEPS = [
  {
    emoji: '🏆',
    title: 'Team Draft — The Basics',
    description:
      'Two teams race to a shared point goal. First team to hit the target — with every member pulling their weight — wins. Simple. Brutal. Beautiful.',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10 border-yellow-500/30',
  },
  {
    emoji: '🤝',
    title: 'Step 1: Recruiting',
    description:
      'The organizer creates the draft and shares the link. Everyone joins before the lobby fills up. No stragglers — spots are limited.',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/30',
  },
  {
    emoji: '🗳️',
    title: 'Step 2: Vote for Captains',
    description:
      'Every player votes for who they want as captain. Top 2 vote-getters get the job. You cannot vote for yourself. Ties are broken randomly.',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10 border-purple-500/30',
  },
  {
    emoji: '🐍',
    title: 'Step 3: Snake Draft',
    description:
      'Captains take turns picking players in a snake order: A picks 1st, B picks 2nd, B picks 3rd, A picks 4th… The last pick gets two in a row. No excuses for a weak team.',
    color: 'text-green-400',
    bg: 'bg-green-500/10 border-green-500/30',
  },
  {
    emoji: '⚙️',
    title: 'Step 4: Configure',
    description:
      'Captains finalize the start date, end date, and stakes. Both captains must agree before the competition goes live.',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10 border-orange-500/30',
  },
  {
    emoji: '🏋️',
    title: 'Step 5: Log Workouts',
    description:
      'Once live, log your workouts to earn points. Your teammates must approve your workouts — no validation, no points. Keep each other honest.',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10 border-cyan-500/30',
  },
  {
    emoji: '⚠️',
    title: 'The Min Contribution Rule',
    description:
      'Every player must personally contribute a minimum % of the goal. One slacker can block the whole team from winning — even if everyone else crushed it. No free rides.',
    color: 'text-red-400',
    bg: 'bg-red-500/10 border-red-500/30',
  },
  {
    emoji: '💸',
    title: 'Settle Up',
    description:
      'When the competition ends, the winning team is declared. Losers pay winners on Venmo — right from the app. Set your Venmo username in Profile so people can find you.',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/30',
  },
]

const STORAGE_KEY = 'draft-tutorial-seen-v1'

interface Props {
  onDismiss: () => void
  pointGoal?: number
  minPct?: number
}

export default function DraftTutorial({ onDismiss, pointGoal, minPct }: Props) {
  const [step, setStep] = useState(0)

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1')
    onDismiss()
  }

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  const description = current.description
    .replace(/\[GOAL\]/g, pointGoal ? String(pointGoal) : 'the goal')
    .replace(/a minimum %/g, minPct ? `at least ${minPct}%` : 'a minimum %')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-sm bg-gray-900 rounded-2xl overflow-hidden shadow-2xl">
        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 pt-5 pb-1">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? 'w-5 bg-green-400' : i < step ? 'w-1.5 bg-green-800' : 'w-1.5 bg-gray-700'
              }`}
            />
          ))}
        </div>

        {/* Step counter */}
        <p className="text-center text-gray-600 text-xs mt-2">
          {step + 1} / {STEPS.length}
        </p>

        {/* Content */}
        <div className="px-6 py-5 text-center space-y-4">
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
              ← Back
            </button>
          )}
          <button
            onClick={isLast ? dismiss : () => setStep((s) => s + 1)}
            className="flex-1 py-3 rounded-xl bg-green-500 hover:bg-green-400 text-black font-bold text-sm transition-colors"
          >
            {isLast ? 'Got it! 🚀' : 'Next →'}
          </button>
        </div>

        {!isLast && (
          <button
            onClick={dismiss}
            className="w-full text-center text-xs text-gray-600 hover:text-gray-500 pb-4 transition-colors"
          >
            Skip
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
