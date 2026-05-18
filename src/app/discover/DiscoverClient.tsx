'use client'

import { useState } from 'react'
import Link from 'next/link'

interface WagerCard {
  id: string
  title: string
  endDate: string | null
  pointThreshold: number
  stakeIfWorkers: string | null
  stakeIfMotivators: string | null
  players: string[]
  watchers: string[]
  isParticipant: boolean
  isFollowing: boolean
}

interface DraftCard {
  id: string
  name: string
  status: string
  pointGoal: number
  wagerDescription: string | null
  participantCount: number
  maxParticipants: number
  participants: string[]
  captainA: string | null
  captainB: string | null
  isParticipant: boolean
  isFollowing: boolean
}

interface PersonCard {
  id: string
  display_name: string
  username: string
  role: string
}

interface Props {
  wagerCards: WagerCard[]
  draftCards: DraftCard[]
  people: PersonCard[]
  currentUserId: string
}

const STATUS_LABEL: Record<string, string> = {
  recruiting: 'Recruiting',
  voting: 'Voting',
  drafting: 'Drafting',
  configuring: 'Configuring',
  active: 'Live',
}

const STATUS_COLOR: Record<string, string> = {
  recruiting: 'bg-blue-900/40 text-blue-400',
  voting: 'bg-purple-900/40 text-purple-400',
  drafting: 'bg-yellow-900/40 text-yellow-400',
  configuring: 'bg-orange-900/40 text-orange-400',
  active: 'bg-green-900/40 text-green-400',
}

