import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { notFound, redirect } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import Link from 'next/link'
import PlayerFollowButton from './PlayerFollowButton'
import { WORKOUT_TYPES } from '@/lib/points'
import { formatRelativeTime } from '@/lib/utils'

export const revalidate = 0

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ─── Personas ────────────────────────────────────────────────────────────────

const PERSONAS = [
  {
    key: 'non-payer',
    emoji: '💸',
    label: 'The Non-Payer',
    description: 'Great at losing challenges. Terrible at paying up.',
    bg: 'bg-red-900/30',
    border: 'border-red-700/40',
    text: 'text-red-300',
    badge: 'bg-red-900/50 text-red-300',
  },
  {
    key: 'ghost',
    emoji: '👻',
    label: 'The Ghost',
    description: 'In the group chat. Never at the gym.',
    bg: 'bg-gray-800/50',
    border: 'border-gray-600/40',
    text: 'text-gray-400',
    badge: 'bg-gray-800/70 text-gray-400',
  },
  {
    key: 'lazy-bum',
    emoji: '🛋️',
    label: 'The Lazy Bum',
    description: 'Has the app. Still on the couch.',
    bg: 'bg-yellow-900/25',
    border: 'border-yellow-700/40',
    text: 'text-yellow-300',
    badge: 'bg-yellow-900/50 text-yellow-300',
  },
  {
    key: 'team-carrier',
    emoji: '💪',
    label: 'The Team Carrier',
    description: "Doing everyone else's work. You're welcome.",
    bg: 'bg-green-900/25',
    border: 'border-green-700/40',
    text: 'text-green-300',
    badge: 'bg-green-900/50 text-green-300',
  },
  {
    key: 'early-bird',
    emoji: '🌅',
    label: 'The Early Bird',
    description: 'Annoyingly productive before 9am.',
    bg: 'bg-orange-900/25',
    border: 'border-orange-700/40',
    text: 'text-orange-300',
    badge: 'bg-orange-900/50 text-orange-300',
  },
  {
    key: 'weekend-warrior',
    emoji: '⚔️',
    label: 'The Weekend Warrior',
    description: 'Mon–Fri: office drone. Weekends: absolute beast.',
    bg: 'bg-purple-900/25',
    border: 'border-purple-700/40',
    text: 'text-purple-300',
    badge: 'bg-purple-900/50 text-purple-300',
  },
  {
    key: 'iron-man',
    emoji: '🦾',
    label: 'The Iron Man',
    description: 'No days off. Seriously, none.',
    bg: 'bg-blue-900/25',
    border: 'border-blue-700/40',
    text: 'text-blue-300',
    badge: 'bg-blue-900/50 text-blue-300',
  },
  {
    key: 'enforcer',
    emoji: '👊',
    label: 'The Enforcer',
    description: 'Collects challenge victories like trophies.',
    bg: 'bg-orange-900/25',
    border: 'border-orange-700/40',
    text: 'text-orange-300',
    badge: 'bg-orange-900/50 text-orange-300',
  },
  {
    key: 'honorable',
    emoji: '💎',
    label: 'The Honorable',
    description: 'Lost fair and paid every single time.',
    bg: 'bg-teal-900/25',
    border: 'border-teal-700/40',
    text: 'text-teal-300',
    badge: 'bg-teal-900/50 text-teal-300',
  },
  {
    key: 'grinder',
    emoji: '🔥',
    label: 'The Grinder',
    description: "Relentlessly consistent. It's kind of intimidating.",
    bg: 'bg-orange-900/25',
    border: 'border-amber-700/40',
    text: 'text-amber-300',
    badge: 'bg-amber-900/50 text-amber-300',
  },
  {
    key: 'newcomer',
    emoji: '🆕',
    label: 'The Newcomer',
    description: "Just getting started. Don't sleep on them.",
    bg: 'bg-green-900/25',
    border: 'border-green-700/40',
    text: 'text-green-300',
    badge: 'bg-green-900/50 text-green-300',
  },
  {
    key: 'competitor',
    emoji: '🏅',
    label: 'The Competitor',
    description: 'Here to compete. Here to win.',
    bg: 'bg-indigo-900/25',
    border: 'border-indigo-700/40',
    text: 'text-indigo-300',
    badge: 'bg-indigo-900/50 text-indigo-300',
  },
]

