'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Profile {
  id: string
  display_name: string
  username: string
  avatar_url?: string | null
}

interface Workout {
  id: string
  points: number
  workout_type: string
  duration_minutes: number
  logged_at: string
  notes?: string | null
}

interface WeighIn {
  id: string
  user_id: string
  weight: number
  photo_url?: string | null
  is_starting_weight: boolean
  verified: boolean
  notes?: string | null
  weighed_at: string
  submitter?: { display_name: string }
}

interface CheckIn {
  id: string
  user_id: string
  check_in_date: string
  meal_description?: string | null
  ate_protein: boolean
  ate_vegetables: boolean
  drank_water: boolean
  within_goals: boolean
  drank_alcohol: boolean
  ate_fried_food: boolean
  ate_fast_food: boolean
  ate_dessert: boolean
  had_binge_meal: boolean
  health_score: number
  earned_bonus: boolean
  challenge_points: number
  created_at: string
}

interface Comment {
  id: string
  user_id: string
  body: string
  created_at: string
  profiles?: Profile
}

interface Reaction {
  id: string
  user_id: string
  comment_id: string
  emoji: string
}

interface DuelChallenge {
  id: string
  name: string
  wager?: string | null
  rules?: string | null
  start_date: string
  end_date: string
  status: 'active' | 'completed' | 'cancelled'
  winner_id?: string | null
  competitor_a_id: string
  competitor_b_id: string
  watcher_ids: string[]
  starting_weight_a?: number | null
  starting_weight_b?: number | null
  lowest_weight_a?: number | null
  lowest_weight_b?: number | null
  target_weight_a?: number | null
  target_weight_b?: number | null
  profileA?: Profile
  profileB?: Profile
  creator?: Profile
}

interface Props {
  duel: DuelChallenge
  workoutsA: Workout[]
  workoutsB: Workout[]
  weighIns: WeighIn[]
  checkInsA: CheckIn[]
  checkInsB: CheckIn[]
  comments: Comment[]
  reactions: Reaction[]
  watcherProfiles: Profile[]
  currentUserId: string
  duelId: string
}

const WORKOUT_EMOJIS: Record<string, string> = {
  strength: '🏋️',
  cardio: '🏃',
  hiit: '⚡',
  flexibility: '🧘',
  sports: '⚽',
  other: '💪',
}

const QUICK_REACTIONS = ['🔥', '💀', '👏', '😬', '💪', '🫠']

const DISQUALIFIERS = [
  { key: 'drank_alcohol', label: 'Drank alcohol' },
  { key: 'ate_fried_food', label: 'Ate fried food' },
  { key: 'ate_fast_food', label: 'Ate fast food' },
  { key: 'ate_dessert', label: 'Ate dessert/cookies/candy' },
  { key: 'had_binge_meal', label: 'Had a binge meal' },
] as const

function computeStreak(checkIns: CheckIn[]): number {
  const earned = checkIns
    .filter(c => c.earned_bonus)
    .map(c => c.check_in_date)
    .sort()
    .reverse()

  if (earned.length === 0) return 0

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  let streak = 0
  let expected = todayStr

  // If no check-in today, start from yesterday
  if (earned[0] < todayStr) {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    expected = d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  }

  for (const date of earned) {
    if (date === expected) {
      streak++
      const d = new Date(expected + 'T12:00:00')
      d.setDate(d.getDate() - 1)
      expected = d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    } else {
      break
    }
  }
  return streak
}

