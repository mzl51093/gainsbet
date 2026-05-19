'use client'

import { useState, useEffect } from 'react'
import type { Profile } from '@/lib/types'
import CountdownTimer from './CountdownTimer'
import WorkoutPlanButton from './WorkoutPlanButton'

export interface DraftParticipantProgress {
  profile: Profile
  points: number
  isMe: boolean
}

export interface DraftCompetitionData {
  id: string
  name: string
  pointGoal: number
  minContributionPct: number
  wagerDescription: string | null
  startDate: string
  endDate: string | null
  endTimestamp: number | null
  daysLeft: number | null
  daysTotal: number
  daysElapsed: number
  captainAId: string | null
  captainBId: string | null
  teamA: DraftParticipantProgress[]
  teamB: DraftParticipantProgress[]
  myTeam: string | null
  isParticipant: boolean
}

// ── Display Prefs ─────────────────────────────────────────────────────────────

interface DisplayPrefs {
  order: string[]
  hidden: string[]
  collapsed: string[]
}

const PREFS_KEY = 'draft_display_prefs_v1'

function loadPrefs(): DisplayPrefs {
  if (typeof window === 'undefined') return { order: [], hidden: [], collapsed: [] }
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) || 'null') ?? { order: [], hidden: [], collapsed: [] }
  } catch {
    return { order: [], hidden: [], collapsed: [] }
  }
}

function savePrefs(p: DisplayPrefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(p))
}

// ── Nudges ────────────────────────────────────────────────────────────────────

const DRAFT_NUDGES_WINNING = [
  "Your team is ahead and they know it 🔥 Don't let them catch up — keep logging.",
  "Leading the pack. Your opponents are stress-refreshing this page. Keep the pressure on. 💥",
  "In front and looking dangerous. This is NOT the time to coast. Extend the lead. 🏆",
  "Winning feels good. Know what feels better? Finishing what you started. Log something today. 💪",
]
const DRAFT_NUDGES_ON_TRACK = [
  "Your team is keeping pace 💪 Don't give them an opening to catch up.",
  "On track and competitive. Your opponents are watching your every move. Give them nothing. 👀",
  "Right on schedule. Every workout you skip is points you're handing to the other team. 🎯",
  "Locked in. Keep the momentum going — the other team isn't slowing down. 😤",
]
const DRAFT_NUDGES_BEHIND = [
  "Your team is slipping 😬 The other side just quietly pulled ahead. Time to respond.",
  "Behind pace and falling. This is exactly what the other team was hoping for. Disappoint them. 🏃",
  "You're letting them win without a fight. Log a workout. Literally anything. 📉",
  "Falling behind? Bold strategy. Real bold. Maybe try going to the gym instead? Just a thought. ⚠️",
]
const DRAFT_NUDGES_RED = [
  "🚨 Your team is getting cooked. At this pace the other team wins by default. Someone needs to act NOW.",
  "This is ugly. Your opponents are already celebrating. Go prove them wrong — or don't, and pay up. 😭",
  "Complete collapse. Rock bottom. The only way is up. You have to actually GO up. TODAY. 🙏",
  "They've already mentally spent your money. Log a workout and ruin their day. Do it now. 😤",
]

function pick(arr: string[], seed: string) {
  const n = seed.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return arr[n % arr.length]
}

// ── PlayerRow ─────────────────────────────────────────────────────────────────