function getPersonaKey(stats: {
  totalWorkouts: number
  totalPoints: number
  daysActive: number
  avgWorkoutsPerWeek: number
  earlyBirdPct: number
  earlyBirdCount: number
  weekendPct: number
  outstandingDebts: number
  challengesWon: number
  challengesLost: number
  hasActiveChallenge: boolean
  recentWorkoutsCount: number
}): string {
  const s = stats
  if (s.outstandingDebts >= 1 && s.challengesLost >= 1) return 'non-payer'
  if (s.hasActiveChallenge && s.recentWorkoutsCount === 0 && s.daysActive > 7) return 'ghost'
  if (s.totalWorkouts < 3 && s.daysActive > 14) return 'lazy-bum'
  if (s.totalPoints >= 200 && s.challengesWon >= 2) return 'team-carrier'
  if (s.earlyBirdCount >= 5 && s.earlyBirdPct >= 0.35) return 'early-bird'
  if (s.weekendPct >= 0.65 && s.totalWorkouts >= 8) return 'weekend-warrior'
  if (s.totalPoints >= 400 || s.totalWorkouts >= 80) return 'iron-man'
  if (s.challengesWon >= 3) return 'enforcer'
  if (s.outstandingDebts === 0 && s.challengesLost >= 1) return 'honorable'
  if (s.avgWorkoutsPerWeek >= 3.5) return 'grinder'
  if (s.daysActive < 7) return 'newcomer'
  return 'competitor'
}

// ─── Trophies ─────────────────────────────────────────────────────────────────

function computeTrophies(stats: {
  totalWorkouts: number
  totalPoints: number
  challengesWon: number
  challengesLost: number
  earlyBirdCount: number
  outstandingDebts: number
  longestStreak: number
  wasCaptain: boolean
}) {
  const t: { emoji: string; label: string; description: string }[] = []
  const s = stats
  if (s.totalWorkouts >= 1)   t.push({ emoji: '🏋️', label: 'First Sweat',    description: 'Logged first workout' })
  if (s.totalWorkouts >= 25)  t.push({ emoji: '💪',  label: 'Getting Serious', description: '25 workouts logged' })
  if (s.totalWorkouts >= 100) t.push({ emoji: '🦾',  label: 'Iron Will',       description: '100 workouts. A beast.' })
  if (s.totalPoints >= 100)   t.push({ emoji: '💯',  label: 'Century Club',    description: '100 career points' })
  if (s.totalPoints >= 500)   t.push({ emoji: '🏆',  label: 'Point Machine',   description: '500+ career points' })
  if (s.challengesWon >= 1)   t.push({ emoji: '🥇',  label: 'First W',         description: 'Won first challenge' })
  if (s.challengesWon >= 5)   t.push({ emoji: '👑',  label: 'Serial Winner',   description: 'Won 5+ challenges' })
  if (s.earlyBirdCount >= 5)  t.push({ emoji: '🌅',  label: 'Early Bird',      description: '5+ workouts before 9am' })
  if (s.earlyBirdCount >= 20) t.push({ emoji: '🌄',  label: 'Rise & Grind',    description: '20+ early sessions' })
  if (s.longestStreak >= 3)   t.push({ emoji: '🔥',  label: 'On Fire',         description: '3-day workout streak' })
  if (s.longestStreak >= 7)   t.push({ emoji: '⚡',  label: 'Unstoppable',     description: '7-day streak' })
  if (s.wasCaptain)           t.push({ emoji: '⚔️',  label: 'Captain',         description: 'Led a team draft' })
  if (s.outstandingDebts === 0 && s.challengesLost >= 2)
                              t.push({ emoji: '💎',  label: 'Honorable',       description: 'Paid every debt' })
  return t
}

