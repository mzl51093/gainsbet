import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import DiscoverClient from './DiscoverClient'

export const revalidate = 0

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export default async function DiscoverPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const admin = adminClient()

  // All profiles for name lookups
  const { data: allProfiles } = await admin.from('profiles').select('id, display_name, username')
  const profileMap: Record<string, { id: string; display_name: string; username: string }> = {}
  for (const p of allProfiles || []) profileMap[p.id] = p

  // All active wagers
  const { data: allWagers } = await admin
    .from('wagers')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  // All non-completed draft competitions
  const { data: allDraftComps } = await admin
    .from('draft_competitions')
    .select('*, draft_participants(user_id)')
    .neq('status', 'completed')
    .order('created_at', { ascending: false })

  // Current user's follows
  const [{ data: wagerFollows }, { data: draftFollows }] = await Promise.all([
    supabase.from('wager_followers').select('wager_id').eq('user_id', user.id),
    supabase.from('draft_followers').select('competition_id').eq('user_id', user.id),
  ])

  const followedWagerIds = new Set((wagerFollows || []).map(f => f.wager_id))
  const followedDraftIds = new Set((draftFollows || []).map(f => f.competition_id))

  // Build wager cards — skip ones user is already a participant in
  const wagerCards = (allWagers || []).map((w: any) => {
    const playerIds: string[] = w.team_player_ids || []
    const watcherIds: string[] = w.watcher_ids || []
    const isParticipant = playerIds.includes(user.id) || watcherIds.includes(user.id)
    return {
      id: w.id,
      title: w.title,
      endDate: w.end_date,
      pointThreshold: w.point_threshold,
      stakeIfWorkers: w.stake_if_competitors_win,
      stakeIfMotivators: w.stake_if_partners_win,
      players: playerIds.map(id => profileMap[id]?.display_name || '?').filter(Boolean),
      watchers: watcherIds.map(id => profileMap[id]?.display_name || '?').filter(Boolean),
      isParticipant,
      isFollowing: followedWagerIds.has(w.id),
    }
  })

  // Build draft cards
  const draftCards = (allDraftComps || []).map((c: any) => {
    const participantIds: string[] = (c.draft_participants || []).map((p: any) => p.user_id)
    const isParticipant = participantIds.includes(user.id)
    const captainA = profileMap[c.captain_a_id]?.display_name
    const captainB = profileMap[c.captain_b_id]?.display_name
    return {
      id: c.id,
      name: c.name,
      status: c.status as string,
      pointGoal: c.point_goal,
      wagerDescription: c.wager_description,
      participantCount: participantIds.length,
      maxParticipants: c.max_participants,
      participants: participantIds.slice(0, 6).map(id => profileMap[id]?.display_name || '?').filter(Boolean),
      captainA: captainA || null,
      captainB: captainB || null,
      isParticipant,
      isFollowing: followedDraftIds.has(c.id),
    }
  })

  return (
    <div className="min-h-screen bg-gray-950 pb-24">
      <div className="bg-gray-900 px-4 pt-12 pb-5 border-b border-gray-800">
        <div className="max-w-lg mx-auto">
          <h1 className="text-2xl font-bold text-white">Explore</h1>
          <p className="text-gray-400 text-sm mt-0.5">Follow challenges to get updates in your feed</p>
        </div>
      </div>
      <div className="max-w-lg mx-auto px-4 pt-5">
        <DiscoverClient wagerCards={wagerCards} draftCards={draftCards} />
      </div>
      <BottomNav />
    </div>
  )
}
