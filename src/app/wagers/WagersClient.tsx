'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate, cn } from '@/lib/utils'
import { WEEKLY_GOAL } from '@/lib/points'
import { getTodayEastern, getEndOfDayEasternISO, getEasternOffsetHours } from '@/lib/timezone'
import type { Profile } from '@/lib/types'
import CommentsSection from '@/components/CommentsSection'

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

// ── Create debt record when a wager resolves ─────────────────────────────────
async function createDebtRecord(supabase: ReturnType<typeof createClient>, wager: any, winner: 'competitors' | 'partners') {
  const debtorIds = winner === 'competitors' ? (wager.watcher_ids || []) : (wager.team_player_ids || [])
  const creditorIds = winner === 'competitors' ? (wager.team_player_ids || []) : (wager.watcher_ids || [])
  const description = winner === 'competitors' ? wager.stake_if_competitors_win : wager.stake_if_partners_win
  if (debtorIds.length === 0 || creditorIds.length === 0 || !description) return
  // Unique constraint on wager_id — silently no-ops if already exists
  await supabase.from('wager_debts').insert({
    wager_id: wager.id,
    wager_title: wager.title,
    debtor_ids: debtorIds,
    creditor_ids: creditorIds,
    description,
    status: 'outstanding',
  }).select()
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

// ── Debt Tracker ─────────────────────────────────────────────────────────────
function DebtTracker({ debts, currentUserId, allProfiles, onSettle }: {
  debts: any[]
  currentUserId: string
  allProfiles: Profile[]
  onSettle: (id: string) => void
}) {
  const profileMap = Object.fromEntries(allProfiles.map(p => [p.id, p]))
  const outstanding = debts.filter(d => d.status === 'outstanding')
  const settled = debts.filter(d => d.status === 'paid')

  if (debts.length === 0) return null

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-white font-semibold flex items-center gap-2">
          💸 Debt Ledger
          {outstanding.length > 0 && (
            <span className="text-xs bg-red-900/50 text-red-400 px-2 py-0.5 rounded-full font-medium">
              {outstanding.length} outstanding
            </span>
          )}
        </h2>
      </div>

      {outstanding.length > 0 && (
        <div className="space-y-3 mb-4">
          {outstanding.map(debt => {
            const iAmDebtor = (debt.debtor_ids || []).includes(currentUserId)
            const debtorNames = (debt.debtor_ids || [])
              .map((id: string) => id === currentUserId ? 'You' : profileMap[id]?.display_name?.split(' ')[0] || '?')
              .join(' & ')
            const creditorNames = (debt.creditor_ids || [])
              .map((id: string) => id === currentUserId ? 'you' : profileMap[id]?.display_name?.split(' ')[0] || '?')
              .join(' & ')

            return (
              <div key={debt.id} className={cn(
                'rounded-2xl border p-4',
                iAmDebtor
                  ? 'bg-red-900/15 border-red-700/50'
                  : 'bg-green-900/15 border-green-700/50'
              )}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{iAmDebtor ? '😬' : '😤'}</span>
                      <p className={cn('text-sm font-bold', iAmDebtor ? 'text-red-300' : 'text-green-300')}>
                        {iAmDebtor ? `You owe ${creditorNames}` : `${debtorNames} owe${debtorNames === 'You' ? '' : 's'} ${creditorNames}`}
                      </p>
                    </div>
                    <p className="text-white text-sm font-medium ml-8">"{debt.description}"</p>
                    <p className="text-gray-600 text-xs ml-8 mt-0.5">From: {debt.wager_title}</p>
                  </div>
                  <button
                    onClick={() => onSettle(debt.id)}
                    className="shrink-0 bg-gray-800 hover:bg-green-900/40 border border-gray-700 hover:border-green-700 text-gray-400 hover:text-green-400 text-xs px-3 py-1.5 rounded-lg transition-colors"
                  >
                    ✓ Settled
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {outstanding.length === 0 && (
        <div className="bg-green-900/15 border border-green-700/30 rounded-2xl p-4 text-center mb-4">
          <p className="text-green-400 text-sm font-medium">✓ All debts settled — you're clean 💅</p>
        </div>
      )}

      {settled.length > 0 && (
        <details className="group">
          <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-400 transition-colors list-none flex items-center gap-1 mb-2">
            <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
            {settled.length} settled debt{settled.length === 1 ? '' : 's'}
          </summary>
          <div className="space-y-2">
            {settled.map(debt => {
              const iAmDebtor = (debt.debtor_ids || []).includes(currentUserId)
              const debtorNames = (debt.debtor_ids || [])
                .map((id: string) => id === currentUserId ? 'You' : profileMap[id]?.display_name?.split(' ')[0] || '?')
                .join(' & ')
              const creditorNames = (debt.creditor_ids || [])
                .map((id: string) => id === currentUserId ? 'you' : profileMap[id]?.display_name?.split(' ')[0] || '?')
                .join(' & ')
              return (
                <div key={debt.id} className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-3 opacity-60">
                  <p className="text-xs text-gray-500 line-through">
                    {iAmDebtor ? `You owed ${creditorNames}` : `${debtorNames} owed ${creditorNames}`}: "{debt.description}"
                  </p>
                  <p className="text-xs text-green-700 mt-0.5">✓ Settled · {debt.wager_title}</p>
                </div>
              )
            })}
          </div>
        </details>
      )}
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
                    {new Date(wager.week_start).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' })}{wager.end_date ? ` → ${new Date(wager.end_date).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' })}` : ''} · {formatDate(wager.resolved_at || wager.created_at)}
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
function WagerCard({ wager, currentUserId, onResolve, onDelete, onAccept, onDoubleDownOffer, onDoubleDownRespond, allProfiles }: {
  wager: any
  currentUserId: string
  onResolve: (id: string, winner: 'competitors' | 'partners') => void
  onDelete: (id: string) => void
  onAccept: (id: string) => void
  onDoubleDownOffer: (id: string, extraMotivator: string, extraWorker: string) => void
  onDoubleDownRespond: (id: string, accept: boolean) => void
  allProfiles: Profile[]
}) {
  const isTeamChallenge = wager.condition_type === 'team_challenge'
  const teamPlayers = allProfiles.filter(p => (wager.team_player_ids || []).includes(p.id))
  const watchers = allProfiles.filter(p => (wager.watcher_ids || []).includes(p.id))
  const acceptedIds = (wager.wager_acceptances || []).map((a: any) => a.user_id)
  const isProposerSelf = wager.proposed_by === currentUserId
  const hasAccepted = acceptedIds.includes(currentUserId)
  const canRespond = wager.status === 'pending' && !isProposerSelf && !hasAccepted
  const isWorker = (wager.team_player_ids || []).includes(currentUserId)
  const isMotivator = (wager.watcher_ids || []).includes(currentUserId)
  const [showDDForm, setShowDDForm] = useState(false)
  const [ddExtraMotivator, setDDExtraMotivator] = useState('')
  const [ddExtraWorker, setDDExtraWorker] = useState('')

  return (
    <div className={cn(
      'bg-gray-900 border rounded-2xl p-4',
      wager.status === 'active' ? 'border-yellow-700/50' :
      wager.status === 'pending' ? 'border-blue-700/50' : 'border-gray-700'
    )}>
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
            <p className="text-xs text-gray-600 mt-0.5">
              📅 {new Date(wager.week_start).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' })} → {new Date(wager.end_date).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' })}
            </p>
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

      {wager.status === 'active' && wager.end_date && (
        <div className="bg-gray-800/60 rounded-xl px-3 py-2 mb-3">
          <p className="text-xs text-gray-500 mb-1">Time remaining</p>
          <CountdownTimer endDate={wager.end_date} />
        </div>
      )}

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
                </div>
              )
            })}
          </div>
        </div>
      )}

      {(teamPlayers.length > 0 || watchers.length > 0) && (
        <div className="bg-gray-800/60 rounded-xl p-3 mb-3 space-y-2">
          {teamPlayers.length > 0 && (
            <div className="flex items-start gap-2">
              <span className="text-xs text-gray-500 shrink-0 mt-0.5">🏋️ Workers:</span>
              <div className="flex flex-wrap gap-1">
                {teamPlayers.map(p => (
                  <span key={p.id} className="text-xs bg-green-900/40 text-green-300 px-2 py-0.5 rounded-full">{p.display_name}</span>
                ))}
              </div>
            </div>
          )}
          {watchers.length > 0 && (
            <div className="flex items-start gap-2">
              <span className="text-xs text-gray-500 shrink-0 mt-0.5">💅 Motivators:</span>
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

      {isTeamChallenge ? (
        <div className="bg-orange-900/20 border border-orange-700/30 rounded-xl p-3 mb-3">
          <p className="text-xs text-orange-300 font-medium mb-1">⚡ Team Challenge</p>
          <p className="text-xs text-gray-400">
            All workers must hit <span className="text-white font-semibold">{wager.point_threshold} pts</span>.
            If <span className="text-white font-semibold">anyone</span> falls short — motivators win.
          </p>
        </div>
      ) : (
        <p className="text-xs text-gray-500 mb-3">{CONDITION_SHORT[wager.condition_type]} · {wager.point_threshold} pts</p>
      )}

      <div className="space-y-1 mb-3">
        <p className="text-xs"><span className="text-gray-500">💅 Motivators win: </span><span className="text-red-400 font-medium">{wager.stake_if_partners_win}</span></p>
        <p className="text-xs"><span className="text-gray-500">🏆 Workers win: </span><span className="text-green-400 font-medium">{wager.stake_if_competitors_win}</span></p>
      </div>

      {wager.status === 'active' && (
        <>
          {isMotivator && !wager.double_down_status && (
            <div className="mb-3">
              {!showDDForm ? (
                <button onClick={() => setShowDDForm(true)}
                  className="w-full bg-purple-900/30 hover:bg-purple-900/50 border border-purple-700/40 text-purple-300 text-xs font-bold py-2 rounded-xl transition-colors">
                  💰 Offer Double Down
                </button>
              ) : (
                <div className="bg-purple-900/20 border border-purple-700/40 rounded-xl p-3 space-y-2">
                  <p className="text-purple-300 text-xs font-bold">⚡ Double Down Offer</p>
                  <input type="text" value={ddExtraMotivator} onChange={e => setDDExtraMotivator(e.target.value)}
                    placeholder="Extra prize if they LOSE (you get)..."
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-purple-500" />
                  <input type="text" value={ddExtraWorker} onChange={e => setDDExtraWorker(e.target.value)}
                    placeholder="Extra prize if they WIN (you owe)..."
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-purple-500" />
                  <div className="flex gap-2">
                    <button
                      onClick={() => { onDoubleDownOffer(wager.id, ddExtraMotivator, ddExtraWorker); setShowDDForm(false) }}
                      disabled={!ddExtraMotivator || !ddExtraWorker}
                      className="flex-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-bold py-2 rounded-lg transition-colors">
                      Send Offer 🔥
                    </button>
                    <button onClick={() => setShowDDForm(false)}
                      className="flex-1 bg-gray-800 text-gray-400 text-xs py-2 rounded-lg">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {isWorker && wager.double_down_status === 'offered' && (
            <div className="bg-yellow-900/20 border border-yellow-600/40 rounded-xl p-3 mb-3">
              <p className="text-yellow-300 text-xs font-bold mb-1">⚡ Double Down Offered!</p>
              <p className="text-xs text-gray-400 mb-1">If you <span className="text-red-400 font-medium">lose</span>: motivators also get <span className="text-white font-medium">{wager.double_down_extra_motivator}</span></p>
              <p className="text-xs text-gray-400 mb-2">If you <span className="text-green-400 font-medium">win</span>: you also get <span className="text-white font-medium">{wager.double_down_extra_worker}</span></p>
              <div className="flex gap-2">
                <button onClick={() => onDoubleDownRespond(wager.id, true)}
                  className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-white text-xs font-bold py-2 rounded-lg transition-colors">
                  Accept 🔥
                </button>
                <button onClick={() => onDoubleDownRespond(wager.id, false)}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs py-2 rounded-lg transition-colors">
                  Decline
                </button>
              </div>
            </div>
          )}

          {wager.double_down_status === 'accepted' && (
            <div className="bg-orange-900/20 border border-orange-700/40 rounded-xl p-3 mb-3">
              <p className="text-orange-300 text-xs font-bold mb-1">⚡ Double Down Active!</p>
              <p className="text-xs text-gray-400">Extra if workers <span className="text-red-400 font-medium">lose</span>: <span className="text-white">{wager.double_down_extra_motivator}</span></p>
              <p className="text-xs text-gray-400">Extra if workers <span className="text-green-400 font-medium">win</span>: <span className="text-white">{wager.double_down_extra_worker}</span></p>
            </div>
          )}

          {isMotivator && wager.double_down_status === 'offered' && (
            <p className="text-xs text-gray-600 text-center mb-2">⏳ Waiting for worker to respond to double down...</p>
          )}
        </>
      )}

      {wager.status === 'resolved' && wager.winner && (
        <div className={cn('text-center py-3 rounded-xl text-sm font-bold mb-3',
          wager.winner === 'competitors' ? 'bg-green-900/40 text-green-400' : 'bg-purple-900/40 text-purple-400'
        )}>
          {wager.winner === 'competitors' ? '🏆 Workers won!' : '💅 Motivators won!'}
        </div>
      )}

      <div className="mb-3">
        <CommentsSection
          targetId={wager.id}
          targetType="wager"
          currentUserId={currentUserId}
          notifyUserIds={[...(wager.team_player_ids || []), ...(wager.watcher_ids || [])]}
        />
      </div>

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

      {isProposerSelf && (
        <div className="flex gap-2 mt-1">
          {wager.status === 'active' && (<>
            <button onClick={() => onResolve(wager.id, 'competitors')}
              className="flex-1 bg-green-900/40 hover:bg-green-800 text-green-400 border border-green-700 py-2 rounded-xl text-xs font-medium transition-colors">
              Workers won ✓
            </button>
            <button onClick={() => onResolve(wager.id, 'partners')}
              className="flex-1 bg-red-900/40 hover:bg-red-800 text-red-400 border border-red-700 py-2 rounded-xl text-xs font-medium transition-colors">
              Motivators won 💅
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
  const [debts, setDebts] = useState<any[]>([])
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
  const todayEastern = getTodayEastern()
  const [startDate, setStartDate] = useState(todayEastern)
  const [endDate, setEndDate] = useState(() => {
    const [y, m, d] = todayEastern.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, d + 6)).toISOString().split('T')[0]
  })

  const fetchDebts = useCallback(async () => {
    const supabase = createClient()
    const [{ data: asDebtor }, { data: asCreditor }] = await Promise.all([
      supabase.from('wager_debts').select('*').contains('debtor_ids', [currentUserId]).order('created_at', { ascending: false }),
      supabase.from('wager_debts').select('*').contains('creditor_ids', [currentUserId]).order('created_at', { ascending: false }),
    ])
    const all = [...(asDebtor || []), ...(asCreditor || [])]
    const unique = [...new Map(all.map(d => [d.id, d])).values()]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    setDebts(unique)
  }, [currentUserId])

  const fetchWagers = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('wagers')
      .select('*, profiles!wagers_proposed_by_fkey(display_name, username), wager_acceptances(user_id)')
      .or(`proposed_by.eq.${currentUserId},team_player_ids.cs.{${currentUserId}},watcher_ids.cs.{${currentUserId}}`)
      .order('created_at', { ascending: false })
    if (error) { setError('Fetch error: ' + error.message); setFetching(false); return }

    // Auto-resolve expired active wagers (compare in Eastern time, not UTC)
    const todayEastern = getTodayEastern()
    const expired = (data || []).filter(w =>
      w.status === 'active' && w.end_date && w.end_date < todayEastern && (w.team_player_ids || []).length > 0
    )
    for (const wager of expired) {
      const { data: workouts } = await supabase
        .from('workouts').select('user_id, points')
        .in('user_id', wager.team_player_ids)
        .gte('logged_at', wager.week_start)
        .lte('logged_at', getEndOfDayEasternISO(wager.end_date))
      const pts: Record<string, number> = {}
      for (const w of (workouts || [])) pts[w.user_id] = (pts[w.user_id] || 0) + w.points
      const allWon = wager.team_player_ids.every((id: string) => (pts[id] || 0) >= wager.point_threshold)
      const winner = allWon ? 'competitors' : 'partners'
      await supabase.from('wagers').update({
        status: 'resolved', winner, resolved_at: new Date().toISOString(),
      }).eq('id', wager.id)
      await createDebtRecord(supabase, wager, winner)
    }

    if (expired.length > 0) {
      const { data: refreshed } = await supabase
        .from('wagers')
        .select('*, profiles!wagers_proposed_by_fkey(display_name, username), wager_acceptances(user_id)')
        .or(`proposed_by.eq.${currentUserId},team_player_ids.cs.{${currentUserId}},watcher_ids.cs.{${currentUserId}}`)
        .order('created_at', { ascending: false })
      setWagers(refreshed || [])
    } else {
      setWagers(data || [])
    }
    setFetching(false)
  }, [])

  useEffect(() => {
    fetchWagers()
    fetchDebts()
  }, [fetchWagers, fetchDebts])

  async function handleSettleDebt(debtId: string) {
    const supabase = createClient()
    await supabase.from('wager_debts').update({
      status: 'paid',
      settled_at: new Date().toISOString(),
    }).eq('id', debtId)
    await fetchDebts()
  }

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
      week_start: (() => {
        // Store as Eastern midnight ISO so workouts before today aren't counted
        const [y, m, d] = startDate.split('-').map(Number)
        const absOffset = -getEasternOffsetHours() // 4 for EDT, 5 for EST
        return new Date(Date.UTC(y, m - 1, d, absOffset, 0, 0)).toISOString()
      })(),
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

    if (inserted) {
      await supabase.from('wager_acceptances').insert({ wager_id: inserted.id, user_id: currentUserId })
    }

    if (inserted) {
      fetch('/api/push/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'wager_proposed',
          payload: {
            wagerId: inserted.id,
            wagerTitle: inserted.title,
            participantIds: [...teamPlayerIds, ...watcherIds],
          },
        }),
      }).catch(() => null)
    }

    setShowForm(false)
    setTitle(''); setDescription(''); setStakeIfPartnersWin(''); setStakeIfCompetitorsWin('')
    setTeamPlayerIds([currentUserId]); setWatcherIds([])
    const t = getTodayEastern(); setStartDate(t)
    const [y, m, d] = t.split('-').map(Number)
    setEndDate(new Date(Date.UTC(y, m - 1, d + 6)).toISOString().split('T')[0])
    setLoading(false)
    await fetchWagers()
  }

  async function handleAccept(wagerId: string) {
    const supabase = createClient()
    await supabase.from('wager_acceptances').insert({ wager_id: wagerId, user_id: currentUserId })
    const wager = wagers.find(w => w.id === wagerId)
    const { data: acceptances } = await supabase.from('wager_acceptances').select('user_id').eq('wager_id', wagerId)
    const acceptedIds = (acceptances || []).map((a: any) => a.user_id)
    const everyone = [...(wager?.team_player_ids || []), ...(wager?.watcher_ids || [])]
    const allAccepted = everyone.every((id: string) => acceptedIds.includes(id))
    if (allAccepted) {
      await supabase.from('wagers').update({ status: 'active' }).eq('id', wagerId)
    }
    fetch('/api/push/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'wager_accepted',
        payload: {
          wagerId,
          wagerTitle: wager?.title,
          proposerId: wager?.proposed_by,
          allAccepted,
          participantIds: everyone,
        },
      }),
    }).catch(() => null)
    await fetchWagers()
  }

  async function handleResolve(wagerId: string, winner: 'competitors' | 'partners') {
    const supabase = createClient()
    await supabase.from('wagers').update({
      status: 'resolved', winner, resolved_at: new Date().toISOString(),
    }).eq('id', wagerId)
    const wager = wagers.find(w => w.id === wagerId)
    if (wager) {
      await createDebtRecord(supabase, wager, winner)
      const participantIds = [...(wager.team_player_ids || []), ...(wager.watcher_ids || [])]
      fetch('/api/push/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'wager_resolved',
          payload: { wagerTitle: wager.title, winner, participantIds },
        }),
      }).catch(() => null)
    }
    await fetchWagers()
    await fetchDebts()
  }

  async function handleDoubleDownOffer(wagerId: string, extraMotivator: string, extraWorker: string) {
    const supabase = createClient()
    await supabase.from('wagers').update({
      double_down_status: 'offered',
      double_down_extra_motivator: extraMotivator,
      double_down_extra_worker: extraWorker,
    }).eq('id', wagerId)
    const wager = wagers.find(w => w.id === wagerId)
    if (wager) {
      fetch('/api/push/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'double_down_offered',
          payload: { wagerTitle: wager.title, workerIds: wager.team_player_ids || [] },
        }),
      }).catch(() => null)
    }
    await fetchWagers()
  }

  async function handleDoubleDownRespond(wagerId: string, accept: boolean) {
    const supabase = createClient()
    await supabase.from('wagers').update({ double_down_status: accept ? 'accepted' : 'declined' }).eq('id', wagerId)
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
  const outstandingDebts = debts.filter(d => d.status === 'outstanding')
  const profileMap = Object.fromEntries(allProfiles.map(p => [p.id, p]))

  return (
    <div className="space-y-6">

      {/* ── Debt Tracker ─────────────────────────────────────────────── */}
      {debts.length > 0 && (
        <DebtTracker
          debts={debts}
          currentUserId={currentUserId}
          allProfiles={allProfiles}
          onSettle={handleSettleDebt}
        />
      )}

      {/* ── Propose Button ────────────────────────────────────────────── */}
      <button
        onClick={() => setShowForm(!showForm)}
        className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-xl transition-colors"
      >
        {showForm ? 'Cancel' : '+ Propose a Wager'}
      </button>

      {showForm && (
        <form onSubmit={handleCreateWager} className="bg-gray-900 rounded-2xl p-5 space-y-5">
          <h2 className="text-white font-bold text-lg">New Wager</h2>

          {/* ── Debt Warning ──────────────────────────────────────────── */}
          {outstandingDebts.length > 0 && (
            <div className="bg-red-900/25 border border-red-700/60 rounded-xl p-4">
              <p className="text-red-400 font-bold text-sm mb-2">⚠️ You have unsettled debts</p>
              <div className="space-y-1.5 mb-2">
                {outstandingDebts.map(debt => {
                  const iAmDebtor = (debt.debtor_ids || []).includes(currentUserId)
                  const otherIds = iAmDebtor ? debt.creditor_ids : debt.debtor_ids
                  const otherName = otherIds.map((id: string) => profileMap[id]?.display_name?.split(' ')[0] || '?').join(' & ')
                  return (
                    <p key={debt.id} className="text-xs text-gray-300">
                      {iAmDebtor
                        ? <><span className="text-red-400">You owe {otherName}:</span> "{debt.description}"</>
                        : <><span className="text-yellow-400">{otherName} owes you:</span> "{debt.description}"</>
                      }
                      <span className="text-gray-600"> · {debt.wager_title}</span>
                    </p>
                  )
                })}
              </div>
              <p className="text-red-600 text-xs">Starting new bets before settling up... bold move. 👀 Are you sure?</p>
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-2">Title</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Week 3 Team Challenge" required
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-yellow-500 transition-colors" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Start Date</label>
              <input type="date" value={startDate}
                onChange={e => {
                  setStartDate(e.target.value)
                  // Push end date forward if it's now before start
                  if (endDate < e.target.value) setEndDate(e.target.value)
                }}
                min={todayEastern} required
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500 transition-colors" />
              <p className="text-xs text-gray-700 mt-1">Cannot be before today</p>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">End Date</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                min={startDate} required
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500 transition-colors" />
            </div>
          </div>

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
                        🏋️ Worker
                      </button>
                      <button type="button" onClick={() => togglePlayer(p.id, 'watcher')}
                        className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                          side === 'watcher' ? 'bg-purple-500 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600')}>
                        💅 Motivator
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

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
                <p className="text-xs text-gray-400 mt-1 ml-6">Motivators win if <strong className="text-white">either</strong> worker misses the goal</p>
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
            <label className="block text-sm text-gray-400 mb-2">💅 If the motivators win...</label>
            <input type="text" value={stakeIfPartnersWin} onChange={e => setStakeIfPartnersWin(e.target.value)}
              placeholder="e.g. Buy her a bouquet of flowers" required
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-yellow-500 transition-colors" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">🏆 If the workers win...</label>
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

      {fetching && <div className="text-center py-8 text-gray-500 text-sm">Loading...</div>}

      {!fetching && pendingWagers.length > 0 && (
        <div>
          <h2 className="text-white font-semibold mb-3">Pending Challenges ⏳</h2>
          <div className="space-y-3">
            {pendingWagers.map(wager => (
              <WagerCard key={wager.id} wager={wager} currentUserId={currentUserId}
                onResolve={handleResolve} onDelete={handleDelete} onAccept={handleAccept}
                onDoubleDownOffer={handleDoubleDownOffer} onDoubleDownRespond={handleDoubleDownRespond}
                allProfiles={allProfiles} />
            ))}
          </div>
        </div>
      )}

      {!fetching && activeWagers.length > 0 && (
        <div>
          <h2 className="text-white font-semibold mb-3">Active Challenges 🔥</h2>
          <div className="space-y-3">
            {activeWagers.map(wager => (
              <WagerCard key={wager.id} wager={wager} currentUserId={currentUserId}
                onResolve={handleResolve} onDelete={handleDelete} onAccept={handleAccept}
                onDoubleDownOffer={handleDoubleDownOffer} onDoubleDownRespond={handleDoubleDownRespond}
                allProfiles={allProfiles} />
            ))}
          </div>
        </div>
      )}

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