function computeLongestStreak(workouts: { logged_at: string }[]): number {
  if (!workouts.length) return 0
  const days = [...new Set(workouts.map(w => w.logged_at.split('T')[0]))].sort()
  let max = 1, cur = 1
  for (let i = 1; i < days.length; i++) {
    const diff = Math.round((new Date(days[i]).getTime() - new Date(days[i - 1]).getTime()) / 86400000)
    if (diff === 1) { cur++; max = Math.max(max, cur) } else { cur = 1 }
  }
  return max
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PlayerProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const admin = getAdmin()

  const { data: profileUser } = await admin
    .from('profiles')
    .select('*')
    .eq('username', username)
    .maybeSingle()

  if (!profileUser) notFound()

  const isOwnProfile = profileUser.id === user.id

  // All workouts for this user
  const { data: rawWorkouts } = await admin
    .from('workouts')
    .select('id, workout_type, duration_minutes, points, logged_at, notes, proof_url')
    .eq('user_id', profileUser.id)
    .order('logged_at', { ascending: false })

  const allWorkouts = rawWorkouts || []
  const totalWorkouts = allWorkouts.length
  const totalPoints = allWorkouts.reduce((sum, w) => sum + w.points, 0)

  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000)
  const recentWorkoutsCount = allWorkouts.filter(w => new Date(w.logged_at) >= sevenDaysAgo).length

  const earlyBirdCount = allWorkouts.filter(w => {
    const h = new Date(w.logged_at).getHours()
    return h >= 5 && h < 9
  }).length

  const weekendWorkouts = allWorkouts.filter(w => {
    const d = new Date(w.logged_at).getDay()
    return d === 0 || d === 6
  }).length

  const joinedAt = profileUser.created_at ? new Date(profileUser.created_at) : now
  const daysActive = Math.max(1, Math.round((now.getTime() - joinedAt.getTime()) / 86400000))
  const weeksActive = Math.max(1, daysActive / 7)
  const longestStreak = computeLongestStreak(allWorkouts)

  // Wagers this person was involved in
  const [{ data: asPlayer }, { data: asWatcher }, { data: asProposer }] = await Promise.all([
    admin.from('wagers').select('id, status, winner, team_player_ids, watcher_ids').contains('team_player_ids', [profileUser.id]),
    admin.from('wagers').select('id, status, winner, team_player_ids, watcher_ids').contains('watcher_ids', [profileUser.id]),
    admin.from('wagers').select('id, status, winner, team_player_ids, watcher_ids').eq('proposed_by', profileUser.id),
  ])

  const wagerMap = new Map<string, any>()
  for (const w of [...(asPlayer || []), ...(asWatcher || []), ...(asProposer || [])]) {
    wagerMap.set(w.id, w)
  }
  const involvedWagers = [...wagerMap.values()]

  let challengesWon = 0, challengesLost = 0
  for (const w of involvedWagers) {
    if (w.status !== 'resolved') continue
    const isWorker = (w.team_player_ids || []).includes(profileUser.id)
    const isWatcher = (w.watcher_ids || []).includes(profileUser.id)
    if ((isWorker && w.winner === 'competitors') || (isWatcher && w.winner === 'partners')) challengesWon++
    if ((isWorker && w.winner === 'partners') || (isWatcher && w.winner === 'competitors')) challengesLost++
  }

  const hasActiveChallenge = involvedWagers.some(w => w.status === 'active')

  // Outstanding debts
  const { data: debts } = await admin
    .from('wager_debts')
    .select('id')
    .contains('debtor_ids', [profileUser.id])
    .eq('status', 'outstanding')
  const outstandingDebts = (debts || []).length

  // Draft captain
  const { data: captainComps } = await admin
    .from('draft_competitions')
    .select('id')
    .or(`captain_a_id.eq.${profileUser.id},captain_b_id.eq.${profileUser.id}`)
  const wasCaptain = (captainComps || []).length > 0

  // Follow state
  const [followRow, followerCountResult] = await Promise.all([
    isOwnProfile ? Promise.resolve({ data: null }) : supabase
      .from('user_follows')
      .select('follower_id')
      .eq('follower_id', user.id)
      .eq('following_id', profileUser.id)
      .maybeSingle(),
    supabase
      .from('user_follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', profileUser.id),
  ])
  const isFollowing = !!(followRow as any)?.data
  const followerCount = (followerCountResult as any)?.count || 0

  // Persona + trophies
  const personaKey = getPersonaKey({
    totalWorkouts,
    totalPoints,
    daysActive,
    avgWorkoutsPerWeek: totalWorkouts / weeksActive,
    earlyBirdPct: totalWorkouts > 0 ? earlyBirdCount / totalWorkouts : 0,
    earlyBirdCount,
    weekendPct: totalWorkouts > 0 ? weekendWorkouts / totalWorkouts : 0,
    outstandingDebts,
    challengesWon,
    challengesLost,
    hasActiveChallenge,
    recentWorkoutsCount,
  })
  const persona = PERSONAS.find(p => p.key === personaKey) ?? PERSONAS[PERSONAS.length - 1]
  const trophies = computeTrophies({ totalWorkouts, totalPoints, challengesWon, challengesLost, earlyBirdCount, outstandingDebts, longestStreak, wasCaptain })

  const initials = profileUser.display_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
  const recentTen = allWorkouts.slice(0, 10)

  return (
    <div className="min-h-screen bg-gray-950 pb-24">
      <div className="bg-gray-900 px-4 pt-12 pb-4 border-b border-gray-800">
        <div className="max-w-lg mx-auto">
          <Link href="/dashboard" className="text-gray-500 text-sm">← Back</Link>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-4">

        {/* Profile header */}
        <div className={`${persona.bg} border ${persona.border} rounded-2xl p-5`}>
          <div className="flex items-center gap-4 mb-4">
            {/* Avatar */}
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black ${persona.badge} flex-shrink-0`}>
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-white text-xl font-bold leading-tight">{profileUser.display_name}</h1>
              <p className="text-gray-500 text-sm">@{profileUser.username}</p>
              <p className="text-gray-600 text-xs mt-0.5">
                {followerCount > 0 ? `${followerCount} follower${followerCount !== 1 ? 's' : ''}` : 'No followers yet'}
              </p>
            </div>
            {!isOwnProfile && (
              <PlayerFollowButton userId={profileUser.id} initial={isFollowing} />
            )}
          </div>

          {/* Persona */}
          <div className={`${persona.badge} rounded-xl px-4 py-3`}>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xl">{persona.emoji}</span>
              <span className={`font-bold text-sm ${persona.text}`}>{persona.label}</span>
            </div>
            <p className={`text-xs ${persona.text} opacity-80`}>{persona.description}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Workouts', value: totalWorkouts, emoji: '🏋️' },
            { label: 'Points', value: totalPoints, emoji: '📊' },
            { label: 'Wins', value: challengesWon, emoji: '🏆' },
            { label: 'Streak', value: `${longestStreak}d`, emoji: '🔥' },
          ].map(stat => (
            <div key={stat.label} className="bg-gray-900 rounded-xl p-3 text-center">
              <p className="text-lg">{stat.emoji}</p>
              <p className="text-white font-bold text-lg leading-tight">{stat.value}</p>
              <p className="text-gray-500 text-xs">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Trophies */}
        {trophies.length > 0 && (
          <div className="bg-gray-900 rounded-2xl p-4">
            <h2 className="text-white font-semibold mb-3 text-sm">🏅 Trophies</h2>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {trophies.map(trophy => (
                <div
                  key={trophy.label}
                  title={trophy.description}
                  className="flex-shrink-0 bg-gray-800 rounded-xl px-3 py-2.5 text-center min-w-[68px]"
                >
                  <p className="text-2xl mb-1">{trophy.emoji}</p>
                  <p className="text-gray-300 text-xs font-medium leading-tight">{trophy.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No trophies yet */}
        {trophies.length === 0 && (
          <div className="bg-gray-900 rounded-2xl p-4 text-center">
            <p className="text-2xl mb-1">🏅</p>
            <p className="text-gray-500 text-sm">No trophies yet — get to work</p>
          </div>
        )}

        {/* Recent workouts */}
        <div className="bg-gray-900 rounded-2xl p-4">
          <h2 className="text-white font-semibold mb-3 text-sm">Recent Activity</h2>
          {recentTen.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">No workouts logged yet.</p>
          ) : (
            <div className="space-y-3">
              {recentTen.map(workout => {
                const wType = WORKOUT_TYPES.find(t => t.value === workout.workout_type)
                const loggedHour = new Date(workout.logged_at).getHours()
                const earlyBird = loggedHour >= 5 && loggedHour < 9
                return (
                  <div key={workout.id} className="flex items-center gap-3 py-2 border-b border-gray-800 last:border-0">
                    <span className="text-xl w-7 text-center flex-shrink-0">{wType?.emoji || '💪'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-white text-sm font-medium">{wType?.label || workout.workout_type}</p>
                        {earlyBird && (
                          <span className="text-xs bg-yellow-900/50 text-yellow-400 px-1.5 py-0.5 rounded-md">🌅 early</span>
                        )}
                      </div>
                      <p className="text-gray-500 text-xs">{workout.duration_minutes}min · {formatRelativeTime(workout.logged_at)}</p>
                    </div>
                    <span className="text-green-400 font-bold text-sm flex-shrink-0">+{workout.points}</span>
                  </div>
                )
              })}
            </div>
          )}
          {allWorkouts.length > 10 && (
            <p className="text-gray-600 text-xs text-center mt-3">{allWorkouts.length - 10} more workouts not shown</p>
          )}
        </div>

      </div>

      <BottomNav />
    </div>
  )
}
