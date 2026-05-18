'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Profile {
  id: string
  display_name: string
  username: string
}

interface Props {
  competitionId: string
  participantIds: string[]
  initialInvitedIds: string[]
  allProfiles: Profile[]
}

export default function DraftInvitePanel({
  competitionId,
  participantIds,
  initialInvitedIds,
  allProfiles,
}: Props) {
  const [query, setQuery] = useState('')
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set(initialInvitedIds))
  const [loading, setLoading] = useState<string | null>(null)

  const filtered = allProfiles
    .filter(p => {
      if (participantIds.includes(p.id)) return false
      if (!query.trim()) return true
      const q = query.toLowerCase()
      return p.display_name.toLowerCase().includes(q) || p.username.toLowerCase().includes(q)
    })
    .slice(0, 8)

  async function invite(userId: string) {
    setLoading(userId)
    try {
      const res = await fetch(`/api/draft/${competitionId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      if (res.ok) {
        setInvitedIds(prev => new Set([...prev, userId]))
      }
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="bg-gray-900 rounded-2xl p-4">
      <h3 className="text-white font-semibold text-sm mb-1">Invite Friends</h3>
      <p className="text-gray-500 text-xs mb-3">
        They'll get a notification with a direct link to join.
      </p>

      <div className="relative mb-3">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by name or username…"
          className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-green-500"
        />
      </div>

      {filtered.length === 0 && query.trim() ? (
        <p className="text-gray-600 text-xs text-center py-4">
          No one found. They might not have an account yet.
        </p>
      ) : filtered.length === 0 && !query.trim() ? (
        <p className="text-gray-600 text-xs text-center py-4">
          Search for friends to invite them.
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => {
            const isInvited = invitedIds.has(p.id)
            const isLoading = loading === p.id
            const initials = p.display_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()

            return (
              <div key={p.id} className="flex items-center gap-3">
                <Link href={`/player/${p.username}`} className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                  {initials}
                </Link>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{p.display_name}</p>
                  <p className="text-gray-500 text-xs">@{p.username}</p>
                </div>
                {isInvited ? (
                  <span className="text-xs text-green-400 font-medium px-3 py-1.5 bg-green-900/30 rounded-xl flex-shrink-0">
                    Invited ✓
                  </span>
                ) : (
                  <button
                    onClick={() => invite(p.id)}
                    disabled={isLoading}
                    className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white transition-colors flex-shrink-0"
                  >
                    {isLoading ? '...' : 'Invite'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
