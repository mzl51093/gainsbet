import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { sendPushToAll } from '@/lib/push'
import { saveNotifications } from '@/lib/notifications-db'

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { votedForId } = body

  if (!votedForId) {
    return NextResponse.json({ error: 'Missing votedForId' }, { status: 400 })
  }

  const admin = adminClient()

  const { data: comp, error: compError } = await admin
    .from('draft_competitions')
    .select('*')
    .eq('id', id)
    .single()

  if (compError || !comp) {
    return NextResponse.json({ error: 'Competition not found' }, { status: 404 })
  }

  if (comp.status !== 'voting') {
    return NextResponse.json({ error: 'Competition is not in voting phase' }, { status: 400 })
  }

  const { data: participants } = await admin
    .from('draft_participants')
    .select('user_id')
    .eq('competition_id', id)

  const participantIds = participants?.map(p => p.user_id) || []

  if (!participantIds.includes(user.id)) {
    return NextResponse.json({ error: 'You are not a participant' }, { status: 403 })
  }

  if (user.id === votedForId) {
    return NextResponse.json({ error: 'You cannot vote for yourself' }, { status: 400 })
  }

  const { data: existingVote } = await admin
    .from('draft_captain_votes')
    .select('id')
    .eq('competition_id', id)
    .eq('voter_id', user.id)
    .single()

  if (existingVote) {
    return NextResponse.json({ error: 'You have already voted' }, { status: 400 })
  }

  const { error: voteError } = await admin
    .from('draft_captain_votes')
    .insert({ competition_id: id, voter_id: user.id, voted_for_id: votedForId })

  if (voteError) {
    console.error('Failed to insert vote:', voteError)
    return NextResponse.json({ error: 'Failed to cast vote' }, { status: 500 })
  }

  // Check if all participants have voted
  const { data: allVotes } = await admin
    .from('draft_captain_votes')
    .select('voted_for_id')
    .eq('competition_id', id)

  if ((allVotes?.length || 0) >= participantIds.length) {
    // Tally votes
    const voteCounts: Record<string, number> = {}
    for (const v of (allVotes || [])) {
      voteCounts[v.voted_for_id] = (voteCounts[v.voted_for_id] || 0) + 1
    }

    // Sort by votes descending, break ties randomly
    const sorted = Object.entries(voteCounts)
      .sort(([, a], [, b]) => {
        if (b !== a) return b - a
        return Math.random() < 0.5 ? -1 : 1
      })

    // If fewer than 2 unique voters, pick from participants
    const captainAId = sorted[0]?.[0] || participantIds[0]
    const captainBId = sorted[1]?.[0] || participantIds[1]

    await admin
      .from('draft_competitions')
      .update({
        captain_a_id: captainAId,
        captain_b_id: captainBId,
        status: 'drafting',
        pick_number: 0,
      })
      .eq('id', id)

    // Assign captains to their teams
    await Promise.all([
      admin
        .from('draft_participants')
        .update({ team: 'a' })
        .eq('competition_id', id)
        .eq('user_id', captainAId),
      admin
        .from('draft_participants')
        .update({ team: 'b' })
        .eq('competition_id', id)
        .eq('user_id', captainBId),
    ])

    const notif = {
      type: 'draft_captains_selected',
      title: 'Captains selected! Draft begins now.',
      body: `The snake draft is starting in "${comp.name}".`,
      url: `/draft/${id}`,
    }
    await Promise.all([
      sendPushToAll(participantIds, notif),
      saveNotifications(participantIds, notif),
    ])
  }

  return NextResponse.json({ success: true })
}
