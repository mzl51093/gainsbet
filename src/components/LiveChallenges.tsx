import type { Profile } from '@/lib/types'
import Link from 'next/link'

interface WorkerProgress {
  profile: Profile
  points: number
  pct: number
  onTrack: boolean
  projected: number
}

interface ChallengeData {
  id: string
  title: string
  threshold: number
  weekStart: string
  endDate: string | null
  daysLeft: number
  daysTotal: number
  daysElapsed: number
  stakeIfMotivators: string
  stakeIfWorkers: string
  workers: WorkerProgress[]
  isWorker: boolean
  isMotivator: boolean
}

const WORKER_NUDGES_ON_TRACK = [
  "Solid pace. Don't slow down — the Motivators are watching 👀",
  "You're on track. Keep grinding and this one's yours 🎯",
  "Looking strong. Don't let the couch win this week 💪",
]
const WORKER_NUDGES_BEHIND = [
  "You're falling behind. One solid session puts you back in it ⚡",
  "The Motivators are smelling blood 👀 Time to wake up.",
  "Behind pace but not out. Log something today and close the gap 🏃",
]
const WORKER_NUDGES_RED = [
  "RED ALERT 🚨 You need to grind hard the rest of this week.",
  "They're already planning what to spend it on 💅 Prove them wrong.",
  "This is salvageable. But you need to act NOW ⚠️",
]
const WORKER_NUDGES_CRUSHING = [
  "You're absolutely crushing it 💥 Keep this up.",
  "Machine mode activated. Don't let up 🔥",
  "This is what it looks like when someone wants to WIN 🏆",
]

const MOTIVATOR_ON_TRACK = [
  "They're on track 😤 Quick, send a distraction. ...Just kidding. Maybe.",
  "Looking strong over there. Your dinner plans might be in jeopardy 😂",
  "They're doing well. Better start the trash talk now, soften their focus 👀",
]
const MOTIVATOR_BEHIND = [
  "Ooooh they're slipping 👀 Now's the time to stir the pot a little 😈",
  "They're behind pace... your prize is getting closer 💅 Don't say anything yet.",
  "Send a meme. Send a GIF. Do not let them catch up. 😂",
]
const MOTIVATOR_RED = [
  "This is looking VERY promising for you 💅 Stay quiet and let it happen.",
  "They're in trouble. Try not to look too happy about it 😏",
  "Your prize is basically secured at this rate. Maybe remind them what's at stake? 😈",
]

function pick(arr: string[], seed: string) {
  const n = seed.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return arr[n % arr.length]
}

