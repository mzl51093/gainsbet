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
  breakfast_notes?: string | null
  lunch_notes?: string | null
  dinner_notes?: string | null
  snack_notes?: string | null
  ate_protein: boolean
  ate_vegetables: boolean
  drank_water: boolean
  within_goals: boolean
  drank_alcohol: boolean
  ate_fried_food: boolean
  ate_fast_food: boolean
  ate_dessert: boolean
  had_cheat_meal: boolean
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
  activity_type?: string | null
  activity_id?: string | null
  profiles?: Profile
}

interface Reaction {
  id: string
  user_id: string
  comment_id: string
  emoji: string
}

interface WeeklyPhoto {
  id: string
  user_id: string
  duel_id: string
  check_in_week: string
  front_photo_url?: string | null
  side_photo_url?: string | null
  notes?: string | null
  submitted_at: string
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
  format?: string | null
  profileA?: Profile
  profileB?: Profile
  creator?: Profile
}

interface GolfRound {
  id: string
  user_id: string
  course_name?: string | null
  holes: number
  gross_score: number
  notes?: string | null
  played_at: string
}

interface Props {
  duel: DuelChallenge
  workoutsA: Workout[]
  workoutsB: Workout[]
  weighIns: WeighIn[]
  checkInsA: CheckIn[]
  checkInsB: CheckIn[]
  weeklyPhotos: WeeklyPhoto[]
  golfRoundsA: GolfRound[]
  golfRoundsB: GolfRound[]
  comments: Comment[]
  reactions: Reaction[]
  watcherProfiles: Profile[]
  currentUserId: string
  duelId: string
}

const WORKOUT_EMOJIS: Record<string, string> = {
  // new slugs
  meditation: '🧘', sauna: '🧖', 'cold-plunge': '🧊', breathwork: '💨',
  'golf-cart': '⛳', 'golf-simulator': '⛳', 'golf-putting': '⛳', stretching: '🤸', 'light-recovery': '💆',
  'driving-range': '⛳', 'easy-walk': '🐕', 'gentle-yoga': '🧘', 'recovery-ride': '🔄', 'physical-therapy': '🏥',
  'golf-walking': '⛳', 'brisk-walk': '🚶', hiking: '🥾', 'incline-walk': '⛰️',
  pilates: '🩰', barre: '🩰', 'core-workout': '🎯', dance: '💃', kayaking: '🛶', 'easy-elliptical': '〇',
  jogging: '🏃', stairmaster: '🪜', rowing: '🚣', swimming: '🏊', bodyweight: '💪', 'moderate-cardio': '❤️',
  strength: '🏋️', cycling: '🚴', peloton: '🚴', 'tennis-doubles': '🎾', 'swimming-moderate': '🏊', 'moderate-rowing': '🚣',
  running: '🏃', 'heavy-strength': '🏋️', spin: '🔥', tennis: '🎾',
  basketball: '🏀', soccer: '⚽', boxing: '🥊', circuit: '⚡', 'rock-climbing': '🧗', volleyball: '🏐',
  hiit: '⚡', crossfit: '🔥', orangetheory: '🍊', bootcamp: '💥',
  'sprint-intervals': '💨', plyometrics: '🦘', 'assault-bike': '💀', 'boxing-sparring': '🥊', metcon: '🔥',
  hyrox: '🏅', 'spartan-race': '🏆', 'crossfit-comp': '🏆', 'max-effort': '💀',
  // legacy slugs
  cardio: '❤️', flexibility: '🧘', sports: '⚽', walking: '🚶', other: '💪',
}

const QUICK_REACTIONS = ['🔥', '💀', '👏', '😬', '💪', '🫠']

