import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import { getWeekStart, getWeekEnd, WEEKLY_GOAL, formatWeekRange, WORKOUT_TYPES } from '@/lib/points'
import { formatRelativeTime } from '@/lib/utils'
import type { Workout, Profile } from '@/lib/types'
import Link from 'next/link'
import ProofViewer from '@/components/ProofViewer'

export const revalidate = 0

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/onboarding')

  const weekStart = getWeekStart()
  const weekEnd = getWeekEnd()

  // Get all profiles (everyone can compete)
  const { data: competitors } = await supabase
    .from('profiles')
    .select('*')
    .order('display_name')

  // Get weekly scores for all competitors
  const competitorIds = (competitors || []).map((c: Profile) => c.id)

  const { data: weekWorkouts } = await supabase
    .from('workouts')
    .select('user_id, points')
    .in('user_id', competitorIds)
    .gte('logged_at', weekStart.toISOString())
    .lte('logged_at', weekEnd.toISOString())

  const weekScores: Record<string, number> = {}
  for (const w of (weekWorkouts || [])) {
    weekScores[w.user_id] = (weekScores[w.user_id] || 0) + w.points
  }

  // Get recent activity feed (last 10 workouts from all users)
  const { data: recentWorkouts } = await supabase
    .from('workouts')
    .select('*, profiles(display_name, username), workout_reactions(*)')
    .order('logged_at', { ascending: false })
    .limit(10)

  // Active wagers
  const { data: activeWagers } = await supabase
    .from('wagers')
    .select('*, profiles(display_name)')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(3)

  // Pending wagers (not yet accepted by this user)
  const { data: pendingWagers } = await supabase
    .from('wagers')
    .select('*, profiles(display_name), wager_acceptances(user_id)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  const myPendingWagers = (pendingWagers || []).filter((w: any) =>
    !w.wager_acceptances?.some((a: any) => a.user_id === user.id)
  )

  const myWeekPoints = weekScores[user.id] || 0
  const progressPct = Math.min(100, (myWeekPoints / WEEKLY_GOAL) * 100)

  return (
    <div className="min-h-screen bg-gray-950 pb-24">
      {/* Header */}
      <div className="bg-gray-900 px-4 pt-12 pb-6 border-b border-gray-800">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-gray-400 text-sm">Hey, {profile.display_name.split(' ')[0]} 👋</p>
              <h1 className="text-2xl font-bold text-white">This Week</h1>
              <p className="text-gray-500 text-xs mt-0.5">{formatWeekRange(weekStart)}</p>
            </div>
            <Link
              href="/log-workout"
              className="bg-green-500 hover:bg-green-400 text-black font-bold px-4 py-2 rounded-xl text-sm transition-colors"
            >
              + Log Workout
            </Link>
          </div>

          {/* Leaderboard */}
          <div className="space-y-3">
            {(competitors || [])
              .sort((a: Profile, b: Profile) => (weekScores[b.id] || 0) - (weekScores[a.id] || 0))
              .map((competitor: Profile, idx: number) => {
                const pts = weekScores[competitor.id] || 0
                const pct = Math.min(100, (pts / WEEKLY_GOAL) * 100)
                const passed = pts >= WEEKLY_GOAL
                const isMe = competitor.id === user.id

                return (
                  <div
                    key={competitor.id}
                    className={`bg-gray-800 rounded-2xl p-4 ${isMe ? 'ring-2 ring-green-500/50' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{idx === 0 ? '🥇' : '🥈'}</span>
                        <div>
                          <span className="font-semibold text-white">{competitor.display_name}</span>
                          {isMe && <span className="text-xs text-gray-500 ml-1">(you)</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`font-bold text-lg ${passed ? 'text-green-400' : 'text-white'}`}>
                          {pts}
                        </span>
                        <span className="text-gray-500 text-sm"> / {WEEKLY_GOAL}</span>
                        {passed && <span className="ml-1 text-green-400">✓</span>}
                      </div>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${passed ? 'bg-green-500' : 'bg-blue-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {passed ? 'Goal reached!' : `${WEEKLY_GOAL - pts} pts to goal`}
                    </p>
                  </div>
                )
              })}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6 space-y-6">
        {/* Pending wager alert */}
        {myPendingWagers.length > 0 && (
          <Link href="/wagers">
            <div className="bg-yellow-900/30 border border-yellow-600/50 rounded-2xl p-4 flex items-center gap-3">
              <span className="text-2xl">💰</span>
              <div className="flex-1">
                <p className="text-yellow-300 font-semibold text-sm">
                  {myPendingWagers.length === 1
                    ? `New wager proposed: "${myPendingWagers[0].title}"`
                    : `${myPendingWagers.length} wagers waiting for your response`}
                </p>
                <p className="text-yellow-600 text-xs mt-0.5">Tap to view and accept →</p>
              </div>
            </div>
          </Link>
        )}

        {/* Team Status — shown when there's an active team challenge wager */}
        {activeWagers && activeWagers.some((w: any) => w.condition_type === 'team_challenge') && (() => {
          const teamWager = activeWagers.find((w: any) => w.condition_type === 'team_challenge')
          const threshold = teamWager.point_threshold
          const allPassing = (competitors || []).every((c: Profile) => (weekScores[c.id] || 0) >= threshold)
          const anyFailing = (competitors || []).some((c: Profile) => (weekScores[c.id] || 0) < threshold)
          return (
            <div className={`rounded-2xl p-4 border ${allPassing ? 'bg-green-900/20 border-green-700/50' : anyFailing ? 'bg-red-900/20 border-red-700/50' : 'bg-orange-900/20 border-orange-700/50'}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">🤝</span>
                <div>
                  <p className="text-white font-semibold text-sm">Team Challenge Active</p>
                  <p className="text-xs text-gray-400">{teamWager.title}</p>
                </div>
                <div className="ml-auto">
                  {allPassing
                    ? <span className="text-green-400 text-xs font-bold">ON TRACK ✓</span>
                    : <span className="text-red-400 text-xs font-bold">AT RISK ⚠</span>}
                </div>
              </div>
              <p className="text-xs text-gray-400 mb-1">
                Both players need <span className="text-white font-semibold">{threshold} pts</span> — if either falls short, the wives win.
              </p>
              <p className="text-xs">
                <span className="text-red-400 font-medium">Wives win: </span>
                <span className="text-gray-300">{teamWager.stake_if_partners_win}</span>
              </p>
            </div>
          )
        })()}

        {/* Active Wagers */}
        {activeWagers && activeWagers.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-white font-semibold">Active Wagers 💰</h2>
              <Link href="/wagers" className="text-sm text-gray-500 hover:text-gray-300">See all</Link>
            </div>
            <div className="space-y-2">
              {activeWagers.map((wager: any) => (
                <div key={wager.id} className="bg-gray-900 border border-yellow-700/40 rounded-2xl p-4">
                  <p className="text-white font-medium text-sm">{wager.title}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Stakes: <span className="text-yellow-400">{wager.stake_if_partners_win}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Activity Feed */}
        <div>
          <h2 className="text-white font-semibold mb-3">Activity Feed</h2>
          {recentWorkouts && recentWorkouts.length > 0 ? (
            <div className="space-y-3">
              {recentWorkouts.map((workout: Workout & { profiles: Profile }) => {
                const wType = WORKOUT_TYPES.find(t => t.value === workout.workout_type)
                const reactionCount = (workout.workout_reactions || []).length

                return (
                  <div key={workout.id} className="bg-gray-900 rounded-2xl p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{wType?.emoji || '💪'}</span>
                        <div>
                          <p className="text-white font-medium text-sm">
                            {workout.profiles?.display_name || 'Unknown'}
                          </p>
                          <p className="text-gray-500 text-xs">
                            {wType?.label} · {workout.duration_minutes}min
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-green-400 font-bold">+{workout.points}</span>
                        <p className="text-xs text-gray-600">{formatRelativeTime(workout.logged_at)}</p>
                      </div>
                    </div>
                    {workout.notes && (
                      <p className="text-gray-400 text-sm mt-2 ml-8">{workout.notes}</p>
                    )}
                    {workout.proof_url && (
                      <div className="mt-2 ml-8">
                        <ProofViewer proofUrl={workout.proof_url} proofType={workout.proof_type} />
                      </div>
                    )}
                    {reactionCount > 0 && (
                      <div className="mt-2 ml-8 flex gap-1">
                        {(workout.workout_reactions || []).slice(0, 5).map((r: any) => (
                          <span key={r.id} className="text-sm">{r.emoji}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="bg-gray-900 rounded-2xl p-8 text-center">
              <p className="text-gray-500">No workouts yet this week.</p>
              <Link href="/log-workout" className="text-green-400 text-sm mt-2 block">
                Be the first to log one →
              </Link>
            </div>
          )}
        </div>
      </div>

      <BottomNav pendingWagerCount={myPendingWagers.length} />
    </div>
  )
}