function WorkerCard({ challenge, userId }: { challenge: ChallengeData; userId: string }) {
  const me = challenge.workers.find(w => w.profile.id === userId)
  const others = challenge.workers.filter(w => w.profile.id !== userId)
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

  const statusColor = allOnTrack ? 'border-green-700/50 bg-green-900/10' : anyAtRisk ? 'border-red-700/50 bg-red-900/10' : 'border-yellow-700/50 bg-yellow-900/10'

  return (
    <div className={`rounded-2xl p-4 border ${statusColor}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base">💪</span>
            <h3 className="text-white font-bold text-sm">{challenge.title}</h3>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {challenge.daysLeft > 0
              ? `${challenge.daysLeft} day${challenge.daysLeft === 1 ? '' : 's'} left`
              : 'Ended'}
            {challenge.endDate && ` · ends ${challenge.endDate}`}
          </p>
        </div>
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${allOnTrack ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'}`}>
          {allOnTrack ? 'ON TRACK ✓' : 'AT RISK ⚠'}
        </span>
      </div>

      {/* Worker progress bars */}
      <div className="space-y-3 mb-3">
        {challenge.workers.map(w => {
          const isMe = w.profile.id === userId
          return (
            <div key={w.profile.id}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-400">{isMe ? '👤 You' : w.profile.display_name.split(' ')[0]}</span>
                  {!w.onTrack && <span className="text-xs text-red-400">⚠</span>}
                </div>
                <div className="flex items-center gap-1">
                  <span className={`text-sm font-bold ${w.onTrack ? 'text-green-400' : 'text-red-400'}`}>{w.points}</span>
                  <span className="text-gray-600 text-xs">/ {challenge.threshold}</span>
                </div>
              </div>
              <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${w.pct >= 100 ? 'bg-green-500' : w.onTrack ? 'bg-blue-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(100, w.pct)}%` }}
                />
              </div>
              {isMe && w.points < challenge.threshold && (
                <p className="text-xs text-gray-600 mt-0.5">
                  Projected: <span className={w.projected >= challenge.threshold ? 'text-green-400' : 'text-red-400'}>{w.projected} pts</span>
                  {ptsNeeded > 0 && ` · need ${ptsNeeded} more`}
                  {challenge.daysLeft > 0 && ptsPerDay > 0 && ` (${ptsPerDay} pts/day)`}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Nudge */}
      {nudge && (
        <div className="bg-gray-800/60 rounded-xl px-3 py-2 mb-3">
          <p className="text-xs text-gray-300">{nudge}</p>
        </div>
      )}

      {/* Stakes */}
      <div className="flex gap-2 text-xs">
        <span className="text-gray-600">If you win:</span>
        <span className="text-green-400 font-medium flex-1">{challenge.stakeIfWorkers}</span>
      </div>
      <div className="flex gap-2 text-xs mt-0.5">
        <span className="text-gray-600">If they win:</span>
        <span className="text-red-400 font-medium flex-1">{challenge.stakeIfMotivators}</span>
      </div>
    </div>
  )
}

function MotivatorCard({ challenge, userId }: { challenge: ChallengeData; userId: string }) {
  const anyAtRisk = challenge.workers.some(w => !w.onTrack)
  const allAtRisk = challenge.workers.every(w => !w.onTrack)
  const allOnTrack = challenge.workers.every(w => w.onTrack)
  const seed = challenge.id + userId

  let nudge = ''
  if (allAtRisk) nudge = pick(MOTIVATOR_RED, seed)
  else if (anyAtRisk) nudge = pick(MOTIVATOR_BEHIND, seed)
  else nudge = pick(MOTIVATOR_ON_TRACK, seed)

  const statusColor = allAtRisk ? 'border-purple-700/50 bg-purple-900/10' : anyAtRisk ? 'border-purple-700/30 bg-purple-900/5' : 'border-gray-700 bg-gray-900/50'

  return (
    <div className={`rounded-2xl p-4 border ${statusColor}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base">💅</span>
            <h3 className="text-white font-bold text-sm">{challenge.title}</h3>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {challenge.daysLeft > 0 ? `${challenge.daysLeft} days left` : 'Ended'}
            {' · '}
            <span className={allOnTrack ? 'text-gray-400' : 'text-purple-400'}>
              {allAtRisk ? 'They\'re struggling 👀' : anyAtRisk ? 'One is slipping...' : 'They\'re on track 😤'}
            </span>
          </p>
        </div>
        {allAtRisk && (
          <span className="text-xs font-bold px-2 py-1 rounded-full bg-purple-900/40 text-purple-400">YOUR WIN 💅</span>
        )}
      </div>

      {/* Worker progress bars - motivator view */}
      <div className="space-y-3 mb-3">
        {challenge.workers.map(w => (
          <div key={w.profile.id}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-400">{w.profile.display_name.split(' ')[0]}</span>
              <div className="flex items-center gap-1">
                <span className={`text-sm font-bold ${w.onTrack ? 'text-blue-400' : 'text-red-400'}`}>{w.points}</span>
                <span className="text-gray-600 text-xs">/ {challenge.threshold}</span>
                <span className="text-xs ml-1">{w.onTrack ? '😤' : '😬'}</span>
              </div>
            </div>
            <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${w.onTrack ? 'bg-blue-600' : 'bg-red-600'}`}
                style={{ width: `${Math.min(100, w.pct)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Motivator nudge */}
      <div className="bg-purple-900/20 border border-purple-700/30 rounded-xl px-3 py-2 mb-3">
        <p className="text-xs text-purple-200">{nudge}</p>
      </div>

      {/* Prize */}
      <div className="flex gap-2 text-xs">
        <span className="text-gray-600">Your prize if they slip:</span>
        <span className="text-purple-300 font-medium flex-1">{challenge.stakeIfMotivators}</span>
      </div>
    </div>
  )
}

export default function LiveChallenges({
  challenges,
  currentUserId,
}: {
  challenges: ChallengeData[]
  currentUserId: string
}) {
  if (challenges.length === 0) return null

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-white font-semibold">Live Challenges 🔥</h2>
        <Link href="/wagers" className="text-sm text-gray-500 hover:text-gray-300">See all</Link>
      </div>
      <div className="space-y-3">
        {challenges.map(c =>
          c.isWorker
            ? <WorkerCard key={c.id} challenge={c} userId={currentUserId} />
            : c.isMotivator
            ? <MotivatorCard key={c.id} challenge={c} userId={currentUserId} />
            : null
        )}
      </div>
    </div>
  )
}

export type { ChallengeData }
