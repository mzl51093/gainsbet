import type { Profile } from '@/lib/types'
import Link from 'next/link'
import WorkoutPlanButton from './WorkoutPlanButton'
import CountdownTimer from './CountdownTimer'

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

  const statusBorder = allOnTrack ? 'border-green-700/50' : anyAtRisk ? 'border-red-700/50' : 'border-yellow-700/50'

  return (
    <div className={`rounded-2xl border ${statusBorder} bg-gray-900 overflow-hidden`}>
      {/* Top bar: title + status */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-800">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base">💪</span>
              <h3 className="text-white font-bold text-base">{challenge.title}</h3>
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
          <span className={`text-xs font-bold px-2 py-1 rounded-full shrink-0 ${
            allOnTrack ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'
          }`}>
            {allOnTrack ? 'ON TRACK ✓' : 'AT RISK ⚠'}
          </span>
        </div>

        {/* Countdown */}
        {challenge.endTimestamp && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-gray-600 text-xs">⏱</span>
            <CountdownTimer endTimestamp={challenge.endTimestamp} />
            <span className="text-gray-600 text-xs">remaining</span>
          </div>
        )}
      </div>

      {/* Workers */}
      <div className="px-4 py-3 border-b border-gray-800">
        <p className="text-xs text-gray-600 uppercase tracking-wide mb-2">Workers</p>
        <div className="space-y-3">
          {challenge.workers.map(w => {
            const isMe = w.profile.id === userId
            return (
              <div key={w.profile.id}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    {isMe ? (
                      <span className="text-xs text-gray-400">👤 You</span>
                    ) : (
                      <Link href={`/player/${w.profile.username}`} className="text-xs text-gray-400 hover:text-white transition-colors">
                        {w.profile.display_name.split(' ')[0]}
                      </Link>
                    )}
                    {!w.onTrack && <span className="text-xs text-red-400">⚠</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`text-sm font-bold ${w.onTrack ? 'text-green-400' : 'text-red-400'}`}>
                      {w.points}
                    </span>
                    <span className="text-gray-600 text-xs">/ {challenge.threshold}</span>
                  </div>
                </div>
                <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      w.pct >= 100 ? 'bg-green-500' : w.onTrack ? 'bg-blue-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(100, w.pct)}%` }}
                  />
                </div>
                {isMe && w.points < challenge.threshold && (
                  <p className="text-xs text-gray-600 mt-0.5">
                    Projected: <span className={w.projected >= challenge.threshold ? 'text-green-400' : 'text-red-400'}>
                      {w.projected} pts
                    </span>
                    {ptsNeeded > 0 && ` · need ${ptsNeeded} more`}
                    {challenge.daysLeft > 0 && ptsPerDay > 0 && ` (${ptsPerDay}/day)`}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Motivators */}
      {challenge.motivators.length > 0 && (
        <div className="px-4 py-3 border-b border-gray-800">
          <p className="text-xs text-gray-600 uppercase tracking-wide mb-1.5">Motivators</p>
          <div className="flex flex-wrap gap-2">
            {challenge.motivators.map(m => (
              <Link key={m.id} href={`/player/${m.username}`} className="text-xs bg-gray-800 text-gray-300 hover:text-white px-2 py-1 rounded-lg transition-colors">
                💅 {m.display_name.split(' ')[0]}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Nudge */}
      {nudge && (
        <div className={`px-4 py-3 border-b border-gray-800 border-l-4 ${
          allOnTrack ? 'border-l-green-500' : anyAtRisk ? 'border-l-red-500' : 'border-l-gray-600'
        }`}>
          <p className="text-xs text-gray-300 leading-relaxed">{nudge}</p>
        </div>
      )}

      {/* Workout plan */}
      {me && me.points < challenge.threshold && challenge.daysLeft >= 0 && (
        <div className="px-4 py-3 border-b border-gray-800">
          <WorkoutPlanButton
            pointsNeeded={Math.max(1, challenge.threshold - me.points)}
            hoursLeft={Math.max(4, challenge.daysLeft * 24)}
            daysLeft={challenge.daysLeft}
          />
        </div>
      )}

      {/* Stakes */}
      <div className="px-4 py-3 grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-gray-600 mb-0.5">If workers win</p>
          <p className="text-green-400 text-xs font-medium">{challenge.stakeIfWorkers}</p>
        </div>
        <div>
          <p className="text-xs text-gray-600 mb-0.5">If motivators win</p>
          <p className="text-red-400 text-xs font-medium">{challenge.stakeIfMotivators}</p>
        </div>
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

  const statusBorder = allAtRisk ? 'border-purple-700/50' : anyAtRisk ? 'border-purple-700/30' : 'border-gray-700'

  return (
    <div className={`rounded-2xl border ${statusBorder} bg-gray-900 overflow-hidden`}>
      {/* Top bar */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-800">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base">💅</span>
              <h3 className="text-white font-bold text-base">{challenge.title}</h3>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {challenge.daysLeft > 1
                ? `${challenge.daysLeft} days left`
                : challenge.daysLeft === 1
                ? 'Last day! 🔥'
                : 'Final hours! 🔥'}
              {' · '}
              <span className={allOnTrack ? 'text-gray-400' : 'text-purple-400'}>
                {allAtRisk ? "They're struggling 👀" : anyAtRisk ? 'One is slipping...' : "They're on track 😤"}
              </span>
            </p>
          </div>
          {allAtRisk && (
            <span className="text-xs font-bold px-2 py-1 rounded-full bg-purple-900/40 text-purple-400 shrink-0">
              YOUR WIN 💅
            </span>
          )}
        </div>

        {/* Countdown */}
        {challenge.endTimestamp && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-gray-600 text-xs">⏱</span>
            <CountdownTimer endTimestamp={challenge.endTimestamp} />
            <span className="text-gray-600 text-xs">remaining</span>
          </div>
        )}
      </div>

      {/* Worker progress */}
      <div className="px-4 py-3 border-b border-gray-800">
        <p className="text-xs text-gray-600 uppercase tracking-wide mb-2">Workers</p>
        <div className="space-y-3">
          {challenge.workers.map(w => (
            <div key={w.profile.id}>
              <div className="flex items-center justify-between mb-1">
                <Link href={`/player/${w.profile.username}`} className="text-xs text-gray-400 hover:text-white transition-colors">{w.profile.display_name.split(' ')[0]}</Link>
                <div className="flex items-center gap-1">
                  <span className={`text-sm font-bold ${w.onTrack ? 'text-blue-400' : 'text-red-400'}`}>
                    {w.points}
                  </span>
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
      </div>

      {/* Nudge */}
      <div className={`px-4 py-3 border-b border-gray-800 border-l-4 ${
        allAtRisk ? 'border-l-purple-400' : anyAtRisk ? 'border-l-purple-600' : 'border-l-gray-600'
      }`}>
        <p className="text-xs text-gray-300 leading-relaxed">{nudge}</p>
      </div>

      {/* Prize */}
      <div className="px-4 py-3">
        <p className="text-xs text-gray-600 mb-0.5">Your prize if they slip</p>
        <p className="text-purple-300 text-xs font-medium">{challenge.stakeIfMotivators}</p>
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
  if (challenges.length === 0) {
    return (
      <div className="bg-gray-900 rounded-2xl p-8 text-center border border-gray-800">
        <p className="text-3xl mb-3">🏆</p>
        <p className="text-white font-semibold">No live competitions</p>
        <p className="text-gray-500 text-sm mt-1">Create a wager to get the competition going.</p>
        <Link href="/wagers" className="inline-block mt-4 text-green-400 text-sm hover:text-green-300">
          Create a challenge →
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {challenges.map(c =>
        c.isWorker
          ? <WorkerCard key={c.id} challenge={c} userId={currentUserId} />
          : c.isMotivator
          ? <MotivatorCard key={c.id} challenge={c} userId={currentUserId} />
          : null
      )}
    </div>
  )
}

export type { ChallengeData }
