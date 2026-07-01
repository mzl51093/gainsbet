'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Profile { id: string; display_name: string; username: string }

export default function NewTennisChallengePage() {
  const router = useRouter()
  const [currentUserId, setCurrentUserId] = useState('')
  const [profiles, setProfiles] = useState<Profile[]>([])

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [participantIds, setParticipantIds] = useState<string[]>([])
  const [wager, setWager] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    const supabase = createClient()
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUserId(user.id)
      const { data } = await supabase.from('profiles').select('id, display_name, username').order('display_name')
      setProfiles(data || [])
    })()
  }, [])

  function toggleParticipant(id: string) {
    if (id === currentUserId) return
    setParticipantIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Challenge name is required'); return }
    if (participantIds.length === 0) { setError('Add at least one opponent'); return }
    if (!startDate) { setError('Start date is required'); return }

    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/tennis/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null, participantIds, wager: wager.trim() || null, startDate, endDate: endDate || null }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to create'); return }
      router.push(`/tennis/${data.id}`)
    } catch {
      setError('Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const others = profiles.filter(p => p.id !== currentUserId)

  return (
    <div className="min-h-screen bg-gray-950 pb-24">
      <div className="bg-gray-900 px-4 pt-12 pb-5 border-b border-gray-800">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link href="/tennis" className="text-gray-400 hover:text-white text-sm transition-colors">← Back</Link>
          <h1 className="text-xl font-bold text-white">🎾 New Tennis Challenge</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">

          <div className="bg-gray-900 rounded-2xl p-4">
            <label className="block">
              <span className="text-white font-semibold text-sm block mb-2">Challenge Name *</span>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Summer Court Wars" maxLength={80}
                className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 text-sm placeholder-gray-600 border border-gray-700 focus:border-green-500 focus:outline-none" />
            </label>
          </div>

          <div className="bg-gray-900 rounded-2xl p-4">
            <label className="block">
              <span className="text-white font-semibold text-sm block mb-2">Description <span className="text-gray-600 font-normal">(optional)</span></span>
              <textarea value={description} onChange={e => setDescription(e.target.value)}
                placeholder="e.g. Best of 10 matches, singles only, no excuses"
                rows={2} maxLength={300}
                className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 text-sm placeholder-gray-600 border border-gray-700 focus:border-green-500 focus:outline-none resize-none" />
            </label>
          </div>

          <div className="bg-gray-900 rounded-2xl p-4 space-y-3">
            <span className="text-white font-semibold text-sm block">Players *</span>
            <p className="text-gray-500 text-xs">You're automatically included. Select your opponents.</p>
            <div className="flex flex-wrap gap-2">
              {others.map(p => (
                <button key={p.id} type="button" onClick={() => toggleParticipant(p.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                    participantIds.includes(p.id) ? 'bg-green-500 text-black' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}>
                  {participantIds.includes(p.id) ? '✓ ' : ''}{p.display_name.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-gray-900 rounded-2xl p-4 space-y-3">
            <span className="text-white font-semibold text-sm block">Dates</span>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-gray-400 text-xs block mb-1">Start Date *</span>
                <input type="date" value={startDate} min={today} onChange={e => setStartDate(e.target.value)}
                  className="w-full bg-gray-800 text-white rounded-xl px-3 py-2.5 text-sm border border-gray-700 focus:border-green-500 focus:outline-none" />
              </label>
              <label className="block">
                <span className="text-gray-400 text-xs block mb-1">End Date <span className="text-gray-600">(optional)</span></span>
                <input type="date" value={endDate} min={startDate || today} onChange={e => setEndDate(e.target.value)}
                  className="w-full bg-gray-800 text-white rounded-xl px-3 py-2.5 text-sm border border-gray-700 focus:border-green-500 focus:outline-none" />
              </label>
            </div>
          </div>

          <div className="bg-gray-900 rounded-2xl p-4">
            <label className="block">
              <span className="text-white font-semibold text-sm block mb-2">Stakes <span className="text-gray-600 font-normal">(optional)</span></span>
              <input type="text" value={wager} onChange={e => setWager(e.target.value)}
                placeholder='e.g. "Loser buys dinner"' maxLength={200}
                className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 text-sm placeholder-gray-600 border border-gray-700 focus:border-green-500 focus:outline-none" />
            </label>
          </div>

          <div className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700/50">
            <p className="text-gray-400 text-xs font-semibold mb-2">🎾 How scoring works</p>
            <ul className="text-gray-500 text-xs space-y-1">
              <li>• <span className="text-gray-300">Win</span> = +50 pts · <span className="text-gray-300">Loss</span> = +10 pts (for showing up)</li>
              <li>• <span className="text-gray-300">+10 pts</span> per set won · <span className="text-gray-300">+1 pt</span> per game won</li>
              <li>• <span className="text-yellow-400">Clean Sweep bonus</span> = +25 pts (win without dropping a set)</li>
              <li>• <span className="text-yellow-400">Bagel bonus</span> = +15 pts per 6-0 set you win</li>
              <li>• <span className="text-green-400">Aces</span> = +5 pts each (max +50 per match)</li>
              <li>• <span className="text-blue-400">Practice</span> = 10 pts/hr on court</li>
            </ul>
          </div>

          {error && (
            <div className="bg-red-900/20 border border-red-700/50 rounded-xl px-4 py-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <button type="submit" disabled={loading || !name || participantIds.length === 0 || !startDate}
            className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-4 rounded-xl text-sm transition-colors">
            {loading ? 'Creating...' : '🎾 Start Challenge →'}
          </button>
        </form>
      </div>
    </div>
  )
}
