import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'not logged in' }, { status: 401 })

  // Active wagers
  const { data: activeWagers, error: wagersError } = await supabase
    .from('wagers')
    .select('id, title, status, proposed_by, team_player_ids, watcher_ids')
    .eq('status', 'active')

  const userInTeamPlayerIds = (activeWagers || []).some((w: any) => (w.team_player_ids || []).includes(user.id))
  const userInWatcherIds = (activeWagers || []).some((w: any) => (w.watcher_ids || []).includes(user.id))
  const userIsProposedBy = (activeWagers || []).some((w: any) => w.proposed_by === user.id)

  // Build feedUserIds same way as dashboard
  const activeCompetitorIds = new Set<string>()
  for (const w of (activeWagers || [])) {
    const involved = (w.team_player_ids || []).includes(user.id) || (w.watcher_ids || []).includes(user.id)
    if (involved) {
      for (const id of [...(w.team_player_ids || []), ...(w.watcher_ids || [])]) {
        if (id !== user.id) activeCompetitorIds.add(id)
      }
    }
  }

  const feedUserIds = new Set<string>([user.id])
  for (const id of activeCompetitorIds) feedUserIds.add(id)
  for (const w of (activeWagers || [])) {
    if (w.proposed_by === user.id) {
      for (const id of [...(w.team_player_ids || []), ...(w.watcher_ids || [])]) {
        feedUserIds.add(id)
      }
    }
  }

  const feedUserIdsArray = [...feedUserIds]

  // Simple query (no joins)
  const { data: simpleWorkouts, error: simpleError } = await supabase
    .from('workouts')
    .select('id, user_id, workout_type, logged_at, points')
    .in('user_id', feedUserIdsArray)
    .order('logged_at', { ascending: false })
    .limit(5)

  // Complex query (with joins)
  const { data: joinedWorkouts, error: joinedError } = await supabase
    .from('workouts')
    .select('id, user_id, profiles(display_name, username), workout_reactions(*), workout_comments(id)')
    .in('user_id', feedUserIdsArray)
    .order('logged_at', { ascending: false })
    .limit(5)

  // All workouts (no filter) - just count
  const { count: totalWorkoutsCount, error: countError } = await supabase
    .from('workouts')
    .select('*', { count: 'exact', head: true })

  // User's own workouts (no filter, direct)
  const { data: ownWorkouts, error: ownError } = await supabase
    .from('workouts')
    .select('id, user_id, workout_type, logged_at, points')
    .eq('user_id', user.id)
    .order('logged_at', { ascending: false })
    .limit(5)

  return NextResponse.json({
    userId: user.id,
    activeWagersCount: (activeWagers || []).length,
    activeWagers: (activeWagers || []).map((w: any) => ({
      id: w.id,
      title: w.title,
      proposed_by: w.proposed_by,
      team_player_ids: w.team_player_ids,
      watcher_ids: w.watcher_ids,
      userInTeam: (w.team_player_ids || []).includes(user.id),
      userIsWatcher: (w.watcher_ids || []).includes(user.id),
      userIsProposer: w.proposed_by === user.id,
    })),
    userInTeamPlayerIds,
    userInWatcherIds,
    userIsProposedBy,
    feedUserIds: feedUserIdsArray,
    feedUserIdsCount: feedUserIdsArray.length,
    wagersError,
    simpleWorkoutsCount: (simpleWorkouts || []).length,
    simpleWorkouts: simpleWorkouts || [],
    simpleError,
    joinedWorkoutsCount: (joinedWorkouts || []).length,
    joinedError,
    totalWorkoutsCount,
    countError,
    ownWorkoutsCount: (ownWorkouts || []).length,
    ownWorkouts: ownWorkouts || [],
    ownError,
  })
}