function PlayerRow({
  p, captainId, threshold, daysElapsed, daysTotal, daysLeftNum,
}: {
  p: DraftParticipantProgress
  captainId: string | null
  threshold: number
  daysElapsed: number
  daysTotal: number
  daysLeftNum: number
}) {
  const pct = threshold > 0 ? Math.min(100, (p.points / threshold) * 100) : 0
  const projected = daysElapsed > 0 ? Math.round((p.points / daysElapsed) * daysTotal) : p.points
  const onTrack = threshold > 0 ? (projected >= threshold || p.points >= threshold) : true
  const isCapt = p.profile.id === captainId
  const ptsNeeded = Math.max(0, threshold - p.points)
  const ptsPerDay = daysLeftNum > 0 && ptsNeeded > 0 ? Math.ceil(ptsNeeded / daysLeftNum) : 0

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400">
            {p.isMe ? '👤 You' : p.profile.display_name.split(' ')[0]}
            {isCapt ? ' ©' : ''}
          </span>
          {!onTrack && p.points < threshold && <span className="text-xs text-red-400">⚠</span>}
        </div>
        <div className="flex items-center gap-1">
          <span className={`text-sm font-bold ${onTrack ? 'text-green-400' : 'text-red-400'}`}>
            {p.points}
          </span>
          {threshold > 0 && <span className="text-gray-600 text-xs">/ {threshold}</span>}
        </div>
      </div>
      <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            pct >= 100 ? 'bg-green-500' : onTrack ? 'bg-blue-500' : 'bg-red-500'
          }`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      {p.isMe && threshold > 0 && p.points < threshold && (
        <p className="text-xs text-gray-600 mt-0.5">
          Projected: <span className={projected >= threshold ? 'text-green-400' : 'text-red-400'}>
            {projected} pts
          </span>
          {ptsNeeded > 0 && ` · need ${ptsNeeded} more`}
          {ptsPerDay > 0 && ` (${ptsPerDay}/day)`}
        </p>
      )}
    </div>
  )
}

// ── DraftCompetitionCard ──────────────────────────────────────────────────────

function DraftCompetitionCard({
  comp,
  collapsed,
  onToggleCollapse,
  editMode,
  isFirst,
  isLast,
  isHidden,
  onMoveUp,
  onMoveDown,
  onToggleHide,
}: {
  comp: DraftCompetitionData
  collapsed: boolean
  onToggleCollapse: () => void
  editMode: boolean
  isFirst: boolean
  isLast: boolean
  isHidden: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onToggleHide: () => void
}) {
  const myTeamPlayers = comp.myTeam === 'a' ? comp.teamA : comp.myTeam === 'b' ? comp.teamB : []
  const opponents    = comp.myTeam === 'a' ? comp.teamB : comp.myTeam === 'b' ? comp.teamA  : []
  const myTeamLabel  = comp.myTeam === 'a' ? 'Team A' : comp.myTeam === 'b' ? 'Team B' : ''
  const oppLabel     = comp.myTeam === 'a' ? 'Team B' : 'Team A'
  const myCaptainId  = comp.myTeam === 'a' ? comp.captainAId : comp.captainBId
  const oppCaptainId = comp.myTeam === 'a' ? comp.captainBId : comp.captainAId

  const myTotal  = myTeamPlayers.reduce((s, p) => s + p.points, 0)
  const oppTotal = opponents.reduce((s, p) => s + p.points, 0)

  const minRequired = comp.minContributionPct > 0
    ? Math.ceil((comp.pointGoal * comp.minContributionPct) / 100)
    : 0

  const imWinning = myTotal > oppTotal
  const imLosing  = oppTotal > myTotal

  const teamProjected = comp.daysElapsed > 0
    ? Math.round((myTotal / comp.daysElapsed) * comp.daysTotal)
    : myTotal
  const teamOnTrack = teamProjected >= comp.pointGoal || myTotal >= comp.pointGoal

  const myProgress  = myTeamPlayers.find(p => p.isMe)
  const myPts       = myProgress?.points ?? 0
  const myMinNeeded = Math.max(0, minRequired - myPts)
  const teamPtsNeeded = Math.max(0, comp.pointGoal - myTotal)
  const daysLeftNum = comp.daysLeft ?? 0

  const workoutTarget = myMinNeeded > 0
    ? myMinNeeded
    : myTeamPlayers.length > 0
    ? Math.ceil(teamPtsNeeded / myTeamPlayers.length)
    : teamPtsNeeded

  const seed = comp.id + (myProgress?.profile?.id ?? '')
  let nudge = ''
  if (comp.isParticipant && myTeamPlayers.length > 0) {
    if (imWinning && teamProjected >= comp.pointGoal * 1.2) nudge = pick(DRAFT_NUDGES_WINNING, seed)
    else if (teamOnTrack) nudge = pick(DRAFT_NUDGES_ON_TRACK, seed)
    else if (teamProjected >= comp.pointGoal * 0.6) nudge = pick(DRAFT_NUDGES_BEHIND, seed)
    else nudge = pick(DRAFT_NUDGES_RED, seed)
  }

  const statusBorder = isHidden
    ? 'border-gray-800'
    : imWinning ? 'border-green-700/50' : imLosing ? 'border-red-700/50' : 'border-gray-700'

  const statusBadge = imWinning
    ? { cls: 'bg-green-900/40 text-green-400', label: 'WINNING 🏆' }
    : imLosing
    ? { cls: 'bg-red-900/40 text-red-400',   label: 'LOSING ⚠' }
    : { cls: 'bg-gray-800 text-gray-400',     label: 'TIED 🤝' }

  const allMyOnTrack = myTeamPlayers.every(p => {
    if (minRequired === 0) return true
    const proj = comp.daysElapsed > 0 ? Math.round((p.points / comp.daysElapsed) * comp.daysTotal) : p.points
    return proj >= minRequired || p.points >= minRequired
  })
  const anyMyAtRisk = !allMyOnTrack

  return (
    <div className={`rounded-2xl border ${statusBorder} ${isHidden ? 'bg-gray-900/40 opacity-50' : 'bg-gray-900'} overflow-hidden transition-opacity`}>

      {/* Edit mode toolbar */}
      {editMode && (
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-800/60 border-b border-gray-700">
          <div className="flex gap-1">
            <button
              onClick={onMoveUp}
              disabled={isFirst}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-20 disabled:cursor-not-allowed transition-colors text-sm"
              title="Move up"
            >
              ↑
            </button>
            <button
              onClick={onMoveDown}
              disabled={isLast}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-20 disabled:cursor-not-allowed transition-colors text-sm"
              title="Move down"
            >
              ↓
            </button>
          </div>
          <span className="text-gray-500 text-xs flex-1 truncate">{comp.name}</span>
          <button
            onClick={onToggleHide}
            className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
              isHidden
                ? 'bg-green-900/40 text-green-400 hover:bg-green-900/60'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white'
            }`}
          >
            {isHidden ? 'Restore' : 'Hide'}
          </button>
        </div>
      )}

      {/* Card header — always visible, tap to collapse */}
      <button
        onClick={onToggleCollapse}
        className="w-full text-left px-4 pt-4 pb-3 border-b border-gray-800"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base">⚔️</span>
              <h3 className="text-white font-bold text-base">{comp.name}</h3>
              <span className="text-xs bg-blue-900/40 text-blue-400 px-2 py-0.5 rounded-full font-medium shrink-0">DRAFT</span>
            </div>
            {collapsed ? (
              <p className="text-xs text-gray-500 mt-1">
                {comp.isParticipant
                  ? `My team ${myTotal} — Opp ${oppTotal} · ${comp.daysLeft != null ? (comp.daysLeft > 0 ? `${comp.daysLeft}d left` : 'Last day') : 'ongoing'}`
                  : `${comp.daysLeft != null ? `${comp.daysLeft}d left` : 'ongoing'}`}
              </p>
            ) : (
              <p className="text-xs text-gray-500 mt-0.5">
                {comp.daysLeft !== null
                  ? comp.daysLeft > 1 ? `${comp.daysLeft} days left`
                  : comp.daysLeft === 1 ? 'Last day! 🔥'
                  : 'Final hours! 🔥'
                  : 'Ongoing'}
                {comp.endDate && ` · ends ${comp.endDate}`}
                {!comp.endDate && ` · started ${comp.startDate}`}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {comp.isParticipant && (
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${statusBadge.cls}`}>
                {statusBadge.label}
              </span>
            )}
            <span className="text-gray-600 text-sm">{collapsed ? '›' : '⌄'}</span>
          </div>
        </div>

        {!collapsed && comp.endTimestamp && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-gray-600 text-xs">⏱</span>
            <CountdownTimer endTimestamp={comp.endTimestamp} />
            <span className="text-gray-600 text-xs">remaining</span>
          </div>
        )}
      </button>

      {/* Collapsible body */}
      {!collapsed && (
        <>
          {/* My team */}
          {comp.isParticipant && myTeamPlayers.length > 0 && (
            <div className="px-4 py-3 border-b border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-600 uppercase tracking-wide">Your Team ({myTeamLabel})</p>
                <span className={`text-xs font-medium ${allMyOnTrack ? 'text-green-400' : anyMyAtRisk ? 'text-red-400' : 'text-gray-400'}`}>
                  {myTotal} pts total
                </span>
              </div>
              <div className="space-y-3">
                {myTeamPlayers.map(p => (
                  <PlayerRow
                    key={p.profile.id}
                    p={p}
                    captainId={myCaptainId}
                    threshold={minRequired}
                    daysElapsed={comp.daysElapsed}
                    daysTotal={comp.daysTotal}
                    daysLeftNum={daysLeftNum}
                  />
                ))}
              </div>
              <div className="mt-3 pt-2 border-t border-gray-800/60">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-600">Team total toward goal</span>
                  <span className="text-xs text-gray-500">{myTotal} / {comp.pointGoal} pts</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${imWinning ? 'bg-green-500' : imLosing ? 'bg-red-500' : 'bg-blue-500'}`}
                    style={{ width: `${Math.min(100, (myTotal / comp.pointGoal) * 100)}%` }}
                  />
                </div>
                {!teamOnTrack && teamPtsNeeded > 0 && (
                  <p className="text-xs text-gray-600 mt-0.5">
                    Team needs <span className="text-white">{teamPtsNeeded} more pts</span>
                    {daysLeftNum > 0 && ` · ~${Math.ceil(teamPtsNeeded / daysLeftNum)}/day pace`}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Opponents */}
          <div className="px-4 py-3 border-b border-gray-800">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-600 uppercase tracking-wide">
                {comp.isParticipant ? `Opponents (${oppLabel})` : oppLabel}
              </p>
              <span className={`text-xs font-medium ${oppTotal > myTotal ? 'text-red-400' : 'text-gray-500'}`}>
                {oppTotal} pts total
              </span>
            </div>
            <div className="space-y-2.5">
              {opponents.map(p => (
                <div key={p.profile.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-400">
                      {p.profile.display_name.split(' ')[0]}
                      {p.profile.id === oppCaptainId ? ' ©' : ''}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className={`text-sm font-bold ${
                        minRequired > 0 && p.points >= minRequired ? 'text-green-400' : 'text-gray-400'
                      }`}>{p.points}</span>
                      {minRequired > 0 && <span className="text-gray-600 text-xs">/ {minRequired}</span>}
                    </div>
                  </div>
                  <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        minRequired > 0 && p.points >= minRequired ? 'bg-green-600' : 'bg-gray-600'
                      }`}
                      style={{ width: `${minRequired > 0 ? Math.min(100, (p.points / minRequired) * 100) : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-2 border-t border-gray-800/60">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-600">Opponent total</span>
                <span className="text-xs text-gray-500">{oppTotal} / {comp.pointGoal} pts</span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${oppTotal > myTotal ? 'bg-red-600' : 'bg-gray-600'}`}
                  style={{ width: `${Math.min(100, (oppTotal / comp.pointGoal) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Nudge */}
          {nudge && (
            <div className={`px-4 py-3 border-b border-gray-800 border-l-4 ${
              imWinning ? 'border-l-green-500' : imLosing ? 'border-l-red-500' : 'border-l-gray-600'
            }`}>
              <p className="text-xs text-gray-300 leading-relaxed">{nudge}</p>
            </div>
          )}

          {/* Workout plan */}
          {comp.isParticipant && myProgress && myPts < comp.pointGoal && (
            <div className="px-4 py-3 border-b border-gray-800">
              <WorkoutPlanButton
                pointsNeeded={Math.max(1, workoutTarget)}
                hoursLeft={Math.max(4, daysLeftNum * 24)}
                daysLeft={daysLeftNum}
              />
            </div>
          )}

          {/* Stakes */}
          <div className="px-4 py-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-600 mb-0.5">At stake</p>
                <p className="text-yellow-400 text-xs font-medium">
                  💰 {comp.wagerDescription || 'Bragging rights'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-0.5">Goal</p>
                <p className="text-gray-400 text-xs font-medium">
                  {comp.pointGoal} pts/team
                  {minRequired > 0 && <span className="text-gray-600"> · min {minRequired} each</span>}
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function LiveDraftCompetitions({
  draftChallenges,
}: {
  draftChallenges: DraftCompetitionData[]
}) {
  const [prefs, setPrefs] = useState<DisplayPrefs>({ order: [], hidden: [], collapsed: [] })
  const [editMode, setEditMode] = useState(false)

  useEffect(() => {
    setPrefs(loadPrefs())
  }, [])

  if (draftChallenges.length === 0) return null

  function updatePrefs(next: DisplayPrefs) {
    setPrefs(next)
    savePrefs(next)
  }

  // Build sorted list — IDs in prefs.order come first, rest appended in original order
  const sorted = [...draftChallenges].sort((a, b) => {
    const ai = prefs.order.indexOf(a.id)
    const bi = prefs.order.indexOf(b.id)
    if (ai === -1 && bi === -1) return 0
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })

  // In edit mode show everything (so hidden ones can be restored); otherwise filter
  const visible = editMode ? sorted : sorted.filter(c => !prefs.hidden.includes(c.id))
  const hiddenCount = sorted.filter(c => prefs.hidden.includes(c.id)).length

  function currentOrder() {
    return sorted.map(c => c.id)
  }

  function moveUp(id: string) {
    const order = currentOrder()
    const idx = order.indexOf(id)
    if (idx <= 0) return
    const next = [...order]
    ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
    updatePrefs({ ...prefs, order: next })
  }

  function moveDown(id: string) {
    const order = currentOrder()
    const idx = order.indexOf(id)
    if (idx >= order.length - 1) return
    const next = [...order]
    ;[next[idx + 1], next[idx]] = [next[idx], next[idx + 1]]
    updatePrefs({ ...prefs, order: next })
  }

  function toggleHide(id: string) {
    const hidden = prefs.hidden.includes(id)
      ? prefs.hidden.filter(x => x !== id)
      : [...prefs.hidden, id]
    updatePrefs({ ...prefs, hidden })
  }

  function toggleCollapse(id: string) {
    const collapsed = prefs.collapsed.includes(id)
      ? prefs.collapsed.filter(x => x !== id)
      : [...prefs.collapsed, id]
    updatePrefs({ ...prefs, collapsed })
  }

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-gray-600 uppercase tracking-wide font-medium">
          Active Competitions{hiddenCount > 0 && !editMode ? ` · ${hiddenCount} hidden` : ''}
        </span>
        <button
          onClick={() => setEditMode(e => !e)}
          className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
            editMode
              ? 'bg-green-600 text-black'
              : 'bg-gray-800 text-gray-400 hover:text-white'
          }`}
        >
          {editMode ? 'Done' : 'Manage'}
        </button>
      </div>

      {/* Cards */}
      {visible.map((comp, idx) => (
        <DraftCompetitionCard
          key={comp.id}
          comp={comp}
          collapsed={prefs.collapsed.includes(comp.id)}
          onToggleCollapse={() => toggleCollapse(comp.id)}
          editMode={editMode}
          isFirst={idx === 0}
          isLast={idx === visible.length - 1}
          isHidden={prefs.hidden.includes(comp.id)}
          onMoveUp={() => moveUp(comp.id)}
          onMoveDown={() => moveDown(comp.id)}
          onToggleHide={() => toggleHide(comp.id)}
        />
      ))}

      {/* Hint when all are hidden */}
      {visible.length === 0 && hiddenCount > 0 && (
        <p className="text-gray-600 text-sm text-center py-4">
          All competitions are hidden.{' '}
          <button onClick={() => setEditMode(true)} className="text-gray-400 underline">
            Manage
          </button>{' '}
          to restore them.
        </p>
      )}
    </div>
  )
}
