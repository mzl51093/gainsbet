'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function OnboardingPage() {
  const router = useRouter()
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [role, setRole] = useState<'competitor' | 'partner'>('competitor')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }

    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName, username: username.toLowerCase(), role })
      .eq('id', user.id)

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">👋</div>
          <h1 className="text-2xl font-bold text-white">Set up your profile</h1>
          <p className="text-gray-400 text-sm mt-1">One-time setup, then you're in.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Big Gains Gary"
              required
              maxLength={40}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-green-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value.replace(/[^a-z0-9_]/gi, '').toLowerCase())}
              placeholder="garygains"
              required
              maxLength={20}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-green-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">I am a...</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole('competitor')}
                className={`p-4 rounded-xl border-2 transition-colors text-left ${
                  role === 'competitor'
                    ? 'border-green-500 bg-green-500/10'
                    : 'border-gray-700 bg-gray-900'
                }`}
              >
                <div className="text-2xl mb-1">🏋️</div>
                <div className="text-white font-medium text-sm">Competitor</div>
                <div className="text-gray-500 text-xs">I log workouts & compete</div>
              </button>
              <button
                type="button"
                onClick={() => setRole('partner')}
                className={`p-4 rounded-xl border-2 transition-colors text-left ${
                  role === 'partner'
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-gray-700 bg-gray-900'
                }`}
              >
                <div className="text-2xl mb-1">👀</div>
                <div className="text-white font-medium text-sm">Accountability Partner</div>
                <div className="text-gray-500 text-xs">I watch, judge & wager</div>
              </button>
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading || !displayName || !username}
            className="w-full bg-green-500 hover:bg-green-400 disabled:bg-green-900 disabled:text-green-700 text-black font-bold py-3 rounded-xl transition-colors"
          >
            {loading ? 'Saving...' : "Let's Go"}
          </button>
        </form>
      </div>
    </div>
  )
}