const DISQUALIFIERS = [
  { key: 'drank_alcohol', label: 'Drank alcohol' },
  { key: 'ate_fried_food', label: 'Ate fried food' },
  { key: 'ate_fast_food', label: 'Ate fast food' },
  { key: 'ate_dessert', label: 'Ate dessert/cookies/candy' },
  { key: 'had_cheat_meal', label: 'Had a cheat meal (pizza, pasta, hot dogs, chips, etc.)' },
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

function computeDailyStreakScores(
  workouts: Workout[],
  checkIns: CheckIn[],
  startDate: string,
  endDate: string,
) {
  const workoutDays = new Set(
    workouts
      .filter(w => w.duration_minutes >= 30)
      .map(w => w.logged_at.split('T')[0])
  ).size
  const healthyDays = checkIns.filter(c => c.earned_bonus).length
  const total = workoutDays + healthyDays
  const totalDays = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1
  const daysElapsed = Math.max(0, Math.floor((Date.now() - new Date(startDate).getTime()) / 86400000))
  const maxPossible = Math.min(daysElapsed + 1, totalDays) * 2
  return { workoutDays, healthyDays, total, totalDays, maxPossible }
}

function computeGolfScores(rounds: GolfRound[]) {
  if (rounds.length === 0) return { rounds: 0, totalStrokes: 0, avgScore: 0 }
  const totalStrokes = rounds.reduce((s, r) => s + r.gross_score, 0)
  return { rounds: rounds.length, totalStrokes, avgScore: totalStrokes / rounds.length }
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
  weeklyPhotos,
  golfRoundsA,
  golfRoundsB,
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

  // Expanded check-in detail
  const [expandedCheckIn, setExpandedCheckIn] = useState<string | null>(null)
  const [activityCommentText, setActivityCommentText] = useState<Record<string, string>>({})
  const [postingActivityComment, setPostingActivityComment] = useState<string | null>(null)
  const [activityCommentError, setActivityCommentError] = useState<string | null>(null)

  // Edit weights state
  const [editStarting, setEditStarting] = useState(
    currentUserId === duel.competitor_a_id
      ? String(duel.starting_weight_a || '')
      : String(duel.starting_weight_b || '')
  )
  const [editTarget, setEditTarget] = useState(
    currentUserId === duel.competitor_a_id
      ? String(duel.target_weight_a || '')
      : String(duel.target_weight_b || '')
  )
  const [savingWeights, setSavingWeights] = useState(false)
  const [weightsError, setWeightsError] = useState('')
  const [weightsSuccess, setWeightsSuccess] = useState(false)

  // Body check-in state
  const [frontPhoto, setFrontPhoto] = useState<File | null>(null)
  const [sidePhoto, setSidePhoto] = useState<File | null>(null)
  const [frontPreview, setFrontPreview] = useState<string | null>(null)
  const [sidePreview, setSidePreview] = useState<string | null>(null)
  const [bodyNotes, setBodyNotes] = useState('')
  const [submittingBody, setSubmittingBody] = useState(false)
  const [bodyError, setBodyError] = useState('')
  const [bodySuccess, setBodySuccess] = useState(false)
  const frontPhotoRef = useRef<HTMLInputElement>(null)
  const sidePhotoRef = useRef<HTMLInputElement>(null)
  const [showProgressModal, setShowProgressModal] = useState(false)
  const [progressImageUrl, setProgressImageUrl] = useState<string | null>(null)
  const [buildingProgress, setBuildingProgress] = useState(false)

  // Golf round logging state
  const [showGolfForm, setShowGolfForm] = useState(false)
  const [golfCourse, setGolfCourse] = useState('')
  const [golfHoles, setGolfHoles] = useState<9 | 18>(18)
  const [golfScore, setGolfScore] = useState('')
  const [golfNotes, setGolfNotes] = useState('')
  const [golfDate, setGolfDate] = useState(new Date().toISOString().split('T')[0])
  const [submittingGolf, setSubmittingGolf] = useState(false)
  const [golfError, setGolfError] = useState('')

  const isCompetitorA = currentUserId === duel.competitor_a_id
  const isCompetitorB = currentUserId === duel.competitor_b_id
  const isCompetitor = isCompetitorA || isCompetitorB
  const myCompetitorId = isCompetitorA ? duel.competitor_a_id : isCompetitorB ? duel.competitor_b_id : null
  const myCheckIns = isCompetitorA ? checkInsA : isCompetitorB ? checkInsB : []

  const profileA = duel.profileA
  const profileB = duel.profileB

  const isStreakFormat = duel.format === 'daily-streak'
  const isGolfFormat = duel.format === 'golf'
  const scoreA = computeScores(workoutsA, duel.starting_weight_a, duel.lowest_weight_a, duel.target_weight_a, checkInsA)
  const scoreB = computeScores(workoutsB, duel.starting_weight_b, duel.lowest_weight_b, duel.target_weight_b, checkInsB)
  const streakScoreA = computeDailyStreakScores(workoutsA, checkInsA, duel.start_date, duel.end_date)
  const streakScoreB = computeDailyStreakScores(workoutsB, checkInsB, duel.start_date, duel.end_date)
  const golfScoreA = computeGolfScores(golfRoundsA)
  const golfScoreB = computeGolfScores(golfRoundsB)
  const effectiveScoreA = isStreakFormat ? { ...scoreA, total: streakScoreA.total, workoutPts: streakScoreA.workoutDays, healthyDayPts: streakScoreA.healthyDays, weightLossPts: 0 } : scoreA
  const effectiveScoreB = isStreakFormat ? { ...scoreB, total: streakScoreB.total, workoutPts: streakScoreB.workoutDays, healthyDayPts: streakScoreB.healthyDays, weightLossPts: 0 } : scoreB

  const today = new Date()
  const start = new Date(duel.start_date)
  const end = new Date(duel.end_date)
  const todayStr = today.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  const easternHour = Number(today.toLocaleString('en-US', { timeZone: 'America/New_York', hour: '2-digit', hour12: false }))
  const isBeforeNoon = easternHour < 12
  const checkinDateStr = isBeforeNoon
    ? (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }) })()
    : todayStr
  const daysTotal = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1)
  const daysElapsed = Math.max(1, Math.ceil((today.getTime() - start.getTime()) / 86400000))
  const daysLeft = Math.max(0, Math.ceil((end.getTime() - today.getTime()) / 86400000))
  const isActive = duel.status === 'active' && daysLeft > 0

  const myTodayCheckIn = myCheckIns.find(c => c.check_in_date === checkinDateStr)
  const alreadyCheckedIn = !!myTodayCheckIn
  const myStreak = computeStreak(myCheckIns)
  const myTotalBonusPts = myCheckIns.reduce((s, c) => s + c.challenge_points, 0)
  const myBonusDays = myCheckIns.filter(c => c.earned_bonus).length

  const streakA = computeStreak(checkInsA)
  const streakB = computeStreak(checkInsB)

  // Golf: lower score wins. Lead = how many strokes B is ahead of A per round.
  const golfLead = isGolfFormat
    ? (golfScoreA.rounds > 0 && golfScoreB.rounds > 0
        ? golfScoreB.avgScore - golfScoreA.avgScore  // positive = A is leading (lower avg)
        : golfScoreA.rounds > 0 ? 1 : golfScoreB.rounds > 0 ? -1 : 0)
    : 0
  const lead = isGolfFormat ? golfLead : effectiveScoreA.total - effectiveScoreB.total
  const aIsLeading = lead > 0
  const tied = isGolfFormat ? Math.abs(golfLead) < 0.01 : Math.abs(lead) < 0.5

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
  } else if (isGolfFormat && golfScoreA.rounds === 0 && golfScoreB.rounds === 0) {
    headlineText = '⛳ No rounds played yet'
    headlineColor = 'text-gray-400'
  } else if (tied) {
    headlineText = isGolfFormat ? '⛳ All Even' : "It's TIED ⚖️"
    headlineColor = 'text-yellow-400'
  } else {
    const leaderName = aIsLeading
      ? profileA?.display_name?.split(' ')[0]
      : profileB?.display_name?.split(' ')[0]
    if (isGolfFormat) {
      const margin = Math.abs(golfLead).toFixed(1)
      headlineText = `⛳ ${leaderName} leads by ${parseFloat(margin)} strokes/round`
    } else {
      const margin = Math.abs(lead).toFixed(1)
      headlineText = `${leaderName} leads by ${parseFloat(margin)} pts`
    }
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

  async function submitGolfRound() {
    setSubmittingGolf(true)
    setGolfError('')
    try {
      const res = await fetch(`/api/duel/${duelId}/golf-round`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseName: golfCourse.trim() || null,
          holes: golfHoles,
          grossScore: parseInt(golfScore),
          notes: golfNotes.trim() || null,
          playedAt: golfDate ? golfDate + 'T12:00:00Z' : undefined,
        }),
      })
      if (res.ok) {
        setShowGolfForm(false)
        setGolfCourse('')
        setGolfScore('')
        setGolfNotes('')
        setGolfHoles(18)
        router.refresh()
      } else {
        const d = await res.json().catch(() => ({}))
        setGolfError(d.error || 'Failed to log round')
      }
    } catch {
      setGolfError('Network error — please try again')
    } finally {
      setSubmittingGolf(false)
    }
  }

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

  async function postActivityComment(activityType: string, activityId: string) {
    const text = activityCommentText[activityId]?.trim()
    if (!text || postingActivityComment) return
    setPostingActivityComment(activityId)
    setActivityCommentError(null)
    try {
      const res = await fetch(`/api/duel/${duelId}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text, activityType, activityId }),
      })
      if (res.ok) {
        setActivityCommentText(prev => ({ ...prev, [activityId]: '' }))
        router.refresh()
      } else {
        const d = await res.json().catch(() => ({}))
        setActivityCommentError(d.error || 'Failed to post comment')
      }
    } catch {
      setActivityCommentError('Network error — try again')
    } finally {
      setPostingActivityComment(null)
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

  async function compressImage(file: File, maxPx = 1920, quality = 0.85): Promise<File> {
    return new Promise((resolve) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(url)
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        canvas.toBlob(
          (blob) => resolve(new File([blob!], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })),
          'image/jpeg', quality
        )
      }
      img.src = url
    })
  }

  async function handleWeighPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const compressed = await compressImage(file)
    setWeighPhoto(compressed)
    const reader = new FileReader()
    reader.onload = () => setWeighPhotoPreview(reader.result as string)
    reader.readAsDataURL(compressed)
  }

  async function submitUpdateWeights() {
    setSavingWeights(true)
    setWeightsError('')
    setWeightsSuccess(false)
    const res = await fetch(`/api/duel/${duelId}/update-weights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startingWeight: editStarting ? Number(editStarting) : null,
        targetWeight: editTarget ? Number(editTarget) : null,
      }),
    })
    setSavingWeights(false)
    if (res.ok) {
      setWeightsSuccess(true)
      router.refresh()
    } else {
      const d = await res.json()
      setWeightsError(d.error || 'Failed to save')
    }
  }

  async function handleFrontPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const compressed = await compressImage(file)
    setFrontPhoto(compressed)
    const reader = new FileReader()
    reader.onload = () => setFrontPreview(reader.result as string)
    reader.readAsDataURL(compressed)
  }

  async function handleSidePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const compressed = await compressImage(file)
    setSidePhoto(compressed)
    const reader = new FileReader()
    reader.onload = () => setSidePreview(reader.result as string)
    reader.readAsDataURL(compressed)
  }

  async function buildProgressImage(first: WeeklyPhoto, latest: WeeklyPhoto) {
    setBuildingProgress(true)
    const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const src = (path: string) => `${supaUrl}/storage/v1/object/public/duel-proofs/${path}`

    const fetchImg = async (path: string | null | undefined): Promise<HTMLImageElement | null> => {
      if (!path) return null
      try {
        const res = await fetch(src(path))
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        return await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image()
          img.onload = () => resolve(img)
          img.onerror = reject
          img.src = url
        })
      } catch { return null }
    }

    const [ff, fl, sf, sl] = await Promise.all([
      fetchImg(first.front_photo_url),
      fetchImg(latest.front_photo_url),
      fetchImg(first.side_photo_url),
      fetchImg(latest.side_photo_url),
    ])

    const CELL = 460
    const CELL_H = Math.round(CELL * 4 / 3)
    const PAD = 24
    const GAP = 14
    const SECTION_H = 44
    const LABEL_H = 36
    const HEADER_H = 80
    const W = PAD * 2 + CELL * 2 + GAP
    const H = PAD + HEADER_H + (SECTION_H + CELL_H + LABEL_H + GAP) * 2 - GAP + PAD

    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')!

    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(0, 0, W, H)

    // Header
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Progress Comparison', W / 2, PAD + 40)
    ctx.fillStyle = '#555'
    ctx.font = '24px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.fillText(`${first.check_in_week}  →  ${latest.check_in_week}`, W / 2, PAD + 70)

    const drawCover = (img: HTMLImageElement | null, x: number, y: number, w: number, h: number) => {
      ctx.save()
      const r = 18
      ctx.beginPath()
      ctx.moveTo(x + r, y)
      ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r)
      ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
      ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r)
      ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r)
      ctx.closePath()
      ctx.clip()
      if (!img) {
        ctx.fillStyle = '#1a1a1a'
        ctx.fillRect(x, y, w, h)
      } else {
        const scale = Math.max(w / img.width, h / img.height)
        const sw = w / scale, sh = h / scale
        const sx = (img.width - sw) / 2, sy = (img.height - sh) / 2
        ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h)
      }
      ctx.restore()
    }

    const x1 = PAD, x2 = PAD + CELL + GAP
    const rows: [string, HTMLImageElement | null, HTMLImageElement | null][] = [
      ['FRONT VIEW', ff, fl],
      ['SIDE VIEW', sf, sl],
    ]

    let rowY = PAD + HEADER_H
    for (const [label, imgFirst, imgLatest] of rows) {
      // Section label
      ctx.fillStyle = '#888'
      ctx.font = 'bold 26px -apple-system, BlinkMacSystemFont, sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(label, x1, rowY + 30)
      rowY += SECTION_H

      // Photos
      drawCover(imgFirst, x1, rowY, CELL, CELL_H)
      drawCover(imgLatest, x2, rowY, CELL, CELL_H)

      // Sub-labels
      rowY += CELL_H + 6
      ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillStyle = '#555'
      ctx.fillText('FIRST', x1 + CELL / 2, rowY + 24)
      ctx.fillStyle = '#22c55e'
      ctx.fillText('LATEST', x2 + CELL / 2, rowY + 24)
      rowY += LABEL_H + GAP
    }

    setProgressImageUrl(canvas.toDataURL('image/jpeg', 0.93))
    setShowProgressModal(true)
    setBuildingProgress(false)
  }

  async function submitBodyCheckIn() {
    if (!frontPhoto || !sidePhoto) { setBodyError('Both front and side photos required'); return }
    setSubmittingBody(true)
    setBodyError('')
    try {
      const fd = new FormData()
      fd.set('front', frontPhoto)
      fd.set('side', sidePhoto)
      if (bodyNotes.trim()) fd.set('notes', bodyNotes.trim())
      const res = await fetch(`/api/duel/${duelId}/body-checkin`, { method: 'POST', body: fd })
      if (res.ok) {
        setBodySuccess(true)
        setFrontPhoto(null); setSidePhoto(null)
        setFrontPreview(null); setSidePreview(null)
        setBodyNotes('')
        router.refresh()
      } else {
        const d = await res.json().catch(() => ({}))
        setBodyError(d.error || 'Upload failed — please try again')
      }
    } catch {
      setBodyError('Network error — please try again')
    } finally {
      setSubmittingBody(false)
    }
  }

  // Combined activity feed
  const activityItems = [
    ...workoutsA.map(w => ({ ...w, type: 'workout' as const, competitorId: duel.competitor_a_id, profile: profileA })),
    ...workoutsB.map(w => ({ ...w, type: 'workout' as const, competitorId: duel.competitor_b_id, profile: profileB })),
    ...weighIns.map(w => ({ ...w, type: 'weigh_in' as const, profile: w.user_id === duel.competitor_a_id ? profileA : profileB })),
    ...checkInsA.map(c => ({ ...c, type: 'checkin' as const, profile: profileA })),
    ...checkInsB.map(c => ({ ...c, type: 'checkin' as const, profile: profileB })),
    ...weeklyPhotos.map(p => ({ ...p, type: 'body_photo' as const, profile: p.user_id === duel.competitor_a_id ? profileA : profileB })),
  ].sort((a, b) => {
    const tA = 'logged_at' in a ? a.logged_at : 'weighed_at' in a ? (a as any).weighed_at : 'submitted_at' in a ? (a as any).submitted_at : (a as any).created_at
    const tB = 'logged_at' in b ? b.logged_at : 'weighed_at' in b ? (b as any).weighed_at : 'submitted_at' in b ? (b as any).submitted_at : (b as any).created_at
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

      {/* Format badge */}
      {isStreakFormat && (
        <div className="bg-blue-900/20 border-b border-blue-800/30 px-4 py-2">
          <div className="max-w-lg mx-auto">
            <p className="text-blue-300 text-xs font-semibold">📅 Daily Streak — 1 pt per workout day (≥30 min) · 1 pt per healthy day · 2 pts/day max</p>
          </div>
        </div>
      )}
      {isGolfFormat && (
        <div className="bg-green-900/20 border-b border-green-800/30 px-4 py-2">
          <div className="max-w-lg mx-auto">
            <p className="text-green-300 text-xs font-semibold">⛳ Golf — Lowest average score wins · Log 9 or 18-hole rounds</p>
          </div>
        </div>
      )}

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
          {(['scorecard', 'activity', ...(isCompetitor && !isGolfFormat ? ['weigh-in'] : [])] as const).map(t => (
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
              {!isGolfFormat && isActive && !tied && (
                <p className="text-gray-500 text-xs mt-1">
                  Projected: {Math.round(projTotalA)} vs {Math.round(projTotalB)} pts by end
                </p>
              )}
            </div>

            {/* Golf: Log Round card + scorecards */}
            {isGolfFormat && (
              <>
                {isCompetitor && isActive && (
                  <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
                    {!showGolfForm ? (
                      <button
                        onClick={() => setShowGolfForm(true)}
                        className="w-full bg-green-500 hover:bg-green-400 text-black font-bold py-3 rounded-xl text-sm transition-colors"
                      >
                        ⛳ Log a Round
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-white font-semibold text-sm">⛳ Log a Round</p>
                        <div>
                          <label className="text-gray-400 text-xs block mb-1">Course Name (optional)</label>
                          <input
                            type="text"
                            value={golfCourse}
                            onChange={e => setGolfCourse(e.target.value)}
                            placeholder="e.g. Pebble Beach"
                            className="w-full bg-gray-800 text-white rounded-xl px-3 py-2.5 text-sm border border-gray-700 focus:border-green-500 focus:outline-none"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-gray-400 text-xs block mb-1">Holes</label>
                            <div className="flex gap-2">
                              {([9, 18] as const).map(h => (
                                <button
                                  key={h}
                                  type="button"
                                  onClick={() => setGolfHoles(h)}
                                  className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
                                    golfHoles === h ? 'bg-green-500 text-black' : 'bg-gray-800 text-gray-300'
                                  }`}
                                >
                                  {h}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="text-gray-400 text-xs block mb-1">Gross Score *</label>
                            <input
                              type="number"
                              value={golfScore}
                              onChange={e => setGolfScore(e.target.value)}
                              placeholder={golfHoles === 9 ? '36–90' : '60–180'}
                              min={golfHoles === 9 ? 18 : 36}
                              max={200}
                              className="w-full bg-gray-800 text-white rounded-xl px-3 py-2.5 text-sm border border-gray-700 focus:border-green-500 focus:outline-none"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-gray-400 text-xs block mb-1">Date Played</label>
                          <input
                            type="date"
                            value={golfDate}
                            max={new Date().toISOString().split('T')[0]}
                            onChange={e => setGolfDate(e.target.value)}
                            className="w-full bg-gray-800 text-white rounded-xl px-3 py-2.5 text-sm border border-gray-700 focus:border-green-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-gray-400 text-xs block mb-1">Notes (optional)</label>
                          <input
                            type="text"
                            value={golfNotes}
                            onChange={e => setGolfNotes(e.target.value)}
                            placeholder="e.g. Windy, played well on back 9"
                            className="w-full bg-gray-800 text-white rounded-xl px-3 py-2.5 text-sm border border-gray-700 focus:border-green-500 focus:outline-none"
                          />
                        </div>
                        {golfError && <p className="text-red-400 text-xs">{golfError}</p>}
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setShowGolfForm(false); setGolfError('') }}
                            className="flex-1 bg-gray-800 text-gray-300 py-2.5 rounded-xl text-sm transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={submitGolfRound}
                            disabled={submittingGolf || !golfScore}
                            className="flex-1 bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-bold py-2.5 rounded-xl text-sm transition-colors"
                          >
                            {submittingGolf ? 'Saving...' : 'Save Round'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Golf side-by-side scorecards */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { profile: profileA, gs: golfScoreA, rounds: golfRoundsA },
                    { profile: profileB, gs: golfScoreB, rounds: golfRoundsB },
                  ].map(({ profile, gs, rounds }, idx) => {
                    const isLeader = idx === 0 ? lead > 0 : lead < 0
                    const isMe = idx === 0 ? isCompetitorA : isCompetitorB
                    return (
                      <div key={idx} className={`rounded-2xl p-4 border ${
                        isLeader && gs.rounds > 0 ? 'bg-green-950/30 border-green-700/50' : 'bg-gray-900 border-gray-800'
                      }`}>
                        <div className="mb-3">
                          <p className="text-white font-bold text-sm leading-tight">
                            {profile?.display_name?.split(' ')[0] || '?'}
                            {isMe && <span className="text-green-400 text-xs ml-1">(you)</span>}
                          </p>
                          {isLeader && gs.rounds > 0 && duel.status === 'active' && (
                            <p className="text-green-400 text-xs font-semibold">LEADING ⛳</p>
                          )}
                        </div>
                        {gs.rounds === 0 ? (
                          <p className="text-gray-600 text-sm">No rounds yet</p>
                        ) : (
                          <div className="space-y-1.5 text-xs">
                            <div className="flex justify-between">
                              <span className="text-gray-500">⛳ Rounds</span>
                              <span className="text-gray-300 font-medium">{gs.rounds}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">📊 Avg Score</span>
                              <span className={`font-bold text-base ${isLeader ? 'text-green-400' : 'text-white'}`}>
                                {gs.avgScore.toFixed(1)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">🏌️ Best</span>
                              <span className="text-gray-300">{Math.min(...rounds.map(r => r.gross_score))}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Golf round history */}
                {(golfRoundsA.length > 0 || golfRoundsB.length > 0) && (
                  <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
                    <p className="text-gray-500 text-xs font-semibold mb-3">ROUND HISTORY</p>
                    <div className="space-y-2">
                      {[...golfRoundsA.map(r => ({ ...r, profile: profileA })),
                         ...golfRoundsB.map(r => ({ ...r, profile: profileB }))]
                        .sort((a, b) => b.played_at.localeCompare(a.played_at))
                        .map(round => (
                          <div key={round.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                            <div>
                              <p className="text-white text-sm font-semibold">
                                {round.profile?.display_name?.split(' ')[0]} — {round.gross_score} strokes
                                <span className="text-gray-500 text-xs ml-1">({round.holes}h)</span>
                              </p>
                              {round.course_name && (
                                <p className="text-gray-500 text-xs">{round.course_name}</p>
                              )}
                              {round.notes && (
                                <p className="text-gray-600 text-xs italic">{round.notes}</p>
                              )}
                            </div>
                            <p className="text-gray-600 text-xs">{new Date(round.played_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                          </div>
                        ))
                      }
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Healthy Day Check-In card (competitors only, active duel) */}
            {isCompetitor && isActive && !isGolfFormat && (
              <div className={`rounded-2xl border ${
                alreadyCheckedIn
                  ? (myTodayCheckIn?.earned_bonus ? 'bg-green-950/30 border-green-700/50' : 'bg-gray-900 border-gray-700')
                  : 'bg-yellow-950/20 border-yellow-700/40'
              } p-4`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-white font-semibold text-sm">🥗 Healthy Day{isBeforeNoon && !alreadyCheckedIn ? ' (yesterday)' : ''}</p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {isBeforeNoon && !alreadyCheckedIn
                        ? `Morning grace period — log yesterday's meals before noon · `
                        : ''
                      }{myStreak > 0 ? `🔥 ${myStreak}-day streak · ` : ''}{myBonusDays} bonus days · +{myTotalBonusPts} pts total
                    </p>
                  </div>
                  {alreadyCheckedIn ? (
                    <div className="text-right">
                      <p className={`text-lg font-black ${myTodayCheckIn?.earned_bonus ? 'text-green-400' : 'text-gray-400'}`}>
                        {myTodayCheckIn?.earned_bonus ? (isStreakFormat ? '✓ +1' : '✓ +10') : '✗'}
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
            {!isGolfFormat && checkInResult && (
              <div className={`rounded-2xl p-4 text-center border ${
                checkInResult.earned_bonus ? 'bg-green-950/40 border-green-600/50' : 'bg-gray-900 border-gray-700'
              }`}>
                <p className={`text-2xl font-black ${checkInResult.earned_bonus ? 'text-green-400' : 'text-gray-400'}`}>
                  {checkInResult.earned_bonus ? (isStreakFormat ? '🥗 Healthy Day! +1 pt' : '🥗 Healthy Day Bonus! +10 pts') : 'Check-in logged. No bonus today.'}
                </p>
                <button onClick={() => setCheckInResult(null)} className="text-gray-600 text-xs mt-2">dismiss</button>
              </div>
            )}

            {/* Side-by-side scorecards (non-golf) */}
            {!isGolfFormat && <div className="grid grid-cols-2 gap-3">
              {[
                { profile: profileA, score: effectiveScoreA, streakScore: streakScoreA, workouts: workoutsA, checkIns: checkInsA,
                  startW: duel.starting_weight_a, lowW: duel.lowest_weight_a, targetW: duel.target_weight_a, streak: streakA },
                { profile: profileB, score: effectiveScoreB, streakScore: streakScoreB, workouts: workoutsB, checkIns: checkInsB,
                  startW: duel.starting_weight_b, lowW: duel.lowest_weight_b, targetW: duel.target_weight_b, streak: streakB },
              ].map(({ profile, score, streakScore, workouts, checkIns, startW, lowW, targetW, streak }, idx) => {
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
                        {isStreakFormat ? score.total : score.total.toFixed(1)}
                      </p>
                      <p className="text-gray-500 text-xs">{isStreakFormat ? `of ${streakScore.maxPossible} pts` : 'total pts'}</p>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-500">{isStreakFormat ? '💪 Workout Days' : '💪 Workout'}</span>
                        <span className="text-gray-300 font-medium">{isStreakFormat ? `${streakScore.workoutDays}d` : score.workoutPts}</span>
                      </div>
                      {!isStreakFormat && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">⚖️ Weight</span>
                          <span className={`font-medium ${score.weightLossPts > 0 ? 'text-green-400' : 'text-gray-600'}`}>
                            {score.weightLossPts > 0 ? `+${Math.round(score.weightLossPts)}` : '—'}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-500">🥗 {isStreakFormat ? 'Healthy Days' : 'Healthy Days'}</span>
                        <span className={`font-medium ${score.healthyDayPts > 0 ? 'text-green-400' : 'text-gray-600'}`}>
                          {isStreakFormat ? `${streakScore.healthyDays}d` : (score.healthyDayPts > 0 ? `+${score.healthyDayPts}` : '—')}
                        </span>
                      </div>
                      {!isStreakFormat && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">🏃 Workouts</span>
                          <span className="text-gray-400">{workouts.length}</span>
                        </div>
                      )}
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
            </div>}

            {/* Head-to-head progress bar */}
            {!isGolfFormat && (scoreA.total > 0 || scoreB.total > 0) && (
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
            {!isGolfFormat && isActive && (scoreA.workoutPts > 0 || scoreB.workoutPts > 0) && (
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

              if (item.type === 'body_photo') {
                const bp = item as WeeklyPhoto & { type: 'body_photo'; profile?: Profile }
                return (
                  <div key={`bp-${bp.id}`} className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">📸</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-2">
                          <span className="text-white text-sm font-semibold">{bp.profile?.display_name?.split(' ')[0]}</span>
                          <span className="text-gray-400 text-xs">weekly body check-in · week of {bp.check_in_week}</span>
                        </div>
                        <div className="flex gap-2">
                          {bp.front_photo_url && (
                            <a href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/duel-proofs/${bp.front_photo_url}`}
                              target="_blank" rel="noopener noreferrer">
                              <img
                                src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/duel-proofs/${bp.front_photo_url}`}
                                className="w-20 h-28 rounded-xl object-cover border border-gray-700"
                                alt="front"
                              />
                            </a>
                          )}
                          {bp.side_photo_url && (
                            <a href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/duel-proofs/${bp.side_photo_url}`}
                              target="_blank" rel="noopener noreferrer">
                              <img
                                src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/duel-proofs/${bp.side_photo_url}`}
                                className="w-20 h-28 rounded-xl object-cover border border-gray-700"
                                alt="side"
                              />
                            </a>
                          )}
                        </div>
                        {bp.notes && <p className="text-gray-500 text-xs mt-2 italic">"{bp.notes}"</p>}
                        <p className="text-gray-600 text-xs mt-1">{formatTimeAgo(bp.submitted_at)}</p>
                      </div>
                    </div>
                  </div>
                )
              }

              // checkin
              const ci = item as CheckIn & { type: 'checkin'; profile?: Profile }
              const isExpanded = expandedCheckIn === ci.id
              const linkedCommentCount = comments.filter(c => c.activity_id === ci.id).length
              const disqualifierLabels = [
                ci.drank_alcohol && 'Drank alcohol',
                ci.ate_fried_food && 'Ate fried food',
                ci.ate_fast_food && 'Ate fast food',
                ci.ate_dessert && 'Ate dessert/candy',
                ci.had_cheat_meal && 'Cheat meal',
                ci.had_binge_meal && 'Binge meal',
              ].filter(Boolean) as string[]
              return (
                <div
                  key={`ci-${ci.id}`}
                  onClick={() => setExpandedCheckIn(isExpanded ? null : ci.id)}
                  className={`rounded-2xl p-4 border cursor-pointer transition-colors ${
                    ci.earned_bonus ? 'bg-green-950/20 border-green-800/50' : 'bg-gray-900 border-gray-800'
                  }`}
                >
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
                      {!isExpanded && (
                        <p className="text-gray-500 text-xs mt-1 truncate">
                          {ci.meal_description && <span className="italic">"{ci.meal_description}"</span>}
                          {linkedCommentCount > 0 && <span className="text-gray-600 ml-1">💬 {linkedCommentCount}</span>}
                          {!ci.meal_description && linkedCommentCount === 0 && <span>Tap to view details</span>}
                        </p>
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

                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-gray-700/50 space-y-2" onClick={e => e.stopPropagation()}>
                      {[
                        { label: '🌅 Breakfast', value: ci.breakfast_notes },
                        { label: '☀️ Lunch', value: ci.lunch_notes },
                        { label: '🌙 Dinner', value: ci.dinner_notes },
                        { label: '🍎 Snacks', value: ci.snack_notes },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <p className="text-gray-500 text-xs">{label}</p>
                          <p className="text-gray-300 text-sm">{value || '—'}</p>
                        </div>
                      ))}
                      {disqualifierLabels.length > 0 && (
                        <div className="mt-1">
                          <p className="text-red-400 text-xs font-semibold">❌ Disqualifiers</p>
                          <p className="text-red-300 text-sm">{disqualifierLabels.join(' · ')}</p>
                        </div>
                      )}
                      {disqualifierLabels.length === 0 && ci.earned_bonus && (
                        <p className="text-green-400 text-xs">✓ No disqualifiers — clean day!</p>
                      )}

                      {/* Comments on this check-in */}
                      {(() => {
                        const linked = comments.filter(c => c.activity_id === ci.id)
                        return linked.length > 0 ? (
                          <div className="mt-2 pt-2 border-t border-gray-700/30 space-y-1.5">
                            {linked.map(c => (
                              <div key={c.id} className="flex gap-2">
                                <span className="text-white text-xs font-semibold flex-shrink-0">
                                  {c.profiles?.display_name?.split(' ')[0] || '?'}
                                </span>
                                <span className="text-gray-300 text-xs">{c.body}</span>
                                <span className="text-gray-600 text-xs flex-shrink-0">{formatTimeAgo(c.created_at)}</span>
                              </div>
                            ))}
                          </div>
                        ) : null
                      })()}

                      {/* Inline comment input */}
                      <div className="mt-2 pt-2 border-t border-gray-700/30">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={activityCommentText[ci.id] || ''}
                            onChange={e => { setActivityCommentError(null); setActivityCommentText(prev => ({ ...prev, [ci.id]: e.target.value })) }}
                            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && postActivityComment('checkin', ci.id)}
                            placeholder="Add a comment..."
                            className="flex-1 bg-gray-800 text-white rounded-lg px-3 py-2 text-xs placeholder-gray-600 border border-gray-700 focus:border-green-500 focus:outline-none"
                          />
                          <button
                            onClick={() => postActivityComment('checkin', ci.id)}
                            disabled={postingActivityComment === ci.id || !activityCommentText[ci.id]?.trim()}
                            className="bg-green-500 hover:bg-green-400 disabled:opacity-40 text-black font-bold px-3 py-2 rounded-lg text-xs transition-colors"
                          >
                            {postingActivityComment === ci.id ? '...' : '→'}
                          </button>
                        </div>
                        {activityCommentError && (
                          <p className="text-red-400 text-xs mt-1">{activityCommentError}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── WEIGH-IN TAB ── */}
        {tab === 'weigh-in' && isCompetitor && (
          <div className="space-y-4">

            {/* Edit Starting / Target Weight */}
            <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 space-y-3">
              <h3 className="text-white font-semibold text-sm">⚖️ Edit Weight Goals</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-xs block mb-1.5">Starting Weight (lbs)</label>
                  <input
                    type="number" value={editStarting} onChange={e => setEditStarting(e.target.value)}
                    placeholder="e.g. 188" step="0.1" min="50" max="999"
                    className="w-full bg-gray-800 text-white rounded-xl px-3 py-2.5 text-sm border border-gray-700 focus:border-green-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1.5">Target Weight (lbs)</label>
                  <input
                    type="number" value={editTarget} onChange={e => setEditTarget(e.target.value)}
                    placeholder="e.g. 170" step="0.1" min="50" max="999"
                    className="w-full bg-gray-800 text-white rounded-xl px-3 py-2.5 text-sm border border-gray-700 focus:border-green-500 focus:outline-none"
                  />
                </div>
              </div>
              {editStarting && editTarget && Number(editTarget) >= Number(editStarting) && (
                <p className="text-yellow-500 text-xs">Target must be less than starting weight</p>
              )}
              {weightsError && <p className="text-red-400 text-xs">{weightsError}</p>}
              {weightsSuccess && <p className="text-green-400 text-xs">✓ Saved! Scores updated.</p>}
              <button
                onClick={submitUpdateWeights}
                disabled={savingWeights || !editStarting || !editTarget || Number(editTarget) >= Number(editStarting)}
                className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-bold py-2.5 rounded-xl text-sm transition-colors"
              >
                {savingWeights ? 'Saving...' : 'Save Weight Goals'}
              </button>
              <p className="text-gray-600 text-xs">
                Weight loss pts = (lbs lost / lbs to target) × 300 max
              </p>
            </div>

            {/* Weekly Body Check-In */}
            <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 space-y-4">
              <div>
                <h3 className="text-white font-semibold text-sm">📸 Weekly Body Check-In</h3>
                <p className="text-gray-500 text-xs mt-1">Front + side photos, once per week. One submission per week — re-uploading replaces the current week's photos.</p>
              </div>

              {bodySuccess && (
                <div className="bg-green-950/30 border border-green-700/50 rounded-xl px-4 py-3">
                  <p className="text-green-400 text-sm font-semibold">✓ Body check-in submitted!</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {/* Front photo */}
                <div>
                  <p className="text-gray-400 text-xs mb-2">Front view *</p>
                  <input ref={frontPhotoRef} type="file" accept="image/*"
                    onChange={handleFrontPhotoChange} className="hidden" />
                  {frontPreview ? (
                    <div className="relative">
                      <img src={frontPreview} className="w-full aspect-[3/4] rounded-xl object-cover" alt="front" />
                      <button type="button" onClick={() => { setFrontPhoto(null); setFrontPreview(null) }}
                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs font-bold flex items-center justify-center">×</button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => frontPhotoRef.current?.click()}
                      className="w-full aspect-[3/4] bg-gray-800 border border-gray-700 rounded-xl flex flex-col items-center justify-center gap-1 text-gray-500 hover:bg-gray-700 transition-colors">
                      <span className="text-3xl">📷</span>
                      <span className="text-xs">Front</span>
                    </button>
                  )}
                </div>

                {/* Side photo */}
                <div>
                  <p className="text-gray-400 text-xs mb-2">Side view *</p>
                  <input ref={sidePhotoRef} type="file" accept="image/*"
                    onChange={handleSidePhotoChange} className="hidden" />
                  {sidePreview ? (
                    <div className="relative">
                      <img src={sidePreview} className="w-full aspect-[3/4] rounded-xl object-cover" alt="side" />
                      <button type="button" onClick={() => { setSidePhoto(null); setSidePreview(null) }}
                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs font-bold flex items-center justify-center">×</button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => sidePhotoRef.current?.click()}
                      className="w-full aspect-[3/4] bg-gray-800 border border-gray-700 rounded-xl flex flex-col items-center justify-center gap-1 text-gray-500 hover:bg-gray-700 transition-colors">
                      <span className="text-3xl">📷</span>
                      <span className="text-xs">Side</span>
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="text-gray-400 text-xs block mb-1.5">Notes (optional)</label>
                <input type="text" value={bodyNotes} onChange={e => setBodyNotes(e.target.value)}
                  placeholder="e.g. Morning, fasted"
                  className="w-full bg-gray-800 text-white rounded-xl px-4 py-2.5 text-sm border border-gray-700 focus:border-green-500 focus:outline-none" />
              </div>

              {bodyError && <p className="text-red-400 text-sm">{bodyError}</p>}
              <button
                onClick={submitBodyCheckIn}
                disabled={submittingBody || !frontPhoto || !sidePhoto}
                className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-bold py-3 rounded-xl text-sm transition-colors"
              >
                {submittingBody ? 'Uploading...' : '📸 Submit Body Check-In'}
              </button>
            </div>

            {/* Body check-ins: progress comparison + history */}
            {(() => {
              const myPhotos = weeklyPhotos.filter(p => p.user_id === currentUserId)
              if (myPhotos.length === 0) return null
              const latest = myPhotos[0]
              const first = myPhotos[myPhotos.length - 1]
              const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
              const imgUrl = (path: string) => `${supaUrl}/storage/v1/object/public/duel-proofs/${path}`
              const hasComparison = myPhotos.length >= 2
              return (
                <div className="space-y-3">
                  {/* Progress comparison — only when 2+ check-ins */}
                  {hasComparison && (
                    <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-white font-semibold text-sm">📊 Progress Comparison</p>
                          <p className="text-gray-500 text-xs mt-0.5">{first.check_in_week} → {latest.check_in_week}</p>
                        </div>
                        <button
                          onClick={() => buildProgressImage(first, latest)}
                          disabled={buildingProgress}
                          className="flex-shrink-0 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                        >
                          {buildingProgress ? 'Building…' : '⬛ View Combined'}
                        </button>
                      </div>
                      {/* Front view */}
                      {(first.front_photo_url || latest.front_photo_url) && (
                        <div>
                          <p className="text-gray-400 text-xs font-semibold mb-2 uppercase tracking-wide">Front View</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <p className="text-gray-600 text-xs text-center">First</p>
                              {first.front_photo_url ? (
                                <a href={imgUrl(first.front_photo_url)} target="_blank" rel="noopener noreferrer">
                                  <img src={imgUrl(first.front_photo_url)} className="w-full aspect-[3/4] rounded-xl object-cover border border-gray-700" alt="first front" />
                                </a>
                              ) : <div className="w-full aspect-[3/4] rounded-xl bg-gray-800 border border-gray-700" />}
                              <p className="text-gray-600 text-xs text-center">{first.check_in_week}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-gray-600 text-xs text-center">Latest</p>
                              {latest.front_photo_url ? (
                                <a href={imgUrl(latest.front_photo_url)} target="_blank" rel="noopener noreferrer">
                                  <img src={imgUrl(latest.front_photo_url)} className="w-full aspect-[3/4] rounded-xl object-cover border border-green-700" alt="latest front" />
                                </a>
                              ) : <div className="w-full aspect-[3/4] rounded-xl bg-gray-800 border border-gray-700" />}
                              <p className="text-gray-600 text-xs text-center">{latest.check_in_week}</p>
                            </div>
                          </div>
                        </div>
                      )}
                      {/* Side view */}
                      {(first.side_photo_url || latest.side_photo_url) && (
                        <div>
                          <p className="text-gray-400 text-xs font-semibold mb-2 uppercase tracking-wide">Side View</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <p className="text-gray-600 text-xs text-center">First</p>
                              {first.side_photo_url ? (
                                <a href={imgUrl(first.side_photo_url)} target="_blank" rel="noopener noreferrer">
                                  <img src={imgUrl(first.side_photo_url)} className="w-full aspect-[3/4] rounded-xl object-cover border border-gray-700" alt="first side" />
                                </a>
                              ) : <div className="w-full aspect-[3/4] rounded-xl bg-gray-800 border border-gray-700" />}
                              <p className="text-gray-600 text-xs text-center">{first.check_in_week}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-gray-600 text-xs text-center">Latest</p>
                              {latest.side_photo_url ? (
                                <a href={imgUrl(latest.side_photo_url)} target="_blank" rel="noopener noreferrer">
                                  <img src={imgUrl(latest.side_photo_url)} className="w-full aspect-[3/4] rounded-xl object-cover border border-green-700" alt="latest side" />
                                </a>
                              ) : <div className="w-full aspect-[3/4] rounded-xl bg-gray-800 border border-gray-700" />}
                              <p className="text-gray-600 text-xs text-center">{latest.check_in_week}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Full history list */}
                  <div className="space-y-2">
                    <p className="text-gray-500 text-xs font-semibold">YOUR BODY CHECK-INS</p>
                    {myPhotos.map(bp => (
                      <div key={bp.id} className="bg-gray-900 rounded-xl p-3 border border-gray-800">
                        <p className="text-white text-xs font-medium mb-2">Week of {bp.check_in_week}</p>
                        <div className="flex gap-2">
                          {bp.front_photo_url && (
                            <a href={imgUrl(bp.front_photo_url)} target="_blank" rel="noopener noreferrer">
                              <img src={imgUrl(bp.front_photo_url)} className="w-16 h-20 rounded-lg object-cover border border-gray-700" alt="front" />
                            </a>
                          )}
                          {bp.side_photo_url && (
                            <a href={imgUrl(bp.side_photo_url)} target="_blank" rel="noopener noreferrer">
                              <img src={imgUrl(bp.side_photo_url)} className="w-16 h-20 rounded-lg object-cover border border-gray-700" alt="side" />
                            </a>
                          )}
                        </div>
                        {bp.notes && <p className="text-gray-600 text-xs mt-1 italic">"{bp.notes}"</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

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
                <input ref={weighPhotoRef} type="file" accept="image/*"
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
              <h2 className="text-white font-bold text-lg">
                🥗 Daily Check-In {isBeforeNoon && <span className="text-sm text-gray-400 font-normal">for {checkinDateStr}</span>}
              </h2>
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

      {/* Progress comparison full-screen modal */}
      {showProgressModal && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex flex-col"
          onClick={() => setShowProgressModal(false)}
        >
          <div className="flex items-center justify-between px-5 pt-14 pb-3 flex-shrink-0" onClick={e => e.stopPropagation()}>
            <p className="text-white font-semibold text-base">Progress Comparison</p>
            <button onClick={() => setShowProgressModal(false)} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
          </div>
          <div className="flex-1 overflow-auto flex flex-col items-center px-4 pb-8" onClick={e => e.stopPropagation()}>
            {progressImageUrl && (
              <>
                <img
                  src={progressImageUrl}
                  className="w-full max-w-lg rounded-2xl"
                  alt="Progress comparison"
                />
                <button
                  className="mt-4 bg-green-500 hover:bg-green-400 text-black font-bold px-8 py-3 rounded-xl text-sm"
                  onClick={async (e) => {
                    e.stopPropagation()
                    const dataUrl = progressImageUrl!
                    const res = await fetch(dataUrl)
                    const blob = await res.blob()
                    const file = new File([blob], 'progress-comparison.jpg', { type: 'image/jpeg' })
                    if (navigator.canShare?.({ files: [file] })) {
                      await navigator.share({ files: [file], title: 'Progress Comparison' })
                    } else {
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = 'progress-comparison.jpg'
                      a.click()
                      URL.revokeObjectURL(url)
                    }
                  }}
                >
                  ↓ Save Photo
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
