'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate, cn } from '@/lib/utils'
import { WEEKLY_GOAL } from '@/lib/points'
import type { Profile } from '@/lib/types'

const CONDITION_SHORT: Record<string, string> = {
  team_challenge: 'Team loses if either player misses',
  both_fail: 'Both must miss',
  either_fails: 'Either misses',
  one_fails: 'One specific player misses',
  custom: 'Custom',
}

interface Props {
  currentUserId: string
  allProfiles: Profile[]
  weekStart: string
}

// ── Countdown Timer ──────────────────────────────────────────────────────────
function CountdownTimer({ endDate }: { endDate: string }) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const total = new Date(endDate + 'T23:59:59').getTime() - Date.now()
  if (total <= 0) return <span className="text-red-400 text-xs font-bold">Challenge ended — resolving...</span>

  const days = Math.floor(total / 86400000)
  const hours = Math.floor((total % 86400000) / 3600000)
  const minutes = Math.floor((total % 3600000) / 60000)
  const seconds = Math.floor((total % 60000) / 1000)

  return (
    <div className="flex items-center gap-1 mt-2">
      {[{ v: days, l: 'd' }, { v: hours, l: 'h' }, { v: minutes, l: 'm' }, { v: seconds, l: 's' }].map(({ v, l }, i) => (
        <span key={l} className="flex items-center gap-0.5">
          {i > 0 && <span className="text-gray-600 text-xs mx-0.5">:</span>}
          <span className="bg-gray-800 px-1.5 py-0.5 rounded text-white font-mono text-sm font-bold min-w-[24px] text-center">
            {String(v).padStart(2, '0')}
          </span>
          <span className="text-gray-500 text-xs">{l}</span>
        </span>
      ))}
    </div>
  )
}

