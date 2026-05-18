import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import DraftCompetitionClient from './DraftCompetitionClient'

export const revalidate = 0

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export default async function DraftCompetitionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const admin = adminClient()

  const { data: comp, error: compError } = await admin
    .from('draft_competitions')
    .select('*')
    .eq('id', id)
    .single()

  if (compError || !comp) {
    redirect('/draft')
  }

  const { data: participants } = await admin
    .from('draft_participants')
    .select('*, profiles(*)')
    .eq('competition_id', id)

  const { data: votes } = await admin
    .from('draft_captain_votes')
    .select('voted_for_id, voter_id')
    .eq('competition_id', id)

  const voteCounts: Record<string, number> = {}
  const voterIds: string[] = []
  for (const v of votes || []) {
    voteCounts[v.voted_for_id] = (voteCounts[v.voted_for_id] || 0) + 1
    voterIds.push(v.voter_id)
  }

  let workouts: any[] = []
  if (comp.status === 'active' || comp.status === 'completed') {
    const query = admin
      .from('workouts')
      .select('*, profiles!workouts_user_id_fkey(display_name, username)')
      .eq('draft_competition_id', id)
      .order('logged_at', { ascending: false })

    if (comp.start_date) {
      query.gte('logged_at', comp.start_date)
    }

    const { data: ws } = await query
    workouts = ws || []
  }

  // For pending validation — fetch workouts needing validation in active competition
  let pendingWorkouts: any[] = []
  if (comp.status === 'active') {
    const { data: pw } = await admin
      .from('workouts')
      .select('*, profiles!workouts_user_id_fkey(display_name, username)')
      .eq('draft_competition_id', id)
      .eq('validation_status', 'pending')
      .order('logged_at', { ascending: false })
    pendingWorkouts = pw || []
  }

  // Chat: determine user's team, then fetch initial messages for each channel
  const userParticipant = (participants || []).find(p => p.user_id === user.id)
  const myTeam = (userParticipant?.team as 'a' | 'b' | null) ?? null
  const teamChannel = myTeam ? `team_${myTeam}` : null

  const [{ data: groupMessages }, { data: teamMessages }, { data: allProfiles }, { data: existingInvites }] = await Promise.all([
    admin
      .from('draft_messages')
      .select('*, profiles!draft_messages_user_id_fkey(display_name, username)')
      .eq('competition_id', id)
      .eq('channel', 'group')
      .order('created_at', { ascending: true })
      .limit(50),
    teamChannel
      ? admin
          .from('draft_messages')
          .select('*, profiles!draft_messages_user_id_fkey(display_name, username)')
          .eq('competition_id', id)
          .eq('channel', teamChannel)
          .order('created_at', { ascending: true })
          .limit(50)
      : Promise.resolve({ data: [] as any[] }),
    // All profiles for invite search (exclude current user)
    admin
      .from('profiles')
      .select('id, display_name, username')
      .neq('id', user.id)
      .order('display_name'),
    // Already-invited user IDs for this competition
    admin
      .from('draft_invites')
      .select('invited_user_id')
      .eq('competition_id', id),
  ])

  return (
    <div className="min-h-screen bg-gray-950 pb-24">
      <DraftCompetitionClient
        competition={comp}
        participants={participants || []}
        voteCounts={voteCounts}
        voterIds={voterIds}
        workouts={workouts}
        pendingWorkouts={pendingWorkouts}
        currentUserId={user.id}
        competitionId={id}
        myTeam={myTeam}
        initialGroupMessages={groupMessages || []}
        initialTeamMessages={teamMessages || []}
        allProfiles={allProfiles || []}
        invitedIds={(existingInvites || []).map(r => r.invited_user_id)}
      />
    </div>
  )
}
