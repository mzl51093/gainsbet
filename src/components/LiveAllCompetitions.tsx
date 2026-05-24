'use client'

import { useState, useEffect } from 'react'
import type { Profile } from '@/lib/types'
import Link from 'next/link'
import CountdownTimer from './CountdownTimer'
import WorkoutPlanButton from './WorkoutPlanButton'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WorkerProgress {
  profile: Profile
  points: number
  pct: number
  onTrack: boolean
  projected: number
}

export interface ChallengeData {
  id: string
  title: string
  threshold: number
  weekStart: string
  endDate: string | null
  endTimestamp: number | null
  daysLeft: number
  daysTotal: number
  daysElapsed: number
  stakeIfMotivators: string
  stakeIfWorkers: string
  workers: WorkerProgress[]
  motivators: Profile[]
  isWorker: boolean
  isMotivator: boolean
}

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

// ── Prefs ─────────────────────────────────────────────────────────────────────

interface DisplayPrefs {
  order: string[]   // prefixed IDs: "w:{id}" or "d:{id}"
  hidden: string[]
  collapsed: string[]
}

const PREFS_KEY = 'all_competitions_prefs_v1'

function loadPrefs(): DisplayPrefs {
  if (typeof window === 'undefined') return { order: [], hidden: [], collapsed: [] }
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) || 'null') ?? { order: [], hidden: [], collapsed: [] }
  } catch {
    return { order: [], hidden: [], collapsed: [] }
  }
}
function savePrefs(p: DisplayPrefs) { localStorage.setItem(PREFS_KEY, JSON.stringify(p)) }

// ── Nudges ────────────────────────────────────────────────────────────────────

const WORKER_NUDGES_ON_TRACK = ["You're on pace. Don't get cocky — the couch is always one bad day away from winning. 🛋️","Solid. Your motivator is currently stress-eating and pretending not to care. Keep going. 😤","On track and looking good. This is the part where you DON'T celebrate early like an idiot. 🎯","Progress confirmed. Your motivator has been suspiciously quiet. That means they're nervous. 👀"]
const WORKER_NUDGES_BEHIND  = ["Behind pace. Your motivator just smiled at their phone. That smile was about YOU. Do something. 😬","You're slipping. At this rate your prize money is going to a spa day you're not invited to. 💅","Falling behind? Bold strategy. Real bold. Maybe try going to the gym instead? Just a thought. 🏃","The gap is real. The couch is winning. This is genuinely embarrassing and we say that with love. ⚠️"]
const WORKER_NUDGES_RED     = ["🚨 RED ALERT. Your motivator is already texting about what to spend it on. We've seen the receipts.","At this trajectory you are COOKED. Like, fully done. Medium-well. Time to do literally anything physical.","This is rock bottom. The good news: the only way is up. The bad news: you have to actually go up. NOW. 😭","Your motivator has already picked out what they're ordering. Go to the gym. We are begging you. 🙏"]
const WORKER_NUDGES_CRUSHING= ["Absolutely destroying it 💥 Your motivator is in full panic mode. Do NOT let them recover.","Machine. Literal machine. Your motivator has gone suspiciously quiet. Finish them. 🏆","This is what peak performance looks like. Disgusting. We mean that as a compliment. Keep going. 🔥","You're so far ahead it's almost unfair. Almost. It's actually completely fair and you earned it. 💪"]
const MOTIVATOR_ON_TRACK    = ["They're on track 😤 Annoying, right? Maybe accidentally schedule something during their gym time.","Looking strong over there. Start mentally preparing your gracious loser speech. You'll need it. 😂","They're doing well. Now is exactly the right time to ask them to help you move furniture. 📦","Ugh, they're keeping pace. Your prize is slipping away in real time. Have you tried guilt-tripping? 🙃"]
const MOTIVATOR_BEHIND      = ["Ooooh they're slipping 👀 This is NOT the time to be supportive. Strategically say nothing.","They're behind pace and your prize is getting closer. Act normal. Do not let them see you smiling. 💅","Things are looking shaky for the workers. Now would be a great time to cook a big delicious dinner. Distract them. 🍝","Behind pace and cracking. Send a meme about rest days. You're just being thoughtful. 😈"]
const MOTIVATOR_RED         = ["They are IN TROUBLE. Stay calm. Act concerned. Internally: 🎉🎉🎉","This is basically over. Your prize is so close you can taste it. DO NOT say anything that motivates them. 🤫","They're cooked and they don't fully know it yet. Let them figure it out on their own timeline. 💅","Secured. You've won this in your heart already. The math just needs to catch up. Stay quiet. 😏"]
const DRAFT_NUDGES_WINNING  = ["Your team is ahead and they know it 🔥 Don't let them catch up — keep logging.","Leading the pack. Your opponents are stress-refreshing this page. Keep the pressure on. 💥","In front and looking dangerous. This is NOT the time to coast. Extend the lead. 🏆","Winning feels good. Know what feels better? Finishing what you started. Log something today. 💪"]
const DRAFT_NUDGES_ON_TRACK = ["Your team is keeping pace 💪 Don't give them an opening to catch up.","On track and competitive. Your opponents are watching your every move. Give them nothing. 👀","Right on schedule. Every workout you skip is points you're handing to the other team. 🎯","Locked in. Keep the momentum going — the other team isn't slowing down. 😤"]
const DRAFT_NUDGES_BEHIND   = ["Your team is slipping 😬 The other side just quietly pulled ahead. Time to respond.","Behind pace and falling. This is exactly what the other team was hoping for. Disappoint them. 🏃","You're letting them win without a fight. Log a workout. Literally anything. 📉","Falling behind? Bold strategy. Real bold. Maybe try going to the gym instead? Just a thought. ⚠️"]
const DRAFT_NUDGES_RED      = ["🚨 Your team is getting cooked. At this pace the other team wins by default. Someone needs to act NOW.","This is ugly. Your opponents are already celebrating. Go prove them wrong — or don't, and pay up. 😭","Complete collapse. Rock bottom. The only way is up. You have to actually GO up. TODAY. 🙏","They've already mentally spent your money. Log a workout and ruin their day. Do it now. 😤"]