function computeScores(
  workouts: Workout[],
  startingWeight: number | null | undefined,
  lowestWeight: number | null | undefined,
  targetWeight: number | null | undefined,
  checkIns: CheckIn[],
) {
  const workoutPts = workouts.reduce((s, w) => s + w.points, 0)
  let weightProgressPct = 0
  let weightLossPts = 0
  let lbsLost = 0
  let lbsToTarget = 0
  if (startingWeight && targetWeight && lowestWeight && startingWeight > targetWeight) {
    lbsToTarget = startingWeight - targetWeight
    lbsLost = Math.max(0, startingWeight - lowestWeight)
    const effectiveLost = Math.min(lbsLost, lbsToTarget)
    weightProgressPct = (effectiveLost / lbsToTarget) * 100
    weightLossPts = (weightProgressPct / 100) * 300
  }
  const healthyDayPts = checkIns.reduce((s, c) => s + c.challenge_points, 0)
  const total = workoutPts + weightLossPts + healthyDayPts
  return { workoutPts, weightProgressPct, weightLossPts, lbsLost, lbsToTarget, healthyDayPts, total }
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function DuelClient({
  duel,
  workoutsA,
  workoutsB,
  weighIns,
  checkInsA,
  checkInsB,
  comments: initialComments,
  reactions: initialReactions,
  watcherProfiles,
  currentUserId,
  duelId,
}: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<'scorecard' | 'activity' | 'weigh-in'>('scorecard')
  const [rulesOpen, setRulesOpen] = useState(false)
  const [comments, setComments] = useState(initialComments)
  const [reactions, setReactions] = useState(initialReactions)
  const [commentText, setCommentText] = useState('')
  const [postingComment, setPostingComment] = useState(false)

  // Check-in form state
  const [showCheckIn, setShowCheckIn] = useState(false)
  const [breakfastNotes, setBreakfastNotes] = useState('')
  const [lunchNotes, setLunchNotes] = useState('')
  const [dinnerNotes, setDinnerNotes] = useState('')
  const [snackNotes, setSnackNotes] = useState('')
  const [disqualifiers, setDisqualifiers] = useState<Record<string, boolean>>({})
  const [submittingCheckIn, setSubmittingCheckIn] = useState(false)
  const [checkInError, setCheckInError] = useState('')
  const [checkInResult, setCheckInResult] = useState<{ earned_bonus: boolean } | null>(null)

  // Weigh-in form state
  const [weight, setWeight] = useState('')
  const [isStarting, setIsStarting] = useState(false)
  const [weighNotes, setWeighNotes] = useState('')
  const [weighPhoto, setWeighPhoto] = useState<File | null>(null)
  const [weighPhotoPreview, setWeighPhotoPreview] = useState<string | null>(null)
  const [submittingWeighIn, setSubmittingWeighIn] = useState(false)
  const [weighInError, setWeighInError] = useState('')
  const weighPhotoRef = useRef<HTMLInputElement>(null)

  const isCompetitorA = currentUserId === duel.competitor_a_id
  const isCompetitorB = currentUserId === duel.competitor_b_id
  const isCompetitor = isCompetitorA || isCompetitorB
  const myCompetitorId = isCompetitorA ? duel.competitor_a_id : isCompetitorB ? duel.competitor_b_id : null
  const myCheckIns = isCompetitorA ? checkInsA : isCompetitorB ? checkInsB : []

  const profileA = duel.profileA
  const profileB = duel.profileB

  const scoreA = computeScores(workoutsA, duel.starting_weight_a, duel.lowest_weight_a, duel.target_weight_a, checkInsA)
  const scoreB = computeScores(workoutsB, duel.starting_weight_b, duel.lowest_weight_b, duel.target_weight_b, checkInsB)

  const today = new Date()
  const start = new Date(duel.start_date)
  const end = new Date(duel.end_date)
  const todayStr = today.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  const daysTotal = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1)
  const daysElapsed = Math.max(1, Math.ceil((today.getTime() - start.getTime()) / 86400000))
  const daysLeft = Math.max(0, Math.ceil((end.getTime() - today.getTime()) / 86400000))
  const isActive = duel.status === 'active' && daysLeft > 0

  const myTodayCheckIn = myCheckIns.find(c => c.check_in_date === todayStr)
  const alreadyCheckedIn = !!myTodayCheckIn
  const myStreak = computeStreak(myCheckIns)
  const myTotalBonusPts = myCheckIns.reduce((s, c) => s + c.challenge_points, 0)
  const myBonusDays = myCheckIns.filter(c => c.earned_bonus).length

  const streakA = computeStreak(checkInsA)
  const streakB = computeStreak(checkInsB)

  const lead = scoreA.total - scoreB.total
  const aIsLeading = lead > 0
  const tied = Math.abs(lead) < 0.5

  const rateA = scoreA.workoutPts / daysElapsed
  const rateB = scoreB.workoutPts / daysElapsed
  const projWorkoutA = rateA * daysTotal
  const projWorkoutB = rateB * daysTotal
  const projTotalA = projWorkoutA + scoreA.weightLossPts + scoreA.healthyDayPts
  const projTotalB = projWorkoutB + scoreB.weightLossPts + scoreB.healthyDayPts
  const projLead = projTotalA - projTotalB

  let headlineText = ''
  let headlineColor = 'text-gray-400'
  if (duel.status === 'completed') {
    const winner = duel.winner_id === duel.competitor_a_id ? profileA : profileB
    headlineText = `🏆 ${winner?.display_name?.split(' ')[0] || '?'} WINS!`
    headlineColor = 'text-green-400'
  } else if (tied) {
    headlineText = "It's TIED ⚖️"
    headlineColor = 'text-yellow-400'
  } else {
    const leaderName = aIsLeading
      ? profileA?.display_name?.split(' ')[0]
      : profileB?.display_name?.split(' ')[0]
    const margin = Math.abs(lead).toFixed(1)
    headlineText = `${leaderName} leads by ${parseFloat(margin)} pts`
    headlineColor = 'text-green-400'
  }

  const watcherTaunts = [
    'Wives are watching. 👀',
    'Projected loser: embarrassed.',
    'The audience demands suffering.',
    'No pressure. (Pressure.)',
  ]
  const taunt = watcherTaunts[duelId.charCodeAt(0) % watcherTaunts.length]

  const liveHasMeals = [breakfastNotes, lunchNotes, dinnerNotes, snackNotes].every(s => s.trim())
  const liveHasDisqualifier = Object.values(disqualifiers).some(Boolean)
  const liveWouldEarn = liveHasMeals && !liveHasDisqualifier

  async function submitCheckIn() {
    setSubmittingCheckIn(true)
    setCheckInError('')
    const res = await fetch(`/api/duel/${duelId}/checkin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        breakfast_notes: breakfastNotes || null,
        lunch_notes: lunchNotes || null,
        dinner_notes: dinnerNotes || null,
        snack_notes: snackNotes || null,
        ...disqualifiers,
      }),
    })
    setSubmittingCheckIn(false)
    if (res.ok) {
      const data = await res.json()
      setCheckInResult(data)
      setShowCheckIn(false)
      setBreakfastNotes(''); setLunchNotes(''); setDinnerNotes(''); setSnackNotes('')
      setDisqualifiers({})
      router.refresh()
    } else {
      const d = await res.json()
      setCheckInError(d.error || 'Failed to submit')
    }
  }

  function toggleDisqualifier(key: string) {
    setDisqualifiers(prev => ({ ...prev, [key]: !prev[key] }))
  }

  async function postComment() {
    if (!commentText.trim() || postingComment) return
    setPostingComment(true)
    const body = commentText.trim()
    setCommentText('')
    try {
      const res = await fetch(`/api/duel/${duelId}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })
      if (res.ok) router.refresh()
    } finally {
      setPostingComment(false)
    }
  }

  async function toggleReaction(commentId: string, emoji: string) {
    const existing = reactions.find(r =>
      r.comment_id === commentId && r.user_id === currentUserId && r.emoji === emoji
    )
    if (existing) {
      setReactions(prev => prev.filter(r => r.id !== existing.id))
    } else {
      setReactions(prev => [...prev, { id: `tmp-${Date.now()}`, user_id: currentUserId, comment_id: commentId, emoji }])
    }
    await fetch(`/api/duel/${duelId}/react`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commentId, emoji }),
    })
  }

  async function submitWeighIn() {
    const w = parseFloat(weight)
    if (!w || w <= 0) { setWeighInError('Enter a valid weight'); return }
    setSubmittingWeighIn(true)
    setWeighInError('')
    const fd = new FormData()
    fd.set('weight', String(w))
    fd.set('isStartingWeight', String(isStarting))
    fd.set('notes', weighNotes)
    fd.set('targetUserId', currentUserId)
    if (weighPhoto) fd.set('photo', weighPhoto)
    const res = await fetch(`/api/duel/${duelId}/weigh-in`, { method: 'POST', body: fd })
    setSubmittingWeighIn(false)
    if (res.ok) {
      setWeight('')
      setWeighNotes('')
      setWeighPhoto(null)
      setWeighPhotoPreview(null)
      setIsStarting(false)
      router.refresh()
      setTab('scorecard')
    } else {
      const d = await res.json()
      setWeighInError(d.error || 'Failed to submit')
    }
  }

  function handleWeighPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setWeighPhoto(file)
    const reader = new FileReader()
    reader.onload = () => setWeighPhotoPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  // Combined activity feed
  const activityItems = [
    ...workoutsA.map(w => ({ ...w, type: 'workout' as const, competitorId: duel.competitor_a_id, profile: profileA })),
    ...workoutsB.map(w => ({ ...w, type: 'workout' as const, competitorId: duel.competitor_b_id, profile: profileB })),
    ...weighIns.map(w => ({ ...w, type: 'weigh_in' as const, profile: w.user_id === duel.competitor_a_id ? profileA : profileB })),
    ...checkInsA.map(c => ({ ...c, type: 'checkin' as const, profile: profileA })),
    ...checkInsB.map(c => ({ ...c, type: 'checkin' as const, profile: profileB })),
  ].sort((a, b) => {
    const tA = 'logged_at' in a ? a.logged_at : 'weighed_at' in a ? (a as any).weighed_at : (a as any).created_at
    const tB = 'logged_at' in b ? b.logged_at : 'weighed_at' in b ? (b as any).weighed_at : (b as any).created_at
    return new Date(tB).getTime() - new Date(tA).getTime()
  })

  return (
    <>
      {/* Header */}
      <div className="bg-gray-900 px-4 pt-12 pb-4 border-b border-gray-800">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <Link href="/duel" className="text-gray-400 hover:text-white text-sm transition-colors">← Back</Link>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
              duel.status === 'completed'
                ? 'bg-gray-800 text-gray-400'
                : daysLeft <= 2
                  ? 'bg-red-900/50 text-red-400'
                  : 'bg-green-900/30 text-green-400'
            }`}>
              {duel.status === 'completed' ? '✓ Finished' : `${daysLeft}d left`}
            </span>
          </div>
          <h1 className="text-xl font-bold text-white leading-tight">{duel.name}</h1>
          {duel.status === 'active' && watcherProfiles.length > 0 && (
            <p className="text-gray-600 text-xs mt-1">{taunt}</p>
          )}
        </div>
      </div>

      {/* Wager bar */}
      {duel.wager && (
        <div className="bg-yellow-900/20 border-b border-yellow-800/30 px-4 py-2.5">
          <div className="max-w-lg mx-auto">
            <p className="text-yellow-400 text-xs font-semibold">
              💸 Stakes: <span className="font-normal text-yellow-300">"{duel.wager}"</span>
            </p>
          </div>
        </div>
      )}

      {/* Rules — persistent collapsible */}
      {duel.rules && (
        <div className="border-b border-gray-800">
          <button
            onClick={() => setRulesOpen(o => !o)}
            className="w-full px-4 py-2.5 flex items-center justify-between bg-gray-900 hover:bg-gray-800 transition-colors"
          >
            <span className="text-gray-400 text-xs font-semibold">📋 Rules</span>
            <span className="text-gray-600 text-xs">{rulesOpen ? '▲ hide' : '▼ show'}</span>
          </button>
          {rulesOpen && (
            <div className="px-4 py-3 bg-gray-900 border-t border-gray-800">
              <p className="text-gray-300 text-sm whitespace-pre-wrap">{duel.rules}</p>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="bg-gray-900 border-b border-gray-800 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex">
          {(['scorecard', 'activity', ...(isCompetitor ? ['weigh-in'] : [])] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t as any)}
              className={`flex-1 py-3 text-xs font-semibold transition-colors capitalize ${
                tab === t
                  ? 'text-green-400 border-b-2 border-green-400'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {t === 'scorecard' ? '📊 Scores' : t === 'activity' ? '📋 Activity' : '⚖️ Weigh-in'}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">

        {/* ── SCORECARD TAB ── */}
        {tab === 'scorecard' && (
          <>
            {/* Headline */}
            <div className="text-center py-2">
              <p className={`text-2xl font-black ${headlineColor}`}>{headlineText}</p>
              {isActive && !tied && (
                <p className="text-gray-500 text-xs mt-1">
                  Projected: {Math.round(projTotalA)} vs {Math.round(projTotalB)} pts by end
                </p>
              )}
            </div>

            {/* Healthy Day Check-In card (competitors only, active duel) */}
            {isCompetitor && isActive && (
              <div className={`rounded-2xl border ${
                alreadyCheckedIn
                  ? (myTodayCheckIn?.earned_bonus ? 'bg-green-950/30 border-green-700/50' : 'bg-gray-900 border-gray-700')
                  : 'bg-yellow-950/20 border-yellow-700/40'
              } p-4`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-white font-semibold text-sm">🥗 Healthy Day</p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {myStreak > 0 ? `🔥 ${myStreak}-day streak · ` : ''}{myBonusDays} bonus days · +{myTotalBonusPts} pts total
                    </p>
                  </div>
                  {alreadyCheckedIn ? (
                    <div className="text-right">
                      <p className={`text-lg font-black ${myTodayCheckIn?.earned_bonus ? 'text-green-400' : 'text-gray-400'}`}>
                        {myTodayCheckIn?.earned_bonus ? '✓ +10' : '✗'}
                      </p>
                      <p className="text-gray-600 text-xs">
                        {myTodayCheckIn?.health_score}/200
                      </p>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowCheckIn(true)}
                      className="bg-green-500 hover:bg-green-400 text-black font-bold px-3 py-2 rounded-xl text-xs transition-colors"
                    >
                      Check In →
                    </button>
                  )}
                </div>

              </div>
            )}

            {/* Check-in result flash */}
            {checkInResult && (
              <div className={`rounded-2xl p-4 text-center border ${
                checkInResult.earned_bonus ? 'bg-green-950/40 border-green-600/50' : 'bg-gray-900 border-gray-700'
              }`}>
                <p className={`text-2xl font-black ${checkInResult.earned_bonus ? 'text-green-400' : 'text-gray-400'}`}>
                  {checkInResult.earned_bonus ? '🥗 Healthy Day Bonus! +10 pts' : 'Check-in logged. No bonus today.'}
                </p>
                <button onClick={() => setCheckInResult(null)} className="text-gray-600 text-xs mt-2">dismiss</button>
              </div>
            )}

            {/* Side-by-side scorecards */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { profile: profileA, score: scoreA, workouts: workoutsA, checkIns: checkInsA,
                  startW: duel.starting_weight_a, lowW: duel.lowest_weight_a, targetW: duel.target_weight_a, streak: streakA },
                { profile: profileB, score: scoreB, workouts: workoutsB, checkIns: checkInsB,
                  startW: duel.starting_weight_b, lowW: duel.lowest_weight_b, targetW: duel.target_weight_b, streak: streakB },
              ].map(({ profile, score, workouts, checkIns, startW, lowW, targetW, streak }, idx) => {
                const isLeader = idx === 0 ? lead > 0.5 : lead < -0.5
                const isMe = idx === 0 ? isCompetitorA : isCompetitorB
                const bonusDays = checkIns.filter(c => c.earned_bonus).length
                return (
                  <div key={idx} className={`rounded-2xl p-4 border ${
                    isLeader ? 'bg-green-950/30 border-green-700/50' : 'bg-gray-900 border-gray-800'
                  }`}>
                    <div className="mb-3">
                      <p className="text-white font-bold text-sm leading-tight">
                        {profile?.display_name?.split(' ')[0] || '?'}
                        {isMe && <span className="text-green-400 text-xs ml-1">(you)</span>}
                      </p>
                      {isLeader && duel.status === 'active' && (
                        <p className="text-green-400 text-xs font-semibold">LEADING 🏆</p>
                      )}
                    </div>

                    <div className="mb-3">
                      <p className={`text-3xl font-black ${isLeader ? 'text-green-400' : 'text-white'}`}>
                        {score.total.toFixed(1)}
                      </p>
                      <p className="text-gray-500 text-xs">total pts</p>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-500">💪 Workout</span>
                        <span className="text-gray-300 font-medium">{score.workoutPts}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">⚖️ Weight</span>
                        <span className={`font-medium ${score.weightLossPts > 0 ? 'text-green-400' : 'text-gray-600'}`}>
                          {score.weightLossPts > 0 ? `+${Math.round(score.weightLossPts)}` : '—'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">🥗 Healthy Days</span>
                        <span className={`font-medium ${score.healthyDayPts > 0 ? 'text-green-400' : 'text-gray-600'}`}>
                          {score.healthyDayPts > 0 ? `+${score.healthyDayPts}` : '—'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">🏃 Workouts</span>
                        <span className="text-gray-400">{workouts.length}</span>
                      </div>
                      {bonusDays > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">🔥 Streak</span>
                          <span className="text-yellow-400">{streak}d</span>
                        </div>
                      )}
                    </div>

                    {(startW || targetW) && (
                      <div className="mt-3 pt-3 border-t border-gray-700/50 space-y-1.5 text-xs">
                        {startW && targetW && (
                          <>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Start → Target</span>
                              <span className="text-gray-400">{startW} → {targetW} lbs</span>
                            </div>
                            {score.lbsLost > 0 && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">Lost so far</span>
                                <span className="text-green-400">{score.lbsLost.toFixed(1)} lbs</span>
                              </div>
                            )}
                            <div className="flex justify-between">
                              <span className="text-gray-600">Progress</span>
                              <span className={score.weightProgressPct >= 100 ? 'text-green-400 font-bold' : 'text-yellow-400'}>
                                {score.weightProgressPct.toFixed(0)}%
                              </span>
                            </div>
                            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden mt-1">
                              <div
                                className="h-full bg-green-500 rounded-full transition-all"
                                style={{ width: `${Math.min(score.weightProgressPct, 100)}%` }}
                              />
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Head-to-head progress bar */}
            {(scoreA.total > 0 || scoreB.total > 0) && (
              <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
                <p className="text-gray-500 text-xs mb-3 font-semibold">HEAD-TO-HEAD SHARE</p>
                {(() => {
                  const total = scoreA.total + scoreB.total
                  const pctA = total > 0 ? (scoreA.total / total) * 100 : 50
                  return (
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-300">{profileA?.display_name?.split(' ')[0]}</span>
                        <span className="text-gray-300">{profileB?.display_name?.split(' ')[0]}</span>
                      </div>
                      <div className="h-3 rounded-full overflow-hidden flex bg-gray-800">
                        <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${pctA}%` }} />
                        <div className="h-full flex-1 bg-gray-600" />
                      </div>
                      <div className="flex justify-between text-xs mt-1">
                        <span className="text-green-400">{pctA.toFixed(0)}%</span>
                        <span className="text-gray-500">{(100 - pctA).toFixed(0)}%</span>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}

            {/* Projections */}
            {isActive && (scoreA.workoutPts > 0 || scoreB.workoutPts > 0) && (
              <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
                <p className="text-gray-500 text-xs mb-3 font-semibold">📈 PROJECTIONS ({daysLeft}d remaining)</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">{profileA?.display_name?.split(' ')[0]} projected</span>
                    <span className="text-white font-medium">{Math.round(projTotalA)} pts</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">{profileB?.display_name?.split(' ')[0]} projected</span>
                    <span className="text-white font-medium">{Math.round(projTotalB)} pts</span>
                  </div>
                  {Math.abs(projLead) > 1 && daysLeft > 0 && (
                    <div className="border-t border-gray-800 pt-2 mt-2 space-y-0.5">
                      <p className="text-gray-500 text-xs">
                        {projLead > 0
                          ? `${profileB?.display_name?.split(' ')[0]} needs ${Math.ceil(Math.abs(projLead) + 1)} more pts`
                          : `${profileA?.display_name?.split(' ')[0]} needs ${Math.ceil(Math.abs(projLead) + 1)} more pts`
                        }
                      </p>
                      <p className="text-gray-600 text-xs">
                        That's <span className="text-yellow-400">{((Math.abs(projLead) + 1) / daysLeft).toFixed(1)} workout pts/day</span>
                        {' '}or <span className="text-green-400">{Math.ceil((Math.abs(projLead) + 1) / 10)} more healthy days</span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Trash talk */}
            <div className="space-y-3">
              <p className="text-gray-500 text-xs font-semibold">TRASH TALK</p>
              {comments.map(c => {
                const cReactions = reactions.filter(r => r.comment_id === c.id)
                const reactionMap: Record<string, number> = {}
                for (const r of cReactions) reactionMap[r.emoji] = (reactionMap[r.emoji] || 0) + 1
                const myReactions = cReactions.filter(r => r.user_id === currentUserId).map(r => r.emoji)
                return (
                  <div key={c.id} className="bg-gray-900 rounded-2xl p-3 border border-gray-800">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-white text-xs font-semibold">{c.profiles?.display_name?.split(' ')[0] || '?'}</span>
                      <span className="text-gray-600 text-xs">{formatTimeAgo(c.created_at)}</span>
                    </div>
                    <p className="text-gray-300 text-sm">{c.body}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {Object.entries(reactionMap).map(([emoji, count]) => (
                        <button key={emoji} onClick={() => toggleReaction(c.id, emoji)}
                          className={`text-xs px-2 py-0.5 rounded-lg transition-colors ${
                            myReactions.includes(emoji)
                              ? 'bg-green-900/50 border border-green-700/50 text-green-300'
                              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                          }`}>
                          {emoji} {count}
                        </button>
                      ))}
                      <div className="flex gap-1">
                        {QUICK_REACTIONS.filter(e => !reactionMap[e]).map(emoji => (
                          <button key={emoji} onClick={() => toggleReaction(c.id, emoji)}
                            className="text-xs px-1.5 py-0.5 rounded-lg bg-gray-800/50 text-gray-600 hover:text-gray-300 hover:bg-gray-700 transition-colors">
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div className="flex gap-2">
                <input
                  type="text" value={commentText} onChange={e => setCommentText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && postComment()}
                  placeholder="Add trash talk..."
                  className="flex-1 bg-gray-900 text-white rounded-xl px-4 py-3 text-sm placeholder-gray-600 border border-gray-800 focus:border-green-500 focus:outline-none"
                />
                <button onClick={postComment} disabled={postingComment || !commentText.trim()}
                  className="bg-green-500 hover:bg-green-400 disabled:opacity-40 text-black font-bold px-4 py-3 rounded-xl text-sm transition-colors">
                  {postingComment ? '...' : '→'}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── ACTIVITY TAB ── */}
        {tab === 'activity' && (
          <div className="space-y-3">
            {activityItems.length === 0 && (
              <div className="text-center py-10">
                <p className="text-gray-500 text-sm">No activity yet.</p>
              </div>
            )}
            {activityItems.map((item, idx) => {
              if (item.type === 'workout') {
                const w = item as Workout & { type: 'workout'; profile?: Profile }
                return (
                  <div key={`w-${w.id}`} className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{WORKOUT_EMOJIS[w.workout_type] || '💪'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-white text-sm font-semibold">{w.profile?.display_name?.split(' ')[0]}</span>
                          <span className="text-gray-400 text-xs">{w.workout_type}</span>
                        </div>
                        <p className="text-gray-500 text-xs">{w.duration_minutes}min · {formatTimeAgo(w.logged_at)}</p>
                        {w.notes && <p className="text-gray-400 text-xs mt-1 truncate">{w.notes}</p>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-green-400 font-bold text-sm">+{w.points}</p>
                        <p className="text-gray-600 text-xs">pts</p>
                      </div>
                    </div>
                  </div>
                )
              }

              if (item.type === 'weigh_in') {
                const wi = item as WeighIn & { type: 'weigh_in'; profile?: Profile }
                return (
                  <div key={`wi-${wi.id}`} className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">⚖️</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-white text-sm font-semibold">{wi.profile?.display_name?.split(' ')[0]}</span>
                          <span className="text-gray-400 text-xs">weigh-in{wi.is_starting_weight ? ' (starting)' : ''}</span>
                        </div>
                        <p className="text-gray-500 text-xs">{formatTimeAgo(wi.weighed_at)}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-white font-bold text-sm">{wi.weight} lbs</p>
                        <p className={`text-xs ${wi.verified ? 'text-green-400' : 'text-yellow-500'}`}>
                          {wi.verified ? '✓ verified' : '⏳ pending'}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              }

              // checkin
              const ci = item as CheckIn & { type: 'checkin'; profile?: Profile }
              return (
                <div key={`ci-${ci.id}`} className={`rounded-2xl p-4 border ${
                  ci.earned_bonus ? 'bg-green-950/20 border-green-800/50' : 'bg-gray-900 border-gray-800'
                }`}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🥗</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-white text-sm font-semibold">{ci.profile?.display_name?.split(' ')[0]}</span>
                        <span className="text-gray-400 text-xs">daily check-in</span>
                      </div>
                      <p className="text-gray-500 text-xs">
                        {ci.earned_bonus
                          ? 'Earned Healthy Day Bonus'
                          : `Missed bonus (${ci.health_score}/200)`
                        } · {ci.check_in_date}
                      </p>
                      {ci.meal_description && (
                        <p className="text-gray-500 text-xs mt-1 italic truncate">"{ci.meal_description}"</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      {ci.earned_bonus ? (
                        <>
                          <p className="text-green-400 font-bold text-sm">+10</p>
                          <p className="text-gray-600 text-xs">pts</p>
                        </>
                      ) : (
                        <p className="text-gray-500 text-xs">no bonus</p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── WEIGH-IN TAB ── */}
        {tab === 'weigh-in' && isCompetitor && (
          <div className="space-y-4">
            <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 space-y-4">
              <h3 className="text-white font-semibold text-sm">Log Your Weight</h3>
              <div>
                <label className="text-gray-400 text-xs block mb-1.5">Weight (lbs) *</label>
                <div className="flex gap-2 items-center">
                  <input type="number" value={weight} onChange={e => setWeight(e.target.value)}
                    placeholder="e.g. 185.5" step="0.1" min="50" max="999"
                    className="flex-1 bg-gray-800 text-white rounded-xl px-4 py-3 text-sm border border-gray-700 focus:border-green-500 focus:outline-none" />
                  <span className="text-gray-500 text-sm">lbs</span>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <div onClick={() => setIsStarting(!isStarting)}
                  className={`w-10 h-6 rounded-full transition-colors ${isStarting ? 'bg-green-500' : 'bg-gray-700'} relative`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isStarting ? 'left-5' : 'left-1'}`} />
                </div>
                <span className="text-gray-300 text-sm">This is my starting weight</span>
              </label>
              <div>
                <label className="text-gray-400 text-xs block mb-1.5">Notes (optional)</label>
                <input type="text" value={weighNotes} onChange={e => setWeighNotes(e.target.value)}
                  placeholder="Morning, fasted, etc."
                  className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 text-sm border border-gray-700 focus:border-green-500 focus:outline-none" />
              </div>
              <div>
                <label className="text-gray-400 text-xs block mb-1.5">Photo proof (optional)</label>
                <input ref={weighPhotoRef} type="file" accept="image/*" capture="environment"
                  onChange={handleWeighPhotoChange} className="hidden" />
                {weighPhotoPreview ? (
                  <div className="relative w-24 h-24">
                    <img src={weighPhotoPreview} className="w-24 h-24 rounded-xl object-cover" alt="proof" />
                    <button type="button" onClick={() => { setWeighPhoto(null); setWeighPhotoPreview(null) }}
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs font-bold flex items-center justify-center">×</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => weighPhotoRef.current?.click()}
                    className="w-24 h-24 bg-gray-800 border border-gray-700 rounded-xl flex flex-col items-center justify-center gap-1 text-gray-500 hover:bg-gray-700 transition-colors">
                    <span className="text-2xl">📷</span>
                    <span className="text-xs">Add photo</span>
                  </button>
                )}
              </div>
              {weighInError && <p className="text-red-400 text-sm">{weighInError}</p>}
              <button onClick={submitWeighIn} disabled={submittingWeighIn || !weight}
                className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-bold py-3 rounded-xl text-sm transition-colors">
                {submittingWeighIn ? 'Submitting...' : '⚖️ Submit Weigh-in'}
              </button>
            </div>

            {weighIns.filter(w => w.user_id === (myCompetitorId || currentUserId)).length > 0 && (
              <div className="space-y-2">
                <p className="text-gray-500 text-xs font-semibold">YOUR WEIGH-INS</p>
                {weighIns.filter(w => w.user_id === (myCompetitorId || currentUserId)).map(wi => (
                  <div key={wi.id} className="bg-gray-900 rounded-xl p-3 border border-gray-800 flex justify-between items-center">
                    <div>
                      <p className="text-white text-sm font-medium">{wi.weight} lbs</p>
                      <p className="text-gray-500 text-xs">{wi.is_starting_weight ? '(starting) · ' : ''}{formatTimeAgo(wi.weighed_at)}</p>
                      {wi.notes && <p className="text-gray-600 text-xs">{wi.notes}</p>}
                    </div>
                    <span className={`text-xs font-bold ${wi.verified ? 'text-green-400' : 'text-yellow-500'}`}>
                      {wi.verified ? '✓' : '⏳'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── CHECK-IN MODAL ── */}
      {showCheckIn && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70" onClick={() => setShowCheckIn(false)}>
          <div
            className="w-full max-w-lg bg-gray-900 rounded-t-3xl p-6 pb-10 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-bold text-lg">🥗 Daily Check-In</h2>
              <button onClick={() => setShowCheckIn(false)} className="text-gray-500 text-sm">Cancel</button>
            </div>

            {/* Live status */}
            <div className={`rounded-2xl px-4 py-3 mb-5 border ${
              liveWouldEarn
                ? 'bg-green-950/30 border-green-700/50'
                : liveHasDisqualifier
                  ? 'bg-red-950/20 border-red-800/50'
                  : 'bg-gray-800 border-gray-700'
            }`}>
              <p className={`text-sm font-bold ${
                liveWouldEarn ? 'text-green-400' : liveHasDisqualifier ? 'text-red-400' : 'text-gray-400'
              }`}>
                {liveWouldEarn
                  ? '✓ Earns Healthy Day Bonus (+10 pts)'
                  : liveHasDisqualifier
                    ? '✗ Disqualified — no bonus'
                    : 'Log all meals to qualify'}
              </p>
            </div>

            {/* Meal log */}
            <div className="mb-5 space-y-3">
              <p className="text-gray-400 text-xs font-semibold">What did you eat today?</p>
              {[
                { label: '🌅 Breakfast', value: breakfastNotes, set: setBreakfastNotes, placeholder: 'e.g. Eggs, toast, coffee' },
                { label: '☀️ Lunch', value: lunchNotes, set: setLunchNotes, placeholder: 'e.g. Chicken salad' },
                { label: '🌙 Dinner', value: dinnerNotes, set: setDinnerNotes, placeholder: 'e.g. Salmon and veggies' },
                { label: '🍎 Snacks', value: snackNotes, set: setSnackNotes, placeholder: 'e.g. Apple, almonds' },
              ].map(({ label, value, set, placeholder }) => (
                <div key={label}>
                  <label className="text-gray-500 text-xs block mb-1">{label}</label>
                  <input
                    type="text"
                    value={value}
                    onChange={e => set(e.target.value)}
                    placeholder={placeholder}
                    className="w-full bg-gray-800 text-white rounded-xl px-4 py-2.5 text-sm placeholder-gray-600 border border-gray-700 focus:border-green-500 focus:outline-none"
                  />
                </div>
              ))}
            </div>

            {/* Disqualifiers */}
            <div className="mb-6">
              <p className="text-gray-400 text-xs font-semibold mb-2">❌ Disqualifiers — check if any apply</p>
              <div className="space-y-2">
                {DISQUALIFIERS.map(({ key, label }) => (
                  <button key={key} type="button" onClick={() => toggleDisqualifier(key)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-colors text-left ${
                      disqualifiers[key]
                        ? 'bg-red-900/30 border border-red-700/50 text-red-300'
                        : 'bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700'
                    }`}>
                    <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
                      disqualifiers[key] ? 'bg-red-500 border-red-500' : 'border-gray-600'
                    }`}>
                      {disqualifiers[key] && <span className="text-white text-xs font-bold">✓</span>}
                    </span>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {checkInError && <p className="text-red-400 text-sm mb-3">{checkInError}</p>}

            <button
              onClick={submitCheckIn}
              disabled={submittingCheckIn || !liveHasMeals}
              className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-bold py-4 rounded-xl text-base transition-colors"
            >
              {submittingCheckIn ? 'Saving...' : liveWouldEarn ? '🥗 Submit & Earn +10 pts' : '📋 Submit Check-In'}
            </button>
            {!liveHasMeals && (
              <p className="text-gray-600 text-xs text-center mt-2">Log all meals to submit</p>
            )}
          </div>
        </div>
      )}
    </>
  )
}
