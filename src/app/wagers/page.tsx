import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import WagersClient from './WagersClient'
import LiveChallenges, { type ChallengeData } from '@/components/LiveChallenges'
import { getWeekStart } from '@/lib/points'
import type { Profile } from '@/lib/types'

export const revalidate = 0

export default async function WagersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const { data: allProfiles } = await supabase
    .from('profiles')
    .select('*')
    .order('display_name')

  const profileMap: Record<string, Profile> = {}
  for (const p of (allProfiles || [])) profileMap[p.id] = p

  // Active challenges
  const { data: activeWagers } = await supabase
    .from('wagers')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  // Collect all worker IDs and fetch their workout points
  const allWorkerIds = [...new Set((activeWagers || []).flatMap((w: any) => w.team_player_ids || []))] as string[]
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

  const today = new Date()
  today.setHours(0, 0, 0, 0)

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
          const projected = Math.round((pts / daysElapsed) * daysTotal)
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

  return (
    <div className="min-h-screen bg-gray-950 pb-24">
      <div className="bg-gray-900 px-4 pt-12 pb-6 border-b border-gray-800">
        <div className="max-w-lg mx-auto">
          <h1 className="text-2xl font-bold text-white">Wagers 💰</h1>
          <p className="text-gray-400 text-sm mt-1">Make it interesting. Put something on the line.</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6 space-y-6">
        {/* Live scoreboard */}
        <LiveChallenges challenges={challenges} currentUserId={user.id} />

        {/* Wager management */}
        <WagersClient
          currentUserId={user.id}
          allProfiles={allProfiles || []}
          weekStart={getWeekStart().toISOString()}
        />
      </div>

      <BottomNav />
    </div>
  )
}
