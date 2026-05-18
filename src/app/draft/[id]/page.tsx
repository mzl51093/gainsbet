import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import DraftCompetitionClient from './DraftCompetitionClient'
import BottomNav from '@/components/BottomNav'

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
      .select('*, profiles(display_name, username)')
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
      .select('*, profiles(display_name, username)')
      .eq('draft_competition_id', id)
      .eq('validation_status', 'pending')
      .order('logged_at', { ascending: false })
    pendingWorkouts = pw || []
  }

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
      />
      <BottomNav />
    </div>
  )
}
