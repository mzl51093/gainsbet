import type { Profile } from '@/lib/types'
import Link from 'next/link'
import WorkoutPlanButton from './WorkoutPlanButton'

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
  "You're on pace. Don't get cocky — the couch is always one bad day away from winning. 🛋️",
  "Solid. Your motivator is currently stress-eating and pretending not to care. Keep going. 😤",
  "On track and looking good. This is the part where you DON'T celebrate early like an idiot. 🎯",
  "Progress confirmed. Your motivator has been suspiciously quiet. That means they're nervous. 👀",
]
const WORKER_NUDGES_BEHIND = [
  "Behind pace. Your motivator just smiled at their phone. That smile was about YOU. Do something. 😬",
  "You're slipping. At this rate your prize money is going to a spa day you're not invited to. 💅",
  "Falling behind? Bold strategy. Real bold. Maybe try going to the gym instead? Just a thought. 🏃",
  "The gap is real. The couch is winning. This is genuinely embarrassing and we say that with love. ⚠️",
]
const WORKER_NUDGES_RED = [
  "🚨 RED ALERT. Your motivator is already texting about what to spend it on. We've seen the receipts.",
  "At this trajectory you are COOKED. Like, fully done. Medium-well. Time to do literally anything physical.",
  "This is rock bottom. The good news: the only way is up. The bad news: you have to actually go up. NOW. 😭",
  "Your motivator has already picked out what they're ordering. Go to the gym. We are begging you. 🙏",
]
const WORKER_NUDGES_CRUSHING = [
  "Absolutely destroying it 💥 Your motivator is in full panic mode. Do NOT let them recover.",
  "Machine. Literal machine. Your motivator has gone suspiciously quiet. Finish them. 🏆",
  "This is what peak performance looks like. Disgusting. We mean that as a compliment. Keep going. 🔥",
  "You're so far ahead it's almost unfair. Almost. It's actually completely fair and you earned it. 💪",
]

const MOTIVATOR_ON_TRACK = [
  "They're on track 😤 Annoying, right? Maybe accidentally schedule something during their gym time.",
  "Looking strong over there. Start mentally preparing your gracious loser speech. You'll need it. 😂",
  "They're doing well. Now is exactly the right time to ask them to help you move furniture. 📦",
  "Ugh, they're keeping pace. Your prize is slipping away in real time. Have you tried guilt-tripping? 🙃",
]
const MOTIVATOR_BEHIND = [
  "Ooooh they're slipping 👀 This is NOT the time to be supportive. Strategically say nothing.",
  "They're behind pace and your prize is getting closer. Act normal. Do not let them see you smiling. 💅",
  "Things are looking shaky for the workers. Now would be a great time to cook a big delicious dinner. Distract them. 🍝",
  "Behind pace and cracking. Send a meme about rest days. You're just being thoughtful. 😈",
]
const MOTIVATOR_RED = [
  "They are IN TROUBLE. Stay calm. Act concerned. Internally: 🎉🎉🎉",
  "This is basically over. Your prize is so close you can taste it. DO NOT say anything that motivates them. 🤫",
  "They're cooked and they don't fully know it yet. Let them figure it out on their own timeline. 💅",
  "Secured. You've won this in your heart already. The math just needs to catch up. Stay quiet. 😏",
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
            {challenge.daysLeft > 1
              ? `${challenge.daysLeft} days left`
              : challenge.daysLeft === 1
              ? 'Last day! 🔥'
              : 'Final hours! 🔥'}
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
        <div className={`rounded-xl px-3 py-2.5 mb-3 border-l-4 ${
          allOnTrack
            ? 'bg-green-900/20 border-green-500'
            : anyAtRisk
            ? 'bg-red-900/20 border-red-500'
            : 'bg-gray-800/60 border-gray-600'
        }`}>
          <p className="text-xs text-gray-200 leading-relaxed">{nudge}</p>
        </div>
      )}

      {/* Workout plan — only show if worker still needs points */}
      {me && me.points < challenge.threshold && challenge.daysLeft >= 0 && (
        <div className="mb-3">
          <WorkoutPlanButton
            pointsNeeded={Math.max(1, challenge.threshold - me.points)}
            hoursLeft={Math.max(4, challenge.daysLeft * 24)}
            daysLeft={challenge.daysLeft}
          />
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
            {challenge.daysLeft > 1 ? `${challenge.daysLeft} days left` : challenge.daysLeft === 1 ? 'Last day! 🔥' : 'Final hours! 🔥'}
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
      <div className={`rounded-xl px-3 py-2.5 mb-3 border-l-4 ${
        allAtRisk ? 'bg-purple-900/30 border-purple-400' :
        anyAtRisk ? 'bg-purple-900/20 border-purple-600' :
        'bg-gray-800/60 border-gray-600'
      }`}>
        <p className="text-xs text-gray-200 leading-relaxed">{nudge}</p>
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
