import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import type { Profile } from '@/lib/types'
import Link from 'next/link'
import ActivityFeedClient from '@/components/ActivityFeedClient'
import LiveChallenges, { type ChallengeData } from '@/components/LiveChallenges'
import PokeSection from '@/components/PokeSection'
import ResolutionAlert from '@/components/ResolutionAlert'
import { getTodayEastern, daysLeftEastern, getEndOfDayEasternISO } from '@/lib/timezone'

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

  // All profiles for name lookups
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

  // Pending wagers not yet responded to by this user
  const { data: pendingWagers } = await supabase
    .from('wagers')
    .select('*, profiles!wagers_proposed_by_fkey(display_name), wager_acceptances(user_id)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  const myPendingWagers = (pendingWagers || []).filter((w: any) =>
    !w.wager_acceptances?.some((a: any) => a.user_id === user.id)
  )

  // Build challenge data — use Eastern date to avoid UTC-day mismatch
  const todayEasternStr = getTodayEastern()
  const [ty, tm, td] = todayEasternStr.split('-').map(Number)
  const today = new Date(Date.UTC(ty, tm - 1, td)) // midnight UTC of Eastern today (for elapsed calc)

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

  const challenges: ChallengeData[] = (activeWagers || [])
    .filter((w: any) =>
      (w.team_player_ids || []).includes(user.id) ||
      (w.watcher_ids || []).includes(user.id)
    )
    .map((w: any) => {
      const start = new Date(w.week_start)
      const endEasternISO = w.end_date ? getEndOfDayEasternISO(w.end_date) : null
      const endMidnight = endEasternISO ? new Date(endEasternISO) : null
      const daysTotal = w.end_date
        ? Math.round((new Date(w.end_date).getTime() - start.getTime()) / 86400000) + 1 : 7
      const daysElapsed = Math.max(1, Math.round((today.getTime() - start.getTime()) / 86400000) + 1)
      const daysLeft = w.end_date ? daysLeftEastern(w.end_date) : 0

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

      const motivators = (w.watcher_ids || [])
        .filter((id: string) => profileMap[id])
        .map((id: string) => profileMap[id])

      return {
        id: w.id,
        title: w.title,
        threshold: w.point_threshold,
        weekStart: w.week_start,
        endDate: w.end_date,
        endTimestamp: endEasternISO ? new Date(endEasternISO).getTime() : null,
        daysLeft,
        daysTotal,
        daysElapsed,
        stakeIfMotivators: w.stake_if_partners_win,
        stakeIfWorkers: w.stake_if_competitors_win,
        workers,
        motivators,
        isWorker: (w.team_player_ids || []).includes(user.id),
        isMotivator: (w.watcher_ids || []).includes(user.id),
      }
    })

  // Outstanding debts for current user
  const [{ data: asDebtor }, { data: asCreditor }] = await Promise.all([
    supabase.from('wager_debts').select('*').contains('debtor_ids', [user.id]).eq('status', 'outstanding'),
    supabase.from('wager_debts').select('*').contains('creditor_ids', [user.id]).eq('status', 'outstanding'),
  ])
  const outstandingDebts = [
    ...(asDebtor || []).map((d: any) => ({ ...d, iAmDebtor: true })),
    ...(asCreditor || []).map((d: any) => ({ ...d, iAmDebtor: false })),
  ]

  // IDs of people in active challenges WITH current user (for activity feed badge)
  const activeCompetitorIds = new Set<string>()
  for (const w of (activeWagers || [])) {
    const involved = (w.team_player_ids || []).includes(user.id) || (w.watcher_ids || []).includes(user.id)
    if (involved) {
      for (const id of [...(w.team_player_ids || []), ...(w.watcher_ids || [])]) {
        if (id !== user.id) activeCompetitorIds.add(id)
      }
    }
  }

  // Active incoming challenge pokes for current user
  const { data: activeChallenges } = await supabase
    .from('pokes')
    .select('*, from_profile:profiles!pokes_from_user_id_fkey(display_name)')
    .eq('to_user_id', user.id)
    .eq('type', 'challenge')
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })

  // Other users for poke buttons (everyone except current user)
  const otherUsers = (allProfiles || []).filter(p => p.id !== user.id).map(p => ({
    id: p.id,
    display_name: p.display_name,
    username: p.username,
  }))

  // Recent activity feed
  const { data: recentWorkouts } = await supabase
    .from('workouts')
    .select('*, profiles(display_name, username), workout_reactions(*), workout_comments(id)')
    .order('logged_at', { ascending: false })
    .limit(10)

  return (
    <div className="min-h-screen bg-gray-950 pb-24">
      {/* Resolution celebration/loss alert — checks localStorage, shows once */}
      <ResolutionAlert currentUserId={user.id} />

      {/* Header */}
      <div className="bg-gray-900 px-4 pt-12 pb-5 border-b border-gray-800">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm">Hey, {profile.display_name.split(' ')[0]} 👋</p>
            <h1 className="text-2xl font-bold text-white">Your Competitions</h1>
          </div>
          <Link
            href="/log-workout"
            className="bg-green-500 hover:bg-green-400 text-black font-bold px-4 py-2 rounded-xl text-sm transition-colors"
          >
            + Log Workout
          </Link>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-5">
        {/* Debt alert */}
        {outstandingDebts.length > 0 && (
          <Link href="/wagers">
            <div className="bg-red-900/25 border border-red-700/50 rounded-2xl p-4 flex items-center gap-3">
              <span className="text-2xl">💸</span>
              <div className="flex-1">
                <p className="text-red-300 font-semibold text-sm">
                  {outstandingDebts.length === 1 ? '1 unsettled debt' : `${outstandingDebts.length} unsettled debts`}
                </p>
                <p className="text-red-700 text-xs mt-0.5">
                  {outstandingDebts.slice(0, 2).map((d: any) => {
                    const otherIds = d.iAmDebtor ? d.creditor_ids : d.debtor_ids
                    const otherName = otherIds.map((id: string) => profileMap[id]?.display_name?.split(' ')[0] || '?').join(' & ')
                    return d.iAmDebtor ? `You owe ${otherName} · ` : `${otherName} owes you · `
                  }).join('')}Tap to settle →
                </p>
              </div>
            </div>
          </Link>
        )}

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

        {/* Live competitions — hero section */}
        <LiveChallenges challenges={challenges} currentUserId={user.id} />

        {/* Poke section */}
        <PokeSection
          currentUserId={user.id}
          otherUsers={otherUsers}
          initialActiveChallenges={(activeChallenges as any) || []}
        />

        {/* Activity Feed */}
        <div>
          <h2 className="text-white font-semibold mb-3">Activity Feed</h2>
          {recentWorkouts && recentWorkouts.length > 0 ? (
            <ActivityFeedClient
              initialWorkouts={recentWorkouts as any}
              currentUserId={user.id}
              activeCompetitorIds={[...activeCompetitorIds]}
              allUserIds={(allProfiles || []).map(p => p.id)}
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
