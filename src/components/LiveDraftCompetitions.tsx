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

function PlayerRow({
  p,
  captainId,
  threshold,
  daysElapsed,
  daysTotal,
  daysLeftNum,
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

function DraftCompetitionCard({ comp }: { comp: DraftCompetitionData }) {
  const myTeamPlayers = comp.myTeam === 'a' ? comp.teamA : comp.myTeam === 'b' ? comp.teamB : []
  const opponents    = comp.myTeam === 'a' ? comp.teamB : comp.myTeam === 'b' ? comp.teamA  : []
  const myTeamLabel  = comp.myTeam === 'a' ? 'Team A' : comp.myTeam === 'b' ? 'Team B' : ''
  const oppLabel     = comp.myTeam === 'a' ? 'Team B' : 'Team A'
  const myCaptainId  = comp.myTeam === 'a' ? comp.captainAId : comp.captainBId
  const oppCaptainId = comp.myTeam === 'a' ? comp.captainBId : comp.captainAId

  const myTotal  = myTeamPlayers.reduce((s, p) => s + p.points, 0)
  const oppTotal = opponents.reduce((s, p) => s + p.points, 0)

  // Per-player minimum contribution target
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

  // Nudge
  const seed = comp.id + (myProgress?.profile?.id ?? '')
  let nudge = ''
  if (comp.isParticipant && myTeamPlayers.length > 0) {
    if (imWinning && teamProjected >= comp.pointGoal * 1.2) nudge = pick(DRAFT_NUDGES_WINNING, seed)
    else if (teamOnTrack) nudge = pick(DRAFT_NUDGES_ON_TRACK, seed)
    else if (teamProjected >= comp.pointGoal * 0.6) nudge = pick(DRAFT_NUDGES_BEHIND, seed)
    else nudge = pick(DRAFT_NUDGES_RED, seed)
  }

  const statusBorder = imWinning ? 'border-green-700/50' : imLosing ? 'border-red-700/50' : 'border-gray-700'
  const statusBadge  = imWinning
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
    <div className={`rounded-2xl border ${statusBorder} bg-gray-900 overflow-hidden`}>

      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-800">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base">⚔️</span>
              <h3 className="text-white font-bold text-base">{comp.name}</h3>
              <span className="text-xs bg-blue-900/40 text-blue-400 px-2 py-0.5 rounded-full font-medium shrink-0">DRAFT</span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {comp.daysLeft !== null
                ? comp.daysLeft > 1 ? `${comp.daysLeft} days left`
                : comp.daysLeft === 1 ? 'Last day! 🔥'
                : 'Final hours! 🔥'
                : 'Ongoing'}
              {comp.endDate && ` · ends ${comp.endDate}`}
              {!comp.endDate && ` · started ${comp.startDate}`}
            </p>
          </div>
          {comp.isParticipant && (
            <span className={`text-xs font-bold px-2 py-1 rounded-full shrink-0 ${statusBadge.cls}`}>
              {statusBadge.label}
            </span>
          )}
        </div>

        {comp.endTimestamp && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-gray-600 text-xs">⏱</span>
            <CountdownTimer endTimestamp={comp.endTimestamp} />
            <span className="text-gray-600 text-xs">remaining</span>
          </div>
        )}
      </div>

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
          {/* Team total bar */}
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
        {/* Opponent team total bar */}
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
    </div>
  )
}

export default function LiveDraftCompetitions({
  draftChallenges,
}: {
  draftChallenges: DraftCompetitionData[]
}) {
  if (draftChallenges.length === 0) return null

  return (
    <div className="space-y-4">
      {draftChallenges.map(comp => (
        <DraftCompetitionCard key={comp.id} comp={comp} />
      ))}
    </div>
  )
}