function pick(arr: string[], seed: string) {
  const n = seed.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return arr[n % arr.length]
}

// ── Edit toolbar (shared) ─────────────────────────────────────────────────────

function EditToolbar({ label, isFirst, isLast, isHidden, onMoveUp, onMoveDown, onToggleHide }: {
  label: string; isFirst: boolean; isLast: boolean; isHidden: boolean
  onMoveUp: () => void; onMoveDown: () => void; onToggleHide: () => void
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-gray-800/60 border-b border-gray-700">
      <div className="flex gap-1">
        <button onClick={onMoveUp} disabled={isFirst} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-20 disabled:cursor-not-allowed transition-colors text-sm">↑</button>
        <button onClick={onMoveDown} disabled={isLast} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-20 disabled:cursor-not-allowed transition-colors text-sm">↓</button>
      </div>
      <span className="text-gray-500 text-xs flex-1 truncate">{label}</span>
      <button onClick={onToggleHide} className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${isHidden ? 'bg-green-900/40 text-green-400 hover:bg-green-900/60' : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white'}`}>
        {isHidden ? 'Restore' : 'Hide'}
      </button>
    </div>
  )
}

// ── Wager: WorkerCard ─────────────────────────────────────────────────────────

function WorkerCard({ challenge, userId, collapsed, onToggleCollapse, editMode, isFirst, isLast, isHidden, onMoveUp, onMoveDown, onToggleHide }: {
  challenge: ChallengeData; userId: string; collapsed: boolean; onToggleCollapse: () => void
  editMode: boolean; isFirst: boolean; isLast: boolean; isHidden: boolean
  onMoveUp: () => void; onMoveDown: () => void; onToggleHide: () => void
}) {
  const me = challenge.workers.find(w => w.profile.id === userId)
  const allOnTrack = challenge.workers.every(w => w.onTrack)
  const anyAtRisk = challenge.workers.some(w => !w.onTrack)
  const ptsNeeded = me ? Math.max(0, challenge.threshold - me.points) : 0
  const ptsPerDay = challenge.daysLeft > 0 ? Math.ceil(ptsNeeded / challenge.daysLeft) : ptsNeeded
  const seed = challenge.id + userId
  let nudge = ''
  if (me) {
    if (me.projected >= challenge.threshold * 1.2) nudge = pick(WORKER_NUDGES_CRUSHING, seed)
    else if (me.onTrack) nudge = pick(WORKER_NUDGES_ON_TRACK, seed)
    else if (me.projected >= challenge.threshold * 0.6) nudge = pick(WORKER_NUDGES_BEHIND, seed)
    else nudge = pick(WORKER_NUDGES_RED, seed)
  }
  const statusBorder = isHidden ? 'border-gray-800' : allOnTrack ? 'border-green-700/50' : anyAtRisk ? 'border-red-700/50' : 'border-yellow-700/50'

  return (
    <div className={`rounded-2xl border ${statusBorder} ${isHidden ? 'bg-gray-900/40 opacity-50' : 'bg-gray-900'} overflow-hidden transition-opacity`}>
      {editMode && <EditToolbar label={challenge.title} isFirst={isFirst} isLast={isLast} isHidden={isHidden} onMoveUp={onMoveUp} onMoveDown={onMoveDown} onToggleHide={onToggleHide} />}
      <button onClick={onToggleCollapse} className="w-full text-left px-4 pt-4 pb-3 border-b border-gray-800">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base">💪</span>
              <h3 className="text-white font-bold text-base">{challenge.title}</h3>
            </div>
            {collapsed ? (
              <p className="text-xs text-gray-500 mt-1">
                {me ? `You: ${me.points}/${challenge.threshold} pts` : `${challenge.workers.length} workers`} · {challenge.daysLeft > 1 ? `${challenge.daysLeft}d left` : 'Last day 🔥'}
              </p>
            ) : (
              <p className="text-xs text-gray-500 mt-0.5">
                {challenge.daysLeft > 1 ? `${challenge.daysLeft} days left` : challenge.daysLeft === 1 ? 'Last day! 🔥' : 'Final hours! 🔥'}
                {challenge.endDate && ` · ends ${challenge.endDate}`}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${allOnTrack ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'}`}>
              {allOnTrack ? 'ON TRACK ✓' : 'AT RISK ⚠'}
            </span>
            <span className="text-gray-600 text-sm">{collapsed ? '›' : '⌄'}</span>
          </div>
        </div>
        {!collapsed && challenge.endTimestamp && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-gray-600 text-xs">⏱</span>
            <CountdownTimer endTimestamp={challenge.endTimestamp} />
            <span className="text-gray-600 text-xs">remaining</span>
          </div>
        )}
      </button>
      {!collapsed && (
        <>
          <div className="px-4 py-3 border-b border-gray-800">
            <p className="text-xs text-gray-600 uppercase tracking-wide mb-2">Workers</p>
            <div className="space-y-3">
              {challenge.workers.map(w => {
                const isMe = w.profile.id === userId
                return (
                  <div key={w.profile.id}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        {isMe ? <span className="text-xs text-gray-400">👤 You</span> : <Link href={`/player/${w.profile.username}`} className="text-xs text-gray-400 hover:text-white transition-colors">{w.profile.display_name.split(' ')[0]}</Link>}
                        {!w.onTrack && <span className="text-xs text-red-400">⚠</span>}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className={`text-sm font-bold ${w.onTrack ? 'text-green-400' : 'text-red-400'}`}>{w.points}</span>
                        <span className="text-gray-600 text-xs">/ {challenge.threshold}</span>
                      </div>
                    </div>
                    <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${w.pct >= 100 ? 'bg-green-500' : w.onTrack ? 'bg-blue-500' : 'bg-red-500'}`} style={{ width: `${Math.min(100, w.pct)}%` }} />
                    </div>
                    {isMe && w.points < challenge.threshold && (
                      <p className="text-xs text-gray-600 mt-0.5">
                        Projected: <span className={w.projected >= challenge.threshold ? 'text-green-400' : 'text-red-400'}>{w.projected} pts</span>
                        {ptsNeeded > 0 && ` · need ${ptsNeeded} more`}
                        {challenge.daysLeft > 0 && ptsPerDay > 0 && ` (${ptsPerDay}/day)`}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          {challenge.motivators.length > 0 && (
            <div className="px-4 py-3 border-b border-gray-800">
              <p className="text-xs text-gray-600 uppercase tracking-wide mb-1.5">Motivators</p>
              <div className="flex flex-wrap gap-2">
                {challenge.motivators.map(m => (
                  <Link key={m.id} href={`/player/${m.username}`} className="text-xs bg-gray-800 text-gray-300 hover:text-white px-2 py-1 rounded-lg transition-colors">💅 {m.display_name.split(' ')[0]}</Link>
                ))}
              </div>
            </div>
          )}
          {nudge && (
            <div className={`px-4 py-3 border-b border-gray-800 border-l-4 ${allOnTrack ? 'border-l-green-500' : anyAtRisk ? 'border-l-red-500' : 'border-l-gray-600'}`}>
              <p className="text-xs text-gray-300 leading-relaxed">{nudge}</p>
            </div>
          )}
          {me && me.points < challenge.threshold && challenge.daysLeft >= 0 && (
            <div className="px-4 py-3 border-b border-gray-800">
              <WorkoutPlanButton pointsNeeded={Math.max(1, challenge.threshold - me.points)} hoursLeft={Math.max(4, challenge.daysLeft * 24)} daysLeft={challenge.daysLeft} />
            </div>
          )}
          <div className="px-4 py-3 grid grid-cols-2 gap-3">
            <div><p className="text-xs text-gray-600 mb-0.5">If workers win</p><p className="text-green-400 text-xs font-medium">{challenge.stakeIfWorkers}</p></div>
            <div><p className="text-xs text-gray-600 mb-0.5">If motivators win</p><p className="text-red-400 text-xs font-medium">{challenge.stakeIfMotivators}</p></div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Wager: MotivatorCard ──────────────────────────────────────────────────────

function MotivatorCard({ challenge, userId, collapsed, onToggleCollapse, editMode, isFirst, isLast, isHidden, onMoveUp, onMoveDown, onToggleHide }: {
  challenge: ChallengeData; userId: string; collapsed: boolean; onToggleCollapse: () => void
  editMode: boolean; isFirst: boolean; isLast: boolean; isHidden: boolean
  onMoveUp: () => void; onMoveDown: () => void; onToggleHide: () => void
}) {
  const anyAtRisk = challenge.workers.some(w => !w.onTrack)
  const allAtRisk = challenge.workers.every(w => !w.onTrack)
  const allOnTrack = challenge.workers.every(w => w.onTrack)
  const seed = challenge.id + userId
  let nudge = ''
  if (allAtRisk) nudge = pick(MOTIVATOR_RED, seed)
  else if (anyAtRisk) nudge = pick(MOTIVATOR_BEHIND, seed)
  else nudge = pick(MOTIVATOR_ON_TRACK, seed)
  const statusBorder = isHidden ? 'border-gray-800' : allAtRisk ? 'border-purple-700/50' : anyAtRisk ? 'border-purple-700/30' : 'border-gray-700'

  return (
    <div className={`rounded-2xl border ${statusBorder} ${isHidden ? 'bg-gray-900/40 opacity-50' : 'bg-gray-900'} overflow-hidden transition-opacity`}>
      {editMode && <EditToolbar label={challenge.title} isFirst={isFirst} isLast={isLast} isHidden={isHidden} onMoveUp={onMoveUp} onMoveDown={onMoveDown} onToggleHide={onToggleHide} />}
      <button onClick={onToggleCollapse} className="w-full text-left px-4 pt-4 pb-3 border-b border-gray-800">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base">💅</span>
              <h3 className="text-white font-bold text-base">{challenge.title}</h3>
            </div>
            {collapsed ? (
              <p className="text-xs text-gray-500 mt-1">
                {allAtRisk ? "They're struggling 👀" : anyAtRisk ? 'One is slipping...' : "They're on track 😤"} · {challenge.daysLeft > 1 ? `${challenge.daysLeft}d left` : 'Last day 🔥'}
              </p>
            ) : (
              <p className="text-xs text-gray-500 mt-0.5">
                {challenge.daysLeft > 1 ? `${challenge.daysLeft} days left` : challenge.daysLeft === 1 ? 'Last day! 🔥' : 'Final hours! 🔥'}
                {' · '}<span className={allOnTrack ? 'text-gray-400' : 'text-purple-400'}>{allAtRisk ? "They're struggling 👀" : anyAtRisk ? 'One is slipping...' : "They're on track 😤"}</span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {allAtRisk && <span className="text-xs font-bold px-2 py-1 rounded-full bg-purple-900/40 text-purple-400">YOUR WIN 💅</span>}
            <span className="text-gray-600 text-sm">{collapsed ? '›' : '⌄'}</span>
          </div>
        </div>
        {!collapsed && challenge.endTimestamp && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-gray-600 text-xs">⏱</span>
            <CountdownTimer endTimestamp={challenge.endTimestamp} />
            <span className="text-gray-600 text-xs">remaining</span>
          </div>
        )}
      </button>
      {!collapsed && (
        <>
          <div className="px-4 py-3 border-b border-gray-800">
            <p className="text-xs text-gray-600 uppercase tracking-wide mb-2">Workers</p>
            <div className="space-y-3">
              {challenge.workers.map(w => (
                <div key={w.profile.id}>
                  <div className="flex items-center justify-between mb-1">
                    <Link href={`/player/${w.profile.username}`} className="text-xs text-gray-400 hover:text-white transition-colors">{w.profile.display_name.split(' ')[0]}</Link>
                    <div className="flex items-center gap-1">
                      <span className={`text-sm font-bold ${w.onTrack ? 'text-blue-400' : 'text-red-400'}`}>{w.points}</span>
                      <span className="text-gray-600 text-xs">/ {challenge.threshold}</span>
                      <span className="text-xs ml-1">{w.onTrack ? '😤' : '😬'}</span>
                    </div>
                  </div>
                  <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${w.onTrack ? 'bg-blue-600' : 'bg-red-600'}`} style={{ width: `${Math.min(100, w.pct)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className={`px-4 py-3 border-b border-gray-800 border-l-4 ${allAtRisk ? 'border-l-purple-400' : anyAtRisk ? 'border-l-purple-600' : 'border-l-gray-600'}`}>
            <p className="text-xs text-gray-300 leading-relaxed">{nudge}</p>
          </div>
          <div className="px-4 py-3">
            <p className="text-xs text-gray-600 mb-0.5">Your prize if they slip</p>
            <p className="text-purple-300 text-xs font-medium">{challenge.stakeIfMotivators}</p>
          </div>
        </>
      )}
    </div>
  )
}

// ── Draft card ────────────────────────────────────────────────────────────────

function DraftCard({ comp, collapsed, onToggleCollapse, editMode, isFirst, isLast, isHidden, onMoveUp, onMoveDown, onToggleHide }: {
  comp: DraftCompetitionData; collapsed: boolean; onToggleCollapse: () => void
  editMode: boolean; isFirst: boolean; isLast: boolean; isHidden: boolean
  onMoveUp: () => void; onMoveDown: () => void; onToggleHide: () => void
}) {
  const myTeamPlayers = comp.myTeam === 'a' ? comp.teamA : comp.myTeam === 'b' ? comp.teamB : []
  const opponents    = comp.myTeam === 'a' ? comp.teamB : comp.myTeam === 'b' ? comp.teamA  : []
  const myTeamLabel  = comp.myTeam === 'a' ? 'Team A' : comp.myTeam === 'b' ? 'Team B' : ''
  const oppLabel     = comp.myTeam === 'a' ? 'Team B' : 'Team A'
  const myCaptainId  = comp.myTeam === 'a' ? comp.captainAId : comp.captainBId
  const oppCaptainId = comp.myTeam === 'a' ? comp.captainBId : comp.captainAId

  const myTotal  = myTeamPlayers.reduce((s, p) => s + p.points, 0)
  const oppTotal = opponents.reduce((s, p) => s + p.points, 0)
  const minRequired = comp.minContributionPct > 0 ? Math.ceil((comp.pointGoal * comp.minContributionPct) / 100) : 0

  // Goal-based winning: a team wins when they hit pointGoal AND every member
  // meets the minimum contribution. Raw totals don't matter once the goal is hit.
  const myHitGoal  = myTotal  >= comp.pointGoal && (minRequired === 0 || myTeamPlayers.every(p => p.points >= minRequired))
  const oppHitGoal = oppTotal >= comp.pointGoal && (minRequired === 0 || opponents.every(p => p.points >= minRequired))
  const imWinning  = myHitGoal  || (!oppHitGoal && myTotal > oppTotal)
  const imLosing   = !myHitGoal && (oppHitGoal  || oppTotal > myTotal)
  const teamProjected = comp.daysElapsed > 0 ? Math.round((myTotal / comp.daysElapsed) * comp.daysTotal) : myTotal
  const teamOnTrack = teamProjected >= comp.pointGoal || myTotal >= comp.pointGoal
  const myProgress = myTeamPlayers.find(p => p.isMe)
  const myPts = myProgress?.points ?? 0
  const myMinNeeded = Math.max(0, minRequired - myPts)
  const teamPtsNeeded = Math.max(0, comp.pointGoal - myTotal)
  const daysLeftNum = comp.daysLeft ?? 0
  const workoutTarget = myMinNeeded > 0 ? myMinNeeded : myTeamPlayers.length > 0 ? Math.ceil(teamPtsNeeded / myTeamPlayers.length) : teamPtsNeeded

  const seed = comp.id + (myProgress?.profile?.id ?? '')
  let nudge = ''
  if (comp.isParticipant && myTeamPlayers.length > 0) {
    if (imWinning && teamProjected >= comp.pointGoal * 1.2) nudge = pick(DRAFT_NUDGES_WINNING, seed)
    else if (teamOnTrack) nudge = pick(DRAFT_NUDGES_ON_TRACK, seed)
    else if (teamProjected >= comp.pointGoal * 0.6) nudge = pick(DRAFT_NUDGES_BEHIND, seed)
    else nudge = pick(DRAFT_NUDGES_RED, seed)
  }

  const statusBorder = isHidden ? 'border-gray-800' : imWinning ? 'border-green-700/50' : imLosing ? 'border-red-700/50' : 'border-gray-700'
  const statusBadge  = imWinning ? { cls: 'bg-green-900/40 text-green-400', label: 'WINNING 🏆' } : imLosing ? { cls: 'bg-red-900/40 text-red-400', label: 'LOSING ⚠' } : { cls: 'bg-gray-800 text-gray-400', label: 'TIED 🤝' }
  const allMyOnTrack = myTeamPlayers.every(p => { if (minRequired === 0) return true; const proj = comp.daysElapsed > 0 ? Math.round((p.points / comp.daysElapsed) * comp.daysTotal) : p.points; return proj >= minRequired || p.points >= minRequired })
  const anyMyAtRisk  = !allMyOnTrack

  return (
    <div className={`rounded-2xl border ${statusBorder} ${isHidden ? 'bg-gray-900/40 opacity-50' : 'bg-gray-900'} overflow-hidden transition-opacity`}>
      {editMode && <EditToolbar label={comp.name} isFirst={isFirst} isLast={isLast} isHidden={isHidden} onMoveUp={onMoveUp} onMoveDown={onMoveDown} onToggleHide={onToggleHide} />}
      <div className="px-4 pt-4 pb-3 border-b border-gray-800">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/draft/${comp.id}`} className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base">⚔️</span>
              <h3 className="text-white font-bold text-base">{comp.name}</h3>
              <span className="text-xs bg-blue-900/40 text-blue-400 px-2 py-0.5 rounded-full font-medium shrink-0">DRAFT</span>
            </div>
            {collapsed ? (
              <p className="text-xs text-gray-500 mt-1">
                {comp.isParticipant ? `My team ${myTotal} — Opp ${oppTotal}` : `${comp.pointGoal} pt goal`} · {comp.daysLeft != null ? (comp.daysLeft > 0 ? `${comp.daysLeft}d left` : 'Last day 🔥') : 'ongoing'}
              </p>
            ) : (
              <p className="text-xs text-gray-500 mt-0.5">
                {comp.daysLeft !== null ? comp.daysLeft > 1 ? `${comp.daysLeft} days left` : comp.daysLeft === 1 ? 'Last day! 🔥' : 'Final hours! 🔥' : 'Ongoing'}
                {comp.endDate && ` · ends ${comp.endDate}`}
                {!comp.endDate && ` · started ${comp.startDate}`}
              </p>
            )}
          </Link>
          <div className="flex items-center gap-2 shrink-0">
            {comp.isParticipant && <span className={`text-xs font-bold px-2 py-1 rounded-full ${statusBadge.cls}`}>{statusBadge.label}</span>}
            <button onClick={onToggleCollapse} className="w-7 h-7 flex items-center justify-center text-gray-600 hover:text-gray-300 transition-colors text-sm rounded-lg hover:bg-gray-800">
              {collapsed ? '›' : '⌄'}
            </button>
          </div>
        </div>
        {!collapsed && comp.endTimestamp && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-gray-600 text-xs">⏱</span>
            <CountdownTimer endTimestamp={comp.endTimestamp} />
            <span className="text-gray-600 text-xs">remaining</span>
          </div>
        )}
      </div>
      {!collapsed && (
        <>
          {comp.isParticipant && myTeamPlayers.length > 0 && (
            <div className="px-4 py-3 border-b border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-600 uppercase tracking-wide">Your Team ({myTeamLabel})</p>
                <span className={`text-xs font-medium ${allMyOnTrack ? 'text-green-400' : anyMyAtRisk ? 'text-red-400' : 'text-gray-400'}`}>{myTotal} pts total</span>
              </div>
              <div className="space-y-3">
                {myTeamPlayers.map(p => {
                  const pct = minRequired > 0 ? Math.min(100, (p.points / minRequired) * 100) : 0
                  const projected = comp.daysElapsed > 0 ? Math.round((p.points / comp.daysElapsed) * comp.daysTotal) : p.points
                  const onTrack = minRequired > 0 ? projected >= minRequired || p.points >= minRequired : true
                  const ptsNeeded = Math.max(0, minRequired - p.points)
                  const ptsPerDay = daysLeftNum > 0 && ptsNeeded > 0 ? Math.ceil(ptsNeeded / daysLeftNum) : 0
                  return (
                    <div key={p.profile.id}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-400">{p.isMe ? '👤 You' : p.profile.display_name.split(' ')[0]}{p.profile.id === myCaptainId ? ' ©' : ''}</span>
                          {!onTrack && p.points < (minRequired || 0) && <span className="text-xs text-red-400">⚠</span>}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className={`text-sm font-bold ${onTrack ? 'text-green-400' : 'text-red-400'}`}>{p.points}</span>
                          {minRequired > 0 && <span className="text-gray-600 text-xs">/ {minRequired}</span>}
                        </div>
                      </div>
                      <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : onTrack ? 'bg-blue-500' : 'bg-red-500'}`} style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                      {p.isMe && minRequired > 0 && p.points < minRequired && (
                        <p className="text-xs text-gray-600 mt-0.5">
                          Projected: <span className={projected >= minRequired ? 'text-green-400' : 'text-red-400'}>{projected} pts</span>
                          {ptsNeeded > 0 && ` · need ${ptsNeeded} more`}{ptsPerDay > 0 && ` (${ptsPerDay}/day)`}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
              <div className="mt-3 pt-2 border-t border-gray-800/60">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-600">Team total toward goal</span>
                  <span className="text-xs text-gray-500">{myTotal} / {comp.pointGoal} pts</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${myHitGoal ? 'bg-green-500' : myTotal / comp.pointGoal >= 0.7 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${Math.min(100, (myTotal / comp.pointGoal) * 100)}%` }} />
                </div>
                {myHitGoal && <p className="text-xs text-green-400 mt-0.5 font-medium">🎯 Goal reached!</p>}
                {!myHitGoal && teamPtsNeeded > 0 && <p className="text-xs text-gray-600 mt-0.5">Team needs <span className="text-white">{teamPtsNeeded} more pts</span>{daysLeftNum > 0 && ` · ~${Math.ceil(teamPtsNeeded / daysLeftNum)}/day pace`}</p>}
              </div>
            </div>
          )}
          <div className="px-4 py-3 border-b border-gray-800">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-600 uppercase tracking-wide">{comp.isParticipant ? `Opponents (${oppLabel})` : oppLabel}</p>
              <span className={`text-xs font-medium ${oppTotal > myTotal ? 'text-red-400' : 'text-gray-500'}`}>{oppTotal} pts total</span>
            </div>
            <div className="space-y-2.5">
              {opponents.map(p => (
                <div key={p.profile.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-400">{p.profile.display_name.split(' ')[0]}{p.profile.id === oppCaptainId ? ' ©' : ''}</span>
                    <div className="flex items-center gap-1">
                      <span className={`text-sm font-bold ${minRequired > 0 && p.points >= minRequired ? 'text-green-400' : 'text-gray-400'}`}>{p.points}</span>
                      {minRequired > 0 && <span className="text-gray-600 text-xs">/ {minRequired}</span>}
                    </div>
                  </div>
                  <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${minRequired > 0 && p.points >= minRequired ? 'bg-green-600' : 'bg-gray-600'}`} style={{ width: `${minRequired > 0 ? Math.min(100, (p.points / minRequired) * 100) : 0}%` }} />
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
                <div className={`h-full rounded-full ${oppHitGoal ? 'bg-green-500' : oppTotal / comp.pointGoal >= 0.7 ? 'bg-yellow-500' : 'bg-gray-600'}`} style={{ width: `${Math.min(100, (oppTotal / comp.pointGoal) * 100)}%` }} />
              </div>
              {oppHitGoal && <p className="text-xs text-red-400 mt-0.5 text-right font-medium">⚠ Opponents hit goal</p>}
            </div>
          </div>
          {nudge && (
            <div className={`px-4 py-3 border-b border-gray-800 border-l-4 ${imWinning ? 'border-l-green-500' : imLosing ? 'border-l-red-500' : 'border-l-gray-600'}`}>
              <p className="text-xs text-gray-300 leading-relaxed">{nudge}</p>
            </div>
          )}
          {comp.isParticipant && myProgress && myPts < comp.pointGoal && (
            <div className="px-4 py-3 border-b border-gray-800">
              <WorkoutPlanButton pointsNeeded={Math.max(1, workoutTarget)} hoursLeft={Math.max(4, daysLeftNum * 24)} daysLeft={daysLeftNum} />
            </div>
          )}
          <div className="px-4 py-3">
            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-xs text-gray-600 mb-0.5">At stake</p><p className="text-yellow-400 text-xs font-medium">💰 {comp.wagerDescription || 'Bragging rights'}</p></div>
              <div><p className="text-xs text-gray-600 mb-0.5">Goal</p><p className="text-gray-400 text-xs font-medium">{comp.pointGoal} pts/team{minRequired > 0 && <span className="text-gray-600"> · min {minRequired} each</span>}</p></div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

type Item =
  | { kind: 'worker'; key: string; data: ChallengeData }
  | { kind: 'motivator'; key: string; data: ChallengeData }
  | { kind: 'draft'; key: string; data: DraftCompetitionData }

export default function LiveAllCompetitions({
  challenges,
  draftChallenges,
  currentUserId,
}: {
  challenges: ChallengeData[]
  draftChallenges: DraftCompetitionData[]
  currentUserId: string
}) {
  const [prefs, setPrefs] = useState<DisplayPrefs>({ order: [], hidden: [], collapsed: [] })
  const [editMode, setEditMode] = useState(false)

  useEffect(() => { setPrefs(loadPrefs()) }, [])

  // Build flat item list — prefix keys to avoid ID collision between wagers and drafts
  const allItems: Item[] = [
    ...challenges
      .filter(c => c.isWorker || c.isMotivator)
      .map(c => ({
        kind: (c.isWorker ? 'worker' : 'motivator') as 'worker' | 'motivator',
        key: `w:${c.id}`,
        data: c,
      })),
    ...draftChallenges.map(d => ({ kind: 'draft' as const, key: `d:${d.id}`, data: d })),
  ]

  if (allItems.length === 0) {
    return (
      <div className="bg-gray-900 rounded-2xl p-8 text-center border border-gray-800">
        <p className="text-3xl mb-3">🏆</p>
        <p className="text-white font-semibold">No live competitions</p>
        <p className="text-gray-500 text-sm mt-1">Create a wager to get the competition going.</p>
        <Link href="/wagers" className="inline-block mt-4 text-green-400 text-sm hover:text-green-300">Create a challenge →</Link>
      </div>
    )
  }

  function updatePrefs(next: DisplayPrefs) { setPrefs(next); savePrefs(next) }

  const sorted = [...allItems].sort((a, b) => {
    const ai = prefs.order.indexOf(a.key)
    const bi = prefs.order.indexOf(b.key)
    if (ai === -1 && bi === -1) return 0
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })

  const visible = editMode ? sorted : sorted.filter(i => !prefs.hidden.includes(i.key))
  const hiddenCount = sorted.filter(i => prefs.hidden.includes(i.key)).length

  function currentOrder() { return sorted.map(i => i.key) }

  function moveUp(key: string) {
    const order = currentOrder(); const idx = order.indexOf(key)
    if (idx <= 0) return
    const next = [...order]; [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
    updatePrefs({ ...prefs, order: next })
  }

  function moveDown(key: string) {
    const order = currentOrder(); const idx = order.indexOf(key)
    if (idx >= order.length - 1) return
    const next = [...order]; [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]]
    updatePrefs({ ...prefs, order: next })
  }

  function toggleHide(key: string) {
    const hidden = prefs.hidden.includes(key) ? prefs.hidden.filter(x => x !== key) : [...prefs.hidden, key]
    updatePrefs({ ...prefs, hidden })
  }

  function toggleCollapse(key: string) {
    const collapsed = prefs.collapsed.includes(key) ? prefs.collapsed.filter(x => x !== key) : [...prefs.collapsed, key]
    updatePrefs({ ...prefs, collapsed })
  }

  const sharedProps = (item: Item, idx: number) => ({
    collapsed: prefs.collapsed.includes(item.key),
    onToggleCollapse: () => toggleCollapse(item.key),
    editMode,
    isFirst: idx === 0,
    isLast: idx === visible.length - 1,
    isHidden: prefs.hidden.includes(item.key),
    onMoveUp: () => moveUp(item.key),
    onMoveDown: () => moveDown(item.key),
    onToggleHide: () => toggleHide(item.key),
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-gray-600 uppercase tracking-wide font-medium">
          Live Competitions{hiddenCount > 0 && !editMode ? ` · ${hiddenCount} hidden` : ''}
        </span>
        <button
          onClick={() => setEditMode(e => !e)}
          className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${editMode ? 'bg-green-600 text-black' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
        >
          {editMode ? 'Done' : 'Manage'}
        </button>
      </div>

      {visible.map((item, idx) => {
        const props = sharedProps(item, idx)
        if (item.kind === 'worker') return <WorkerCard key={item.key} challenge={item.data} userId={currentUserId} {...props} />
        if (item.kind === 'motivator') return <MotivatorCard key={item.key} challenge={item.data} userId={currentUserId} {...props} />
        return <DraftCard key={item.key} comp={item.data} {...props} />
      })}

      {visible.length === 0 && hiddenCount > 0 && (
        <p className="text-gray-600 text-sm text-center py-4">
          All competitions are hidden.{' '}
          <button onClick={() => setEditMode(true)} className="text-gray-400 underline">Manage</button> to restore them.
        </p>
      )}
    </div>
  )
}
