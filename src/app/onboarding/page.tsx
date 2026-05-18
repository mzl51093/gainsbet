'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function OnboardingPage() {
  const router = useRouter()
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [venmoUsername, setVenmoUsername] = useState('')
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
      .update({
        display_name: displayName,
        username: username.toLowerCase(),
        role: 'competitor',
        ...(venmoUsername.trim() ? { venmo_username: venmoUsername.replace('@', '').trim() } : {}),
      })
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
            <label className="block text-sm text-gray-400 mb-2">
              Venmo Username <span className="text-gray-600">(optional)</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input
                type="text"
                value={venmoUsername}
                onChange={e => setVenmoUsername(e.target.value.replace('@', ''))}
                placeholder="garygains"
                maxLength={30}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-8 pr-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <p className="text-gray-600 text-xs mt-1">So teammates can pay you after competitions</p>
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
