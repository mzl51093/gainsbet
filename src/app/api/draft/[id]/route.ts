import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = adminClient()

  const { data: comp, error: compError } = await admin
    .from('draft_competitions')
    .select('*')
    .eq('id', id)
    .single()

  if (compError || !comp) {
    return NextResponse.json({ error: 'Competition not found' }, { status: 404 })
  }

  const { data: participants } = await admin
    .from('draft_participants')
    .select('*, profiles(*)')
    .eq('competition_id', id)

  const { data: votes } = await admin
    .from('draft_captain_votes')
    .select('voted_for_id, voter_id')
    .eq('competition_id', id)

  // Vote counts per candidate
  const voteCounts: Record<string, number> = {}
  const voterIds: string[] = []
  for (const v of (votes || [])) {
    voteCounts[v.voted_for_id] = (voteCounts[v.voted_for_id] || 0) + 1
    voterIds.push(v.voter_id)
  }

  let workouts = null
  if (comp.status === 'active' && comp.start_date) {
    const { data: ws } = await admin
      .from('workouts')
      .select('*, profiles(display_name, username)')
      .eq('draft_competition_id', id)
      .gte('logged_at', comp.start_date)
      .order('logged_at', { ascending: false })
    workouts = ws
  }

  return NextResponse.json({
    competition: comp,
    participants: participants || [],
    voteCounts,
    voterIds,
    workouts: workouts || [],
  })
}