// ── Trophy Cabinet ───────────────────────────────────────────────────────────
function TrophyCabinet({ wagers, currentUserId, allProfiles }: {
  wagers: any[]
  currentUserId: string
  allProfiles: Profile[]
}) {
  const resolved = wagers.filter(w => w.status === 'resolved' && w.winner)
  if (resolved.length === 0) return null

  const competitorWins = resolved.filter(w => w.winner === 'competitors').length
  const partnerWins = resolved.filter(w => w.winner === 'partners').length

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-white font-semibold">Trophy Cabinet 🏆</h2>
        <span className="text-xs text-gray-500 ml-auto">
          {competitorWins > partnerWins
            ? <span className="text-green-400 font-medium">Team leading {competitorWins}–{partnerWins}</span>
            : competitorWins < partnerWins
            ? <span className="text-purple-400 font-medium">Partners leading {partnerWins}–{competitorWins}</span>
            : <span className="text-yellow-400 font-medium">Tied {competitorWins}–{partnerWins}</span>}
        </span>
      </div>

      {/* Win/loss scoreboard */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-green-900/20 border border-green-700/30 rounded-2xl p-4 text-center">
          <p className="text-3xl font-black text-green-400">{competitorWins}</p>
          <p className="text-xs text-gray-400 mt-1">Team Wins 🏋️</p>
        </div>
        <div className="bg-purple-900/20 border border-purple-700/30 rounded-2xl p-4 text-center">
          <p className="text-3xl font-black text-purple-400">{partnerWins}</p>
          <p className="text-xs text-gray-400 mt-1">Partner Wins 💅</p>
        </div>
      </div>

      <div className="space-y-2">
        {resolved.map(wager => {
          const teamWon = wager.winner === 'competitors'
          const teamPlayers = allProfiles.filter(p => (wager.team_player_ids || []).includes(p.id))
          return (
            <div key={wager.id} className={cn(
              'rounded-2xl p-4 border',
              teamWon ? 'bg-green-900/10 border-green-800/40' : 'bg-purple-900/10 border-purple-800/40'
            )}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{teamWon ? '🏆' : '💅'}</span>
                    <p className="text-white font-semibold text-sm">{wager.title}</p>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {wager.week_start}{wager.end_date ? ` → ${wager.end_date}` : ''} · {formatDate(wager.resolved_at || wager.created_at)}
                  </p>
                  {teamPlayers.length > 0 && (
                    <p className="text-xs text-gray-600 mt-0.5">
                      🏋️ {teamPlayers.map(p => p.display_name).join(', ')}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className={cn('text-xs font-bold', teamWon ? 'text-green-400' : 'text-purple-400')}>
                    {teamWon ? 'TEAM WON' : 'PARTNERS WON'}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {teamWon ? wager.stake_if_competitors_win : wager.stake_if_partners_win}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Wager Card ───────────────────────────────────────────────────────────────
function WagerCard({ wager, currentUserId, onResolve, onDelete, onAccept, allProfiles }: {
  wager: any
  currentUserId: string
  onResolve: (id: string, winner: 'competitors' | 'partners') => void
  onDelete: (id: string) => void
  onAccept: (id: string) => void
  allProfiles: Profile[]
}) {
  const isTeamChallenge = wager.condition_type === 'team_challenge'
  const teamPlayers = allProfiles.filter(p => (wager.team_player_ids || []).includes(p.id))
  const watchers = allProfiles.filter(p => (wager.watcher_ids || []).includes(p.id))
  const acceptedIds = (wager.wager_acceptances || []).map((a: any) => a.user_id)
  const isProposerSelf = wager.proposed_by === currentUserId
  const hasAccepted = acceptedIds.includes(currentUserId)
  // Anyone except the proposer can accept/decline a pending wager
  const canRespond = wager.status === 'pending' && !isProposerSelf && !hasAccepted

  return (
    <div className={cn(
      'bg-gray-900 border rounded-2xl p-4',
      wager.status === 'active' ? 'border-yellow-700/50' :
      wager.status === 'pending' ? 'border-blue-700/50' : 'border-gray-700'
    )}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 pr-2">
          <div className="flex items-center gap-2 flex-wrap">
            {isTeamChallenge && <span>🤝</span>}
            <h3 className="text-white font-semibold">{wager.title}</h3>
            {isTeamChallenge && (
              <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full">Team</span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Proposed by {wager.profiles?.display_name} · {formatDate(wager.created_at)}
          </p>
          {wager.end_date && (
            <p className="text-xs text-gray-600 mt-0.5">📅 {wager.week_start} → {wager.end_date}</p>
          )}
        </div>
        <span className={cn('text-xs px-2 py-1 rounded-full font-medium shrink-0',
          wager.status === 'active' ? 'bg-green-900/40 text-green-400' :
          wager.status === 'pending' ? 'bg-blue-900/40 text-blue-400' :
          'bg-gray-800 text-gray-500'
        )}>
          {wager.status === 'active' ? '🔥 Active' : wager.status === 'pending' ? '⏳ Pending' : wager.status}
        </span>
      </div>

      {/* Countdown for active wagers */}
      {wager.status === 'active' && wager.end_date && (
        <div className="bg-gray-800/60 rounded-xl px-3 py-2 mb-3">
          <p className="text-xs text-gray-500 mb-1">Time remaining</p>
          <CountdownTimer endDate={wager.end_date} />
        </div>
      )}

      {/* Pending acceptance status */}
      {wager.status === 'pending' && (teamPlayers.length > 0 || watchers.length > 0) && (
        <div className="bg-blue-900/20 border border-blue-700/30 rounded-xl p-3 mb-3">
          <p className="text-xs text-blue-300 font-medium mb-2">Waiting for everyone to accept...</p>
          <div className="space-y-1">
            {[
              ...teamPlayers.map(p => ({ ...p, role: '🏋️' })),
              ...watchers.map(p => ({ ...p, role: '💅' })),
            ].map(p => {
              const accepted = acceptedIds.includes(p.id)
              return (
                <div key={p.id} className="flex items-center gap-2">
                  <span className={accepted ? 'text-green-400' : 'text-gray-600'}>{accepted ? '✓' : '○'}</span>
                  <span className="text-xs text-gray-500">{p.role}</span>
                  <span className={cn('text-xs', accepted ? 'text-green-300' : 'text-gray-400')}>{p.display_name}</span>
                  {accepted && <span className="text-xs text-gray-600">in</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Participants */}
      {(teamPlayers.length > 0 || watchers.length > 0) && (
        <div className="bg-gray-800/60 rounded-xl p-3 mb-3 space-y-2">
          {teamPlayers.length > 0 && (
            <div className="flex items-start gap-2">
              <span className="text-xs text-gray-500 shrink-0 mt-0.5">🏋️ Team:</span>
              <div className="flex flex-wrap gap-1">
                {teamPlayers.map(p => (
                  <span key={p.id} className="text-xs bg-green-900/40 text-green-300 px-2 py-0.5 rounded-full">{p.display_name}</span>
                ))}
              </div>
            </div>
          )}
          {watchers.length > 0 && (
            <div className="flex items-start gap-2">
              <span className="text-xs text-gray-500 shrink-0 mt-0.5">💅 Partners:</span>
              <div className="flex flex-wrap gap-1">
                {watchers.map(p => (
                  <span key={p.id} className="text-xs bg-purple-900/40 text-purple-300 px-2 py-0.5 rounded-full">{p.display_name}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {wager.description && <p className="text-gray-400 text-sm mb-3">{wager.description}</p>}

      {/* Condition */}
      {isTeamChallenge ? (
        <div className="bg-orange-900/20 border border-orange-700/30 rounded-xl p-3 mb-3">
          <p className="text-xs text-orange-300 font-medium mb-1">⚡ Team Challenge</p>
          <p className="text-xs text-gray-400">
            All team members must hit <span className="text-white font-semibold">{wager.point_threshold} pts</span>.
            If <span className="text-white font-semibold">anyone</span> falls short — partners win.
          </p>
        </div>
      ) : (
        <p className="text-xs text-gray-500 mb-3">{CONDITION_SHORT[wager.condition_type]} · {wager.point_threshold} pts</p>
      )}

      {/* Stakes */}
      <div className="space-y-1 mb-3">
        <p className="text-xs"><span className="text-gray-500">💅 Partners win: </span><span className="text-red-400 font-medium">{wager.stake_if_partners_win}</span></p>
        <p className="text-xs"><span className="text-gray-500">🏆 Team wins: </span><span className="text-green-400 font-medium">{wager.stake_if_competitors_win}</span></p>
      </div>

      {/* Resolved result */}
      {wager.status === 'resolved' && wager.winner && (
        <div className={cn('text-center py-3 rounded-xl text-sm font-bold mb-3',
          wager.winner === 'competitors' ? 'bg-green-900/40 text-green-400' : 'bg-purple-900/40 text-purple-400'
        )}>
          {wager.winner === 'competitors' ? '🏆 Team won!' : '💅 Partners won!'}
        </div>
      )}

      {/* Accept / Decline buttons */}
      {canRespond && (
        <div className="flex gap-2 mb-2">
          <button onClick={() => onAccept(wager.id)}
            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-1">
            🤝 Accept
          </button>
          <button onClick={() => onDelete(wager.id)}
            className="flex-1 bg-gray-800 hover:bg-red-900/40 text-gray-400 hover:text-red-400 border border-gray-700 hover:border-red-700 font-bold py-3 rounded-xl text-sm transition-colors">
            ✕ Decline
          </button>
        </div>
      )}
      {wager.status === 'pending' && isProposerSelf && (
        <p className="text-xs text-gray-600 text-center mb-2">Waiting for others to accept...</p>
      )}

      {/* Proposer controls */}
      {isProposerSelf && (
        <div className="flex gap-2 mt-1">
          {wager.status === 'active' && (<>
            <button onClick={() => onResolve(wager.id, 'competitors')}
              className="flex-1 bg-green-900/40 hover:bg-green-800 text-green-400 border border-green-700 py-2 rounded-xl text-xs font-medium transition-colors">
              Team won ✓
            </button>
            <button onClick={() => onResolve(wager.id, 'partners')}
              className="flex-1 bg-red-900/40 hover:bg-red-800 text-red-400 border border-red-700 py-2 rounded-xl text-xs font-medium transition-colors">
              Partners won 💅
            </button>
          </>)}
          <button onClick={() => onDelete(wager.id)}
            className="bg-gray-800 hover:bg-gray-700 text-gray-500 hover:text-red-400 border border-gray-700 px-3 py-2 rounded-xl text-xs transition-colors">
            🗑
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function WagersClient({ currentUserId, allProfiles, weekStart }: Props) {
  const [wagers, setWagers] = useState<any[]>([])
  const [fetching, setFetching] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [conditionType, setConditionType] = useState('team_challenge')
  const [pointThreshold, setPointThreshold] = useState(WEEKLY_GOAL)
  const [stakeIfPartnersWin, setStakeIfPartnersWin] = useState('')
  const [stakeIfCompetitorsWin, setStakeIfCompetitorsWin] = useState('')
  const [teamPlayerIds, setTeamPlayerIds] = useState<string[]>([currentUserId])
  const [watcherIds, setWatcherIds] = useState<string[]>([])
  const defaultEndDate = new Date(new Date(weekStart).getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const [endDate, setEndDate] = useState(defaultEndDate)

  const fetchWagers = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('wagers')
      .select('*, profiles!wagers_proposed_by_fkey(display_name, username), wager_acceptances(user_id)')
      .order('created_at', { ascending: false })
    if (error) { setError('Fetch error: ' + error.message); setFetching(false); return }

    // Auto-resolve expired active wagers
    const today = new Date().toISOString().split('T')[0]
    const expired = (data || []).filter(w =>
      w.status === 'active' && w.end_date && w.end_date < today && (w.team_player_ids || []).length > 0
    )
    for (const wager of expired) {
      const { data: workouts } = await supabase
        .from('workouts').select('user_id, points')
        .in('user_id', wager.team_player_ids)
        .gte('logged_at', wager.week_start)
        .lte('logged_at', wager.end_date + 'T23:59:59.999Z')
      const pts: Record<string, number> = {}
      for (const w of (workouts || [])) pts[w.user_id] = (pts[w.user_id] || 0) + w.points
      const allWon = wager.team_player_ids.every((id: string) => (pts[id] || 0) >= wager.point_threshold)
      await supabase.from('wagers').update({
        status: 'resolved',
        winner: allWon ? 'competitors' : 'partners',
        resolved_at: new Date().toISOString(),
      }).eq('id', wager.id)
    }

    if (expired.length > 0) {
      const { data: refreshed } = await supabase
        .from('wagers')
        .select('*, profiles!wagers_proposed_by_fkey(display_name, username), wager_acceptances(user_id)')
        .order('created_at', { ascending: false })
      setWagers(refreshed || [])
    } else {
      setWagers(data || [])
    }
    setFetching(false)
  }, [])

  useEffect(() => { fetchWagers() }, [fetchWagers])

  function togglePlayer(id: string, side: 'team' | 'watcher') {
    if (side === 'team') {
      setTeamPlayerIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
      setWatcherIds(prev => prev.filter(x => x !== id))
    } else {
      setWatcherIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
      setTeamPlayerIds(prev => prev.filter(x => x !== id))
    }
  }

  function getSide(id: string): 'team' | 'watcher' | null {
    if (teamPlayerIds.includes(id)) return 'team'
    if (watcherIds.includes(id)) return 'watcher'
    return null
  }

  async function handleCreateWager(e: React.FormEvent) {
    e.preventDefault()
    if (teamPlayerIds.length === 0) { setError('Select at least one player on the competing team.'); return }
    setLoading(true)
    setError('')

    const supabase = createClient()
    const otherTeamPlayers = teamPlayerIds.filter(id => id !== currentUserId)
    const needsAcceptance = otherTeamPlayers.length > 0

    const { data: inserted, error: insertError } = await supabase.from('wagers').insert({
      title,
      description: description || null,
      proposed_by: currentUserId,
      condition_type: conditionType,
      point_threshold: pointThreshold,
      week_start: weekStart.split('T')[0],
      end_date: endDate,
      stake_if_partners_win: stakeIfPartnersWin,
      stake_if_competitors_win: stakeIfCompetitorsWin,
      team_player_ids: teamPlayerIds,
      watcher_ids: watcherIds,
      status: needsAcceptance ? 'pending' : 'active',
    }).select().single()

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

    // Auto-accept for proposer
    if (inserted) {
      await supabase.from('wager_acceptances').insert({
        wager_id: inserted.id,
        user_id: currentUserId,
      })
    }

    setShowForm(false)
    setTitle(''); setDescription(''); setStakeIfPartnersWin(''); setStakeIfCompetitorsWin('')
    setTeamPlayerIds([currentUserId]); setWatcherIds([]); setEndDate(defaultEndDate)
    setLoading(false)
    await fetchWagers()
  }

  async function handleAccept(wagerId: string) {
    const supabase = createClient()
    await supabase.from('wager_acceptances').insert({ wager_id: wagerId, user_id: currentUserId })

    const wager = wagers.find(w => w.id === wagerId)
    const { data: acceptances } = await supabase
      .from('wager_acceptances').select('user_id').eq('wager_id', wagerId)
    const acceptedIds = (acceptances || []).map((a: any) => a.user_id)
    const everyone = [...(wager?.team_player_ids || []), ...(wager?.watcher_ids || [])]
    const allAccepted = everyone.every((id: string) => acceptedIds.includes(id))
    if (allAccepted) {
      await supabase.from('wagers').update({ status: 'active' }).eq('id', wagerId)
    }
    await fetchWagers()
  }

  async function handleResolve(wagerId: string, winner: 'competitors' | 'partners') {
    const supabase = createClient()
    await supabase.from('wagers').update({
      status: 'resolved', winner, resolved_at: new Date().toISOString(),
    }).eq('id', wagerId)
    await fetchWagers()
  }

  async function handleDelete(wagerId: string) {
    if (!confirm('Delete this wager?')) return
    const supabase = createClient()
    await supabase.from('wagers').delete().eq('id', wagerId)
    await fetchWagers()
  }

  const pendingWagers = wagers.filter(w => w.status === 'pending')
  const activeWagers = wagers.filter(w => w.status === 'active')
  const resolvedWagers = wagers.filter(w => w.status === 'resolved' || w.status === 'expired')

  return (
    <div className="space-y-6">
      <button
        onClick={() => setShowForm(!showForm)}
        className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-xl transition-colors"
      >
        {showForm ? 'Cancel' : '+ Propose a Wager'}
      </button>

      {showForm && (
        <form onSubmit={handleCreateWager} className="bg-gray-900 rounded-2xl p-5 space-y-5">
          <h2 className="text-white font-bold text-lg">New Wager</h2>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Title</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Week 3 Team Challenge" required
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-yellow-500 transition-colors" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Start Date</label>
              <input type="date" value={weekStart.split('T')[0]} readOnly
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-gray-400 focus:outline-none cursor-not-allowed" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">End Date</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                min={weekStart.split('T')[0]} required
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500 transition-colors" />
            </div>
          </div>

          {/* Participant assignment */}
          <div>
            <label className="block text-sm text-gray-400 mb-3">Assign Participants</label>
            <div className="space-y-2">
              {allProfiles.map(p => {
                const side = getSide(p.id)
                return (
                  <div key={p.id} className="bg-gray-800 rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <p className="text-white text-sm font-medium">{p.display_name}</p>
                      <p className="text-gray-500 text-xs">@{p.username}</p>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => togglePlayer(p.id, 'team')}
                        className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                          side === 'team' ? 'bg-green-500 text-black' : 'bg-gray-700 text-gray-400 hover:bg-gray-600')}>
                        🏋️ Competing
                      </button>
                      <button type="button" onClick={() => togglePlayer(p.id, 'watcher')}
                        className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                          side === 'watcher' ? 'bg-purple-500 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600')}>
                        💅 Partner
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Win condition */}
          <div>
            <label className="block text-sm text-gray-400 mb-3">Win Condition</label>
            <div className="space-y-2">
              <button type="button" onClick={() => setConditionType('team_challenge')}
                className={`w-full p-3 rounded-xl border-2 text-left transition-colors ${conditionType === 'team_challenge' ? 'border-orange-500 bg-orange-500/10' : 'border-gray-700 bg-gray-800'}`}>
                <div className="flex items-center gap-2">
                  <span>🤝</span>
                  <span className="text-white text-sm font-medium">Team Challenge</span>
                  <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full ml-auto">Popular</span>
                </div>
                <p className="text-xs text-gray-400 mt-1 ml-6">Partners win if <strong className="text-white">either</strong> player misses the goal</p>
              </button>
              <div className="grid grid-cols-2 gap-2">
                {(['both_fail', 'either_fails', 'one_fails', 'custom'] as const).map(type => (
                  <button key={type} type="button" onClick={() => setConditionType(type)}
                    className={`p-3 rounded-xl border-2 text-left transition-colors ${conditionType === type ? 'border-yellow-500 bg-yellow-500/10' : 'border-gray-700 bg-gray-800'}`}>
                    <p className="text-white text-xs font-medium">{CONDITION_SHORT[type]}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Point threshold */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Goal: <span className="text-white font-semibold">{pointThreshold} pts each</span>
            </label>
            <input type="range" min={20} max={150} step={5} value={pointThreshold}
              onChange={e => setPointThreshold(Number(e.target.value))}
              className="w-full accent-yellow-500" />
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>20 (easy)</span><span>50 (default)</span><span>150 (beast)</span>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">💅 If the partners win...</label>
            <input type="text" value={stakeIfPartnersWin} onChange={e => setStakeIfPartnersWin(e.target.value)}
              placeholder="e.g. Buy her a bouquet of flowers" required
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-yellow-500 transition-colors" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">🏆 If the team wins...</label>
            <input type="text" value={stakeIfCompetitorsWin} onChange={e => setStakeIfCompetitorsWin(e.target.value)}
              placeholder="e.g. Wives cook dinner all week" required
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-yellow-500 transition-colors" />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Notes (optional)</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Any other details..." rows={2}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-yellow-500 transition-colors resize-none" />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:bg-yellow-900 text-black font-bold py-3 rounded-xl transition-colors">
            {loading ? 'Creating...' : 'Propose Wager 🤝'}
          </button>
        </form>
      )}

      {fetching && (
        <div className="text-center py-8 text-gray-500 text-sm">Loading...</div>
      )}

      {/* Pending challenges */}
      {!fetching && pendingWagers.length > 0 && (
        <div>
          <h2 className="text-white font-semibold mb-3">Pending Challenges ⏳</h2>
          <div className="space-y-3">
            {pendingWagers.map(wager => (
              <WagerCard key={wager.id} wager={wager} currentUserId={currentUserId}
                onResolve={handleResolve} onDelete={handleDelete} onAccept={handleAccept}
                allProfiles={allProfiles} />
            ))}
          </div>
        </div>
      )}

      {/* Active wagers */}
      {!fetching && activeWagers.length > 0 && (
        <div>
          <h2 className="text-white font-semibold mb-3">Active Challenges 🔥</h2>
          <div className="space-y-3">
            {activeWagers.map(wager => (
              <WagerCard key={wager.id} wager={wager} currentUserId={currentUserId}
                onResolve={handleResolve} onDelete={handleDelete} onAccept={handleAccept}
                allProfiles={allProfiles} />
            ))}
          </div>
        </div>
      )}

      {/* Trophy cabinet */}
      {!fetching && resolvedWagers.length > 0 && (
        <TrophyCabinet wagers={resolvedWagers} currentUserId={currentUserId} allProfiles={allProfiles} />
      )}

      {!fetching && wagers.length === 0 && !showForm && (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">🤝</p>
          <p className="text-gray-400">No wagers yet.</p>
          <p className="text-gray-600 text-sm mt-1">Propose one to raise the stakes!</p>
        </div>
      )}
    </div>
  )
}
