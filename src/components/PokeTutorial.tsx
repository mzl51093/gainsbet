'use client'

import { useState, useEffect } from 'react'

const STEPS = [
  {
    emoji: '👆',
    title: 'Fun Poke',
    description: 'Tap the 👆 button next to anyone to poke them out of nowhere. They get a push notification. No reason needed — just chaos.',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/30',
  },
  {
    emoji: '💪',
    title: 'Challenge a Competitor',
    description: 'Tap 💪 next to a competitor. Pick an exercise, reps, and points on the line. They have 10 minutes to submit a video proof — or forfeit.',
    color: 'text-green-400',
    bg: 'bg-green-500/10 border-green-500/30',
  },
  {
    emoji: '😈',
    title: 'Dare a Motivator',
    description: "Challenge your wife or partner. Here's the twist — if THEY complete it with video, the points come off YOUR score. Risk your lead to keep them engaged.",
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/30',
  },
]

const STORAGE_KEY = 'poke-tutorial-seen-v1'

export default function PokeTutorial() {
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true)
    }
  }, [])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

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
          <div className={`inline-flex items-center justify-center w-20 h-20 rounded-2xl border ${current.bg} text-5xl`}>
            {current.emoji}
          </div>
          <div>
            <h2 className={`text-xl font-bold ${current.color}`}>{current.title}</h2>
            <p className="text-gray-400 text-sm mt-2 leading-relaxed">{current.description}</p>
          </div>
        </div>

        {/* Buttons */}
        <div className="px-6 pb-6 flex gap-3">
          {step > 0 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="flex-1 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium transition-colors"
            >
              Back
            </button>
          )}
          <button
            onClick={isLast ? dismiss : () => setStep(s => s + 1)}
            className="flex-1 py-3 rounded-xl bg-green-500 hover:bg-green-400 text-black font-bold text-sm transition-colors"
          >
            {isLast ? "Got it, let's go! 🚀" : 'Next →'}
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