function FollowButton({
  type,
  id,
  initial,
  isParticipant,
}: {
  type: 'wager' | 'draft'
  id: string
  initial: boolean
  isParticipant: boolean
}) {
  const [following, setFollowing] = useState(initial)
  const [loading, setLoading] = useState(false)

  if (isParticipant) {
    return (
      <span className="text-xs text-green-400 font-medium px-3 py-1.5 bg-green-900/30 rounded-xl">
        Joined
      </span>
    )
  }

  async function toggle() {
    setLoading(true)
    const res = await fetch('/api/follow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, id }),
    })
    const data = await res.json()
    if (res.ok) setFollowing(data.following)
    setLoading(false)
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors disabled:opacity-50 ${
        following
          ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          : 'bg-blue-600 hover:bg-blue-500 text-white'
      }`}
    >
      {loading ? '...' : following ? 'Following ✓' : '+ Follow'}
    </button>
  )
}

export default function DiscoverClient({ wagerCards, draftCards, people, currentUserId }: Props) {
  const [tab, setTab] = useState<'wagers' | 'drafts' | 'people'>('people')
  const [query, setQuery] = useState('')

  const totalWagers = wagerCards.length
  const totalDrafts = draftCards.length

  return (
    <div>
      {/* Tabs */}
      <div className="flex bg-gray-900 rounded-xl p-1 mb-5">
        <button
          onClick={() => setTab('people')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            tab === 'people' ? 'bg-green-500 text-black' : 'text-gray-400 hover:text-white'
          }`}
        >
          👥 People
        </button>
        <button
          onClick={() => setTab('wagers')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            tab === 'wagers' ? 'bg-green-500 text-black' : 'text-gray-400 hover:text-white'
          }`}
        >
          💰 Wagers
        </button>
        <button
          onClick={() => setTab('drafts')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            tab === 'drafts' ? 'bg-green-500 text-black' : 'text-gray-400 hover:text-white'
          }`}
        >
          🏆 Drafts
        </button>
      </div>

      {/* Wager Challenges */}
      {tab === 'wagers' && (
        <div className="space-y-3">
          {wagerCards.length === 0 ? (
            <div className="bg-gray-900 rounded-2xl p-8 text-center">
              <p className="text-4xl mb-3">💰</p>
              <p className="text-gray-400 text-sm">No active wager challenges right now.</p>
            </div>
          ) : (
            wagerCards.map(w => (
              <div key={w.id} className="bg-gray-900 rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-semibold text-sm truncate">{w.title}</h3>
                    <p className="text-gray-500 text-xs mt-0.5">Goal: {w.pointThreshold} pts</p>
                  </div>
                  <FollowButton type="wager" id={w.id} initial={w.isFollowing} isParticipant={w.isParticipant} />
                </div>

                {/* Participants */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {w.players.map((name, i) => (
                    <span key={i} className="text-xs bg-green-900/30 text-green-400 px-2 py-0.5 rounded-full">
                      🏋️ {name}
                    </span>
                  ))}
                  {w.watchers.map((name, i) => (
                    <span key={i} className="text-xs bg-purple-900/30 text-purple-400 px-2 py-0.5 rounded-full">
                      👀 {name}
                    </span>
                  ))}
                </div>

                {/* Stakes + end date */}
                <div className="flex items-center gap-3 text-xs text-gray-600">
                  {(w.stakeIfWorkers || w.stakeIfMotivators) && (
                    <span>💰 {w.stakeIfWorkers || w.stakeIfMotivators}</span>
                  )}
                  {w.endDate && (
                    <span>Ends {new Date(w.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  )}
                </div>

                {(w.isFollowing || w.isParticipant) && (
                  <Link
                    href="/wagers"
                    className="block text-center text-blue-400 text-xs mt-3 pt-3 border-t border-gray-800"
                  >
                    View details →
                  </Link>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Team Drafts */}
      {tab === 'drafts' && (
        <div className="space-y-3">
          {draftCards.length === 0 ? (
            <div className="bg-gray-900 rounded-2xl p-8 text-center">
              <p className="text-4xl mb-3">🏆</p>
              <p className="text-gray-400 text-sm">No draft competitions running yet.</p>
              <Link href="/draft/new" className="text-green-400 text-sm mt-2 block">
                Create one →
              </Link>
            </div>
          ) : (
            draftCards.map(c => (
              <div key={c.id} className="bg-gray-900 rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="text-white font-semibold text-sm truncate">{c.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_COLOR[c.status] || 'bg-gray-800 text-gray-500'}`}>
                        {STATUS_LABEL[c.status] || c.status}
                      </span>
                    </div>
                    <p className="text-gray-500 text-xs">Goal: {c.pointGoal} pts · {c.participantCount}/{c.maxParticipants} players</p>
                  </div>
                  <FollowButton type="draft" id={c.id} initial={c.isFollowing} isParticipant={c.isParticipant} />
                </div>

                {/* Participants */}
                {c.status === 'active' && c.captainA && c.captainB ? (
                  <div className="flex gap-2 mb-3">
                    <div className="flex-1 bg-blue-900/20 rounded-xl px-3 py-2">
                      <p className="text-blue-400 text-xs font-medium truncate">Team {c.captainA}</p>
                    </div>
                    <div className="flex-1 bg-red-900/20 rounded-xl px-3 py-2">
                      <p className="text-red-400 text-xs font-medium truncate">Team {c.captainB}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {c.participants.map((name, i) => (
                      <span key={i} className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
                        {name}
                      </span>
                    ))}
                    {c.participantCount < c.maxParticipants && (
                      <span className="text-xs bg-gray-800/50 text-gray-600 px-2 py-0.5 rounded-full border border-dashed border-gray-700">
                        +{c.maxParticipants - c.participantCount} spots open
                      </span>
                    )}
                  </div>
                )}

                {c.wagerDescription && (
                  <p className="text-xs text-amber-500 mb-2">💰 {c.wagerDescription}</p>
                )}

                {(c.isFollowing || c.isParticipant) && (
                  <Link
                    href={`/draft/${c.id}`}
                    className="block text-center text-blue-400 text-xs mt-3 pt-3 border-t border-gray-800"
                  >
                    View competition →
                  </Link>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* People Search */}
      {tab === 'people' && (
        <div className="space-y-3">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by name or username…"
              className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-9 pr-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-green-500"
            />
          </div>

          {people
            .filter(p => {
              if (!query.trim()) return true
              const q = query.toLowerCase()
              return p.display_name.toLowerCase().includes(q) || p.username.toLowerCase().includes(q)
            })
            .map(p => {
              const initials = p.display_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
              return (
                <Link key={p.id} href={`/player/${p.username}`} className="flex items-center gap-3 bg-gray-900 hover:bg-gray-800 rounded-2xl p-4 transition-colors">
                  <div className="w-11 h-11 rounded-xl bg-gray-700 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm">{p.display_name}</p>
                    <p className="text-gray-500 text-xs">@{p.username} · {p.role}</p>
                  </div>
                  <span className="text-gray-600 text-sm">→</span>
                </Link>
              )
            })
          }

          {people.filter(p => {
            if (!query.trim()) return false
            const q = query.toLowerCase()
            return p.display_name.toLowerCase().includes(q) || p.username.toLowerCase().includes(q)
          }).length === 0 && query.trim() && (
            <div className="bg-gray-900 rounded-2xl p-8 text-center">
              <p className="text-gray-500 text-sm">No one found matching "{query}"</p>
            </div>
          )}

          {people.length === 0 && (
            <div className="bg-gray-900 rounded-2xl p-8 text-center">
              <p className="text-4xl mb-3">👥</p>
              <p className="text-gray-400 text-sm">No other players yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
