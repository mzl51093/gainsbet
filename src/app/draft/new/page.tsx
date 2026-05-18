'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function NewDraftPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [pointGoal, setPointGoal] = useState(100)
  const [maxParticipants, setMaxParticipants] = useState(6)
  const [wagerDescription, setWagerDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Competition name is required')
      return
    }
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          pointGoal,
          maxParticipants,
          wagerDescription: wagerDescription.trim() || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to create competition')
        return
      }

      router.push(`/draft/${data.id}`)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <div className="bg-gray-900 px-4 pt-12 pb-5 border-b border-gray-800">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link href="/draft" className="text-gray-400 hover:text-white transition-colors">
            ← Back
          </Link>
          <h1 className="text-xl font-bold text-white">New Draft Competition</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Competition Name */}
          <div className="bg-gray-900 rounded-2xl p-4 space-y-3">
            <label className="block">
              <span className="text-white font-semibold text-sm block mb-1.5">
                Competition Name *
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. January Grind Challenge"
                className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 text-sm placeholder-gray-600 border border-gray-700 focus:border-green-500 focus:outline-none"
                maxLength={80}
              />
            </label>
          </div>

          {/* Point Goal */}
          <div className="bg-gray-900 rounded-2xl p-4 space-y-3">
            <span className="text-white font-semibold text-sm block">Point Goal</span>
            <p className="text-gray-500 text-xs">
              First team to reach this total wins (every member must hit 25% min).
            </p>
            <div className="flex gap-2 flex-wrap">
              {[50, 100, 150, 200, 300].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setPointGoal(val)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                    pointGoal === val
                      ? 'bg-green-500 text-black'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {val} pts
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 mt-1">
              <span className="text-gray-400 text-xs">Custom:</span>
              <input
                type="number"
                value={pointGoal}
                onChange={(e) => setPointGoal(Math.max(1, parseInt(e.target.value) || 1))}
                min={1}
                max={9999}
                className="w-24 bg-gray-800 text-white rounded-lg px-3 py-1.5 text-sm border border-gray-700 focus:border-green-500 focus:outline-none"
              />
            </label>
          </div>

          {/* Max Participants */}
          <div className="bg-gray-900 rounded-2xl p-4 space-y-3">
            <span className="text-white font-semibold text-sm block">Max Participants</span>
            <p className="text-gray-500 text-xs">
              Must be even — teams split in half.
            </p>
            <div className="flex gap-2">
              {[4, 6, 8].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setMaxParticipants(val)}
                  className={`px-5 py-2 rounded-xl text-sm font-medium transition-colors ${
                    maxParticipants === val
                      ? 'bg-green-500 text-black'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {val}
                </button>
              ))}
            </div>
          </div>

          {/* Wager Description */}
          <div className="bg-gray-900 rounded-2xl p-4 space-y-3">
            <label className="block">
              <span className="text-white font-semibold text-sm block mb-1.5">
                What's at stake? <span className="text-gray-600 font-normal">(optional)</span>
              </span>
              <textarea
                value={wagerDescription}
                onChange={(e) => setWagerDescription(e.target.value)}
                placeholder="Losers buy winners dinner. Loser team does 100 burpees. etc."
                rows={3}
                className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 text-sm placeholder-gray-600 border border-gray-700 focus:border-green-500 focus:outline-none resize-none"
                maxLength={200}
              />
            </label>
          </div>

          {error && (
            <div className="bg-red-900/20 border border-red-700/50 rounded-xl px-4 py-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-4 rounded-xl text-sm transition-colors"
          >
            {loading ? 'Creating...' : 'Create Competition →'}
          </button>
        </form>
      </div>
    </div>
  )
}
