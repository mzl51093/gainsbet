'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Profile {
  id: string
  display_name: string
  username: string
}

export default function NewDuelPage() {
  const router = useRouter()
  const [currentUserId, setCurrentUserId] = useState('')
  const [profiles, setProfiles] = useState<Profile[]>([])

  const [name, setName] = useState('')
  const [competitorAId, setCompetitorAId] = useState('')
  const [competitorBId, setCompetitorBId] = useState('')
  const [watcherIds, setWatcherIds] = useState<string[]>([])
  const [wager, setWager] = useState('')
  const [rules, setRules] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [startWeightA, setStartWeightA] = useState('')
  const [startWeightB, setStartWeightB] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setCurrentUserId(user.id)
      setCompetitorAId(user.id)

      const { data: ps } = await supabase
        .from('profiles')
        .select('id, display_name, username')
        .order('display_name')
      setProfiles(ps || [])
    })()
  }, [])

  function toggleWatcher(id: string) {
    setWatcherIds(prev =>
      prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id]
    )
  }

  const today = new Date().toISOString().split('T')[0]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !competitorAId || !competitorBId || !startDate || !endDate) {
      setError('Please fill in all required fields')
      return
    }
    if (competitorAId === competitorBId) {
      setError('Competitors must be different people')
      return
    }
    if (endDate <= startDate) {
      setError('End date must be after start date')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/duel/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          competitorAId,
          competitorBId,
          watcherIds,
          wager: wager.trim() || null,
          rules: rules.trim() || null,
          startDate,
          endDate,
          startingWeightA: startWeightA ? parseFloat(startWeightA) : null,
          startingWeightB: startWeightB ? parseFloat(startWeightB) : null,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to create duel')
        return
      }

      router.push(`/duel/${data.id}`)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const competitorAProfile = profiles.find(p => p.id === competitorAId)
  const competitorBProfile = profiles.find(p => p.id === competitorBId)
  const availableForB = profiles.filter(p => p.id !== competitorAId)
  const availableWatchers = profiles.filter(p => p.id !== competitorAId && p.id !== competitorBId)

  return (
    <div className="min-h-screen bg-gray-950 pb-24">
      <div className="bg-gray-900 px-4 pt-12 pb-5 border-b border-gray-800">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link href="/duel" className="text-gray-400 hover:text-white transition-colors">← Back</Link>
          <h1 className="text-xl font-bold text-white">⚔️ New Duel</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Duel Name */}
          <div className="bg-gray-900 rounded-2xl p-4">
            <label className="block">
              <span className="text-white font-semibold text-sm block mb-2">Duel Name *</span>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Summer Shred Showdown"
                className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 text-sm placeholder-gray-600 border border-gray-700 focus:border-green-500 focus:outline-none"
                maxLength={80}
              />
            </label>
          </div>

          {/* Competitors */}
          <div className="bg-gray-900 rounded-2xl p-4 space-y-3">
            <span className="text-white font-semibold text-sm block">Competitors *</span>
            <p className="text-gray-500 text-xs">Two people going head-to-head. Everyone else is a watcher.</p>

            <div className="space-y-2">
              <div>
                <span className="text-gray-400 text-xs mb-1 block">Competitor A</span>
                <select
                  value={competitorAId}
                  onChange={e => {
                    setCompetitorAId(e.target.value)
                    if (e.target.value === competitorBId) setCompetitorBId('')
                  }}
                  className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 text-sm border border-gray-700 focus:border-green-500 focus:outline-none"
                >
                  <option value="">Select competitor A</option>
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>{p.display_name}</option>
                  ))}
                </select>
              </div>

              {competitorAId && (
                <div className="pl-4 flex items-center gap-2">
                  <span className="text-gray-600 text-xs">Starting weight (optional):</span>
                  <input
                    type="number"
                    value={startWeightA}
                    onChange={e => setStartWeightA(e.target.value)}
                    placeholder="lbs"
                    step="0.1"
                    min="50"
                    max="999"
                    className="w-24 bg-gray-800 text-white rounded-lg px-3 py-1.5 text-sm border border-gray-700 focus:border-green-500 focus:outline-none"
                  />
                </div>
              )}

              <div className="flex items-center justify-center py-1">
                <span className="text-2xl">⚔️</span>
              </div>

              <div>
                <span className="text-gray-400 text-xs mb-1 block">Competitor B</span>
                <select
                  value={competitorBId}
                  onChange={e => {
                    setCompetitorBId(e.target.value)
                    if (watcherIds.includes(e.target.value)) {
                      setWatcherIds(prev => prev.filter(id => id !== e.target.value))
                    }
                  }}
                  className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 text-sm border border-gray-700 focus:border-green-500 focus:outline-none"
                >
                  <option value="">Select competitor B</option>
                  {availableForB.map(p => (
                    <option key={p.id} value={p.id}>{p.display_name}</option>
                  ))}
                </select>
              </div>

              {competitorBId && (
                <div className="pl-4 flex items-center gap-2">
                  <span className="text-gray-600 text-xs">Starting weight (optional):</span>
                  <input
                    type="number"
                    value={startWeightB}
                    onChange={e => setStartWeightB(e.target.value)}
                    placeholder="lbs"
                    step="0.1"
                    min="50"
                    max="999"
                    className="w-24 bg-gray-800 text-white rounded-lg px-3 py-1.5 text-sm border border-gray-700 focus:border-green-500 focus:outline-none"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Watchers */}
          {availableWatchers.length > 0 && (
            <div className="bg-gray-900 rounded-2xl p-4 space-y-3">
              <span className="text-white font-semibold text-sm block">Watchers</span>
              <p className="text-gray-500 text-xs">Can view, comment, and react — but don't score points.</p>
              <div className="flex flex-wrap gap-2">
                {availableWatchers.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleWatcher(p.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                      watcherIds.includes(p.id)
                        ? 'bg-green-500 text-black'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    {watcherIds.includes(p.id) ? '✓ ' : ''}{p.display_name.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Dates */}
          <div className="bg-gray-900 rounded-2xl p-4 space-y-3">
            <span className="text-white font-semibold text-sm block">Duration *</span>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-gray-400 text-xs block mb-1">Start Date</span>
                <input
                  type="date"
                  value={startDate}
                  min={today}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full bg-gray-800 text-white rounded-xl px-3 py-2.5 text-sm border border-gray-700 focus:border-green-500 focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="text-gray-400 text-xs block mb-1">End Date</span>
                <input
                  type="date"
                  value={endDate}
                  min={startDate || today}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full bg-gray-800 text-white rounded-xl px-3 py-2.5 text-sm border border-gray-700 focus:border-green-500 focus:outline-none"
                />
              </label>
            </div>
          </div>

          {/* Wager */}
          <div className="bg-gray-900 rounded-2xl p-4">
            <label className="block">
              <span className="text-white font-semibold text-sm block mb-2">
                Stakes / Consequence <span className="text-gray-600 font-normal">(optional)</span>
              </span>
              <textarea
                value={wager}
                onChange={e => setWager(e.target.value)}
                placeholder='e.g. "Loser buys dinner" or "Loser runs a mile in a tutu"'
                rows={2}
                maxLength={200}
                className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 text-sm placeholder-gray-600 border border-gray-700 focus:border-green-500 focus:outline-none resize-none"
              />
            </label>
          </div>

          {/* Rules */}
          <div className="bg-gray-900 rounded-2xl p-4">
            <label className="block">
              <span className="text-white font-semibold text-sm block mb-2">
                Rules / Notes <span className="text-gray-600 font-normal">(optional)</span>
              </span>
              <textarea
                value={rules}
                onChange={e => setRules(e.target.value)}
                placeholder="Any special rules, tiebreakers, or notes..."
                rows={2}
                maxLength={500}
                className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 text-sm placeholder-gray-600 border border-gray-700 focus:border-green-500 focus:outline-none resize-none"
              />
            </label>
          </div>

          {/* Scoring info */}
          <div className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700/50">
            <p className="text-gray-400 text-xs font-semibold mb-2">📊 How scoring works</p>
            <ul className="text-gray-500 text-xs space-y-1">
              <li>• <span className="text-gray-300">Workout Points</span> — same as regular workouts</li>
              <li>• <span className="text-gray-300">Weight Loss Points</span> — each 1 lb lost = 25 pts</li>
              <li>• Uses lowest verified weigh-in (not current) to prevent yo-yo penalty</li>
              <li>• Total = Workout Pts + Weight Loss Pts</li>
            </ul>
          </div>

          {error && (
            <div className="bg-red-900/20 border border-red-700/50 rounded-xl px-4 py-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !name || !competitorAId || !competitorBId || !startDate || !endDate}
            className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-4 rounded-xl text-sm transition-colors"
          >
            {loading ? 'Creating...' : '⚔️ Start the Duel →'}
          </button>
        </form>
      </div>
    </div>
  )
}
