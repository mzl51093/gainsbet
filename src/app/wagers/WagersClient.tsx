'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatDate, cn } from '@/lib/utils'
import { WEEKLY_GOAL } from '@/lib/points'
import type { Wager, Profile } from '@/lib/types'

const CONDITION_LABELS: Record<string, string> = {
  both_fail: 'Both competitors miss the weekly goal',
  either_fails: 'Either competitor misses the weekly goal',
  one_fails: 'One specific competitor misses the weekly goal',
  custom: 'Custom condition',
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-900/30 border-yellow-700/50 text-yellow-400',
  active: 'bg-blue-900/30 border-blue-700/50 text-blue-400',
  resolved: 'bg-gray-900 border-gray-700 text-gray-400',
  expired: 'bg-gray-900 border-gray-700 text-gray-600',
}

interface Props {
  wagers: any[]
  currentUserId: string
  currentProfile: Profile
  allProfiles: Profile[]
  weekStart: string
}

export default function WagersClient({ wagers, currentUserId, currentProfile, allProfiles, weekStart }: Props) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [conditionType, setConditionType] = useState('both_fail')
  const [pointThreshold, setPointThreshold] = useState(WEEKLY_GOAL)
  const [stakeIfPartnersWin, setStakeIfPartnersWin] = useState('')
  const [stakeIfCompetitorsWin, setStakeIfCompetitorsWin] = useState('')

  async function handleCreateWager(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.from('wagers').insert({
      title,
      description: description || null,
      proposed_by: currentUserId,
      condition_type: conditionType,
      point_threshold: pointThreshold,
      week_start: weekStart.split('T')[0],
      stake_if_partners_win: stakeIfPartnersWin,
      stake_if_competitors_win: stakeIfCompetitorsWin,
      status: 'pending',
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setShowForm(false)
      setTitle(''); setDescription(''); setStakeIfPartnersWin(''); setStakeIfCompetitorsWin('')
      router.refresh()
      setLoading(false)
    }
  }

  async function handleAccept(wagerId: string) {
    const supabase = createClient()
    await supabase.from('wager_acceptances').insert({
      wager_id: wagerId,
      user_id: currentUserId,
    })
    // Auto-activate if all have accepted (simplified: activate on any acceptance)
    await supabase.from('wagers').update({ status: 'active' }).eq('id', wagerId).eq('status', 'pending')
    router.refresh()
  }

  async function handleResolve(wagerId: string, winner: 'competitors' | 'partners') {
    const supabase = createClient()
    await supabase.from('wagers').update({
      status: 'resolved',
      winner,
      resolved_at: new Date().toISOString(),
    }).eq('id', wagerId)
    router.refresh()
  }

  const pendingWagers = wagers.filter(w => w.status === 'pending')
  const activeWagers = wagers.filter(w => w.status === 'active')
  const resolvedWagers = wagers.filter(w => w.status === 'resolved' || w.status === 'expired')

  return (
    <div className="space-y-6">
      {/* Create button */}
      <button
        onClick={() => setShowForm(!showForm)}
        className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-xl transition-colors"
      >
        {showForm ? 'Cancel' : '+ Propose a Wager'}
      </button>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreateWager} className="bg-gray-900 rounded-2xl p-5 space-y-4">
          <h2 className="text-white font-bold text-lg">New Wager</h2>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Week 3 Stakes"
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-yellow-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Condition</label>
            <select
              value={conditionType}
              onChange={e => setConditionType(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500 transition-colors"
            >
              {Object.entries(CONDITION_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Point threshold: <span className="text-white font-semibold">{pointThreshold} pts</span>
            </label>
            <input
              type="range"
              min={20}
              max={150}
              step={5}
              value={pointThreshold}
              onChange={e => setPointThreshold(Number(e.target.value))}
              className="w-full accent-yellow-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">
              If the accountability partners win...
            </label>
            <input
              type="text"
              value={stakeIfPartnersWin}
              onChange={e => setStakeIfPartnersWin(e.target.value)}
              placeholder="e.g. Buy her a bouquet of flowers"
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-yellow-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">
              If the competitors win...
            </label>
            <input
              type="text"
              value={stakeIfCompetitorsWin}
              onChange={e => setStakeIfCompetitorsWin(e.target.value)}
              placeholder="e.g. Wives do the dishes all week"
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-yellow-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Notes (optional)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Any other details..."
              rows={2}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-yellow-500 transition-colors resize-none"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:bg-yellow-900 text-black font-bold py-3 rounded-xl transition-colors"
          >
            {loading ? 'Creating...' : 'Propose Wager'}
          </button>
        </form>
      )}

      {/* Pending */}
      {pendingWagers.length > 0 && (
        <div>
          <h2 className="text-white font-semibold mb-3">Pending Acceptance</h2>
          <div className="space-y-3">
            {pendingWagers.map(wager => {
              const hasAccepted = wager.wager_acceptances?.some((a: any) => a.user_id === currentUserId)
              return (
                <WagerCard
                  key={wager.id}
                  wager={wager}
                  onAccept={() => handleAccept(wager.id)}
                  onResolve={handleResolve}
                  hasAccepted={hasAccepted}
                  isProposer={wager.proposed_by === currentUserId}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* Active */}
      {activeWagers.length > 0 && (
        <div>
          <h2 className="text-white font-semibold mb-3">Active Wagers 🔥</h2>
          <div className="space-y-3">
            {activeWagers.map(wager => (
              <WagerCard
                key={wager.id}
                wager={wager}
                onAccept={() => handleAccept(wager.id)}
                onResolve={handleResolve}
                hasAccepted={true}
                isProposer={wager.proposed_by === currentUserId}
              />
            ))}
          </div>
        </div>
      )}

      {/* Resolved */}
      {resolvedWagers.length > 0 && (
        <div>
          <h2 className="text-white font-semibold mb-3 text-gray-500">Past Wagers</h2>
          <div className="space-y-3">
            {resolvedWagers.map(wager => (
              <WagerCard
                key={wager.id}
                wager={wager}
                onAccept={() => {}}
                onResolve={handleResolve}
                hasAccepted={true}
                isProposer={wager.proposed_by === currentUserId}
              />
            ))}
          </div>
        </div>
      )}

      {wagers.length === 0 && !showForm && (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">🤝</p>
          <p className="text-gray-400">No wagers yet.</p>
          <p className="text-gray-600 text-sm mt-1">Propose one to raise the stakes!</p>
        </div>
      )}
    </div>
  )
}

function WagerCard({
  wager,
  onAccept,
  onResolve,
  hasAccepted,
  isProposer,
}: {
  wager: any
  onAccept: () => void
  onResolve: (id: string, winner: 'competitors' | 'partners') => void
  hasAccepted: boolean
  isProposer: boolean
}) {
  const statusStyle = STATUS_STYLES[wager.status] || STATUS_STYLES.pending
  const acceptCount = wager.wager_acceptances?.length || 0

  return (
    <div className={cn('border rounded-2xl p-4', statusStyle.split(' ').slice(0, 2).join(' '))}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-white font-semibold">{wager.title}</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Proposed by {wager.profiles?.display_name} · {formatDate(wager.created_at)}
          </p>
        </div>
        <span className={cn('text-xs px-2 py-1 rounded-full font-medium', statusStyle.split(' ').slice(2).join(' '))}>
          {wager.status}
        </span>
      </div>

      {wager.description && (
        <p className="text-gray-400 text-sm mb-3">{wager.description}</p>
      )}

      <div className="space-y-1.5 mb-3">
        <div className="text-xs">
          <span className="text-gray-500">Condition: </span>
          <span className="text-gray-300">{CONDITION_LABELS[wager.condition_type]} ({wager.point_threshold} pts)</span>
        </div>
        <div className="text-xs">
          <span className="text-gray-500">If partners win: </span>
          <span className="text-red-400 font-medium">{wager.stake_if_partners_win}</span>
        </div>
        <div className="text-xs">
          <span className="text-gray-500">If competitors win: </span>
          <span className="text-green-400 font-medium">{wager.stake_if_competitors_win}</span>
        </div>
      </div>

      {wager.status === 'resolved' && wager.winner && (
        <div className={cn(
          'text-center py-2 rounded-xl text-sm font-bold',
          wager.winner === 'competitors' ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'
        )}>
          {wager.winner === 'competitors' ? '🏆 Competitors won!' : '💅 Accountability partners won!'}
        </div>
      )}

      {wager.status === 'pending' && !hasAccepted && (
        <button
          onClick={onAccept}
          className="w-full mt-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-2 rounded-xl text-sm transition-colors"
        >
          Accept Wager ({acceptCount} accepted)
        </button>
      )}

      {wager.status === 'pending' && hasAccepted && (
        <p className="text-center text-xs text-gray-500 mt-2">
          You accepted · {acceptCount} total accepted
        </p>
      )}

      {wager.status === 'active' && isProposer && (
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => onResolve(wager.id, 'competitors')}
            className="flex-1 bg-green-900/40 hover:bg-green-800 text-green-400 border border-green-700 py-2 rounded-xl text-xs font-medium transition-colors"
          >
            Competitors won
          </button>
          <button
            onClick={() => onResolve(wager.id, 'partners')}
            className="flex-1 bg-red-900/40 hover:bg-red-800 text-red-400 border border-red-700 py-2 rounded-xl text-xs font-medium transition-colors"
          >
            Partners won
          </button>
        </div>
      )}
    </div>
  )
}
