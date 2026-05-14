import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import { getWeekStart, getWeekEnd, WEEKLY_GOAL, formatWeekRange } from '@/lib/points'
import type { Profile } from '@/lib/types'
import Link from 'next/link'
import ActivityFeedClient from '@/components/ActivityFeedClient'
import LiveChallenges, { type ChallengeData } from '@/components/LiveChallenges'

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

  // All profiles
  const { data: allProfiles } = await supabase
    .from('profiles')
    .select('*')
    .order('display_name')

  const profileMap: Record<string, Profile> = {}
  for (const p of (allProfiles || [])) profileMap[p.id] = p

  // Weekly leaderboard scores (all users, current week)
  const allIds = (allProfiles || []).map((p: Profile) => p.id)
  const { data: weekWorkouts } = await supabase
    .from('workouts')
    .select('user_id, points')
    .in('user_id', allIds)
    .gte('logged_at', weekStart.toISOString())
    .lte('logged_at', weekEnd.toISOString())

  const weekScores: Record<string, number> = {}
  for (const w of (weekWorkouts || [])) {
    weekScores[w.user_id] = (weekScores[w.user_id] || 0) + w.points
  }

  // Active challenges
  const { data: activeWagers } = await supabase
    .from('wagers')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  // Pending wagers not yet responded to by this user
  const { data: pendingWagers } = await supabase
    .from('wagers')
    .select('*, profiles!wagers_proposed_by_fkey(display_name), wager_acceptances(user_id)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  const myPendingWagers = (pendingWagers || []).filter((w: any) =>
    !w.wager_acceptances?.some((a: any) => a.user_id === user.id)
  )

  // Build challenge data for LiveChallenges component
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Collect all worker IDs across active challenges
  const allWorkerIds = [...new Set((activeWagers || []).flatMap((w: any) => w.team_player_ids || []))] as string[]

  // Get all relevant workout points across all challenges
  const earliestStart = (activeWagers || []).reduce(
    (min: string, w: any) => (w.week_start < min ? w.week_start : min),
    new Date().toISOString().split('T')[0]
  )

  const { data: challengeWorkouts } = allWorkerIds.length > 0
    ? await supabase
        .from('workouts')
        .select('user_id, points, logged_at')
        .in('user_id', allWorkerIds)
        .gte('logged_at', earliestStart)
    : { data: [] }

  const challenges: ChallengeData[] = (activeWagers || [])
    .filter((w: any) =>
      (w.team_player_ids || []).includes(user.id) ||
      (w.watcher_ids || []).includes(user.id)
    )
    .map((w: any) => {
      const start = new Date(w.week_start)
      const end = w.end_date ? new Date(w.end_date) : null
      const endMidnight = end ? new Date(end.getTime() + 24 * 60 * 60 * 1000) : null
      const daysTotal = end ? Math.round((end.getTime() - start.getTime()) / 86400000) + 1 : 7
      const daysElapsed = Math.max(1, Math.round((today.getTime() - start.getTime()) / 86400000) + 1)
      const daysLeft = endMidnight ? Math.max(0, Math.round((endMidnight.getTime() - today.getTime()) / 86400000)) : 0

      // Points per worker within this wager's window
      const workerPts: Record<string, number> = {}
      for (const workout of (challengeWorkouts || [])) {
        const loggedAt = new Date(workout.logged_at)
        const inWindow = loggedAt >= start && (!endMidnight || loggedAt <= endMidnight)
        if (inWindow && (w.team_player_ids || []).includes(workout.user_id)) {
          workerPts[workout.user_id] = (workerPts[workout.user_id] || 0) + workout.points
        }
      }

      const workers = (w.team_player_ids || [])
        .filter((id: string) => profileMap[id])
        .map((id: string) => {
          const pts = workerPts[id] || 0
          const pct = Math.min(100, (pts / w.point_threshold) * 100)
          const ptsPerDayElapsed = pts / daysElapsed
          const projected = Math.round(ptsPerDayElapsed * daysTotal)
          return {
            profile: profileMap[id],
            points: pts,
            pct,
            onTrack: projected >= w.point_threshold || pts >= w.point_threshold,
            projected,
          }
        })

      return {
        id: w.id,
        title: w.title,
        threshold: w.point_threshold,
        weekStart: w.week_start,
        endDate: w.end_date,
        daysLeft,
        daysTotal,
        daysElapsed,
        stakeIfMotivators: w.stake_if_partners_win,
        stakeIfWorkers: w.stake_if_competitors_win,
        workers,
        isWorker: (w.team_player_ids || []).includes(user.id),
        isMotivator: (w.watcher_ids || []).includes(user.id),
      }
    })

  // Recent activity feed
  const { data: recentWorkouts } = await supabase
    .from('workouts')
    .select('*, profiles(display_name, username), workout_reactions(*), workout_comments(id)')
    .order('logged_at', { ascending: false })
    .limit(10)

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
            {(allProfiles || [])
              .sort((a: Profile, b: Profile) => (weekScores[b.id] || 0) - (weekScores[a.id] || 0))
              .map((p: Profile, idx: number) => {
                const pts = weekScores[p.id] || 0
                const pct = Math.min(100, (pts / WEEKLY_GOAL) * 100)
                const passed = pts >= WEEKLY_GOAL
                const isMe = p.id === user.id

                return (
                  <div
                    key={p.id}
                    className={`bg-gray-800 rounded-2xl p-4 ${isMe ? 'ring-2 ring-green-500/50' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}</span>
                        <div>
                          <span className="font-semibold text-white">{p.display_name}</span>
                          {isMe && <span className="text-xs text-gray-500 ml-1">(you)</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`font-bold text-lg ${passed ? 'text-green-400' : 'text-white'}`}>{pts}</span>
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
        {/* Pending challenge alert */}
        {myPendingWagers.length > 0 && (
          <Link href="/wagers">
            <div className="bg-yellow-900/30 border border-yellow-600/50 rounded-2xl p-4 flex items-center gap-3">
              <span className="text-2xl">💰</span>
              <div className="flex-1">
                <p className="text-yellow-300 font-semibold text-sm">
                  {myPendingWagers.length === 1
                    ? `Challenge waiting: "${myPendingWagers[0].title}"`
                    : `${myPendingWagers.length} challenges waiting for your response`}
                </p>
                <p className="text-yellow-600 text-xs mt-0.5">Tap to accept or decline →</p>
              </div>
            </div>
          </Link>
        )}

        {/* Live challenges */}
        <LiveChallenges challenges={challenges} currentUserId={user.id} />

        {/* Activity Feed */}
        <div>
          <h2 className="text-white font-semibold mb-3">Activity Feed</h2>
          {recentWorkouts && recentWorkouts.length > 0 ? (
            <ActivityFeedClient
              initialWorkouts={recentWorkouts as any}
              currentUserId={user.id}
            />
          ) : (
            <div className="bg-gray-900 rounded-2xl p-8 text-center">
              <p className="text-gray-500">No workouts logged yet.</p>
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
