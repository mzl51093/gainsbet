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

  if (comp.status !== 'recruiting') {
    return NextResponse.json({ error: 'Competition is not recruiting' }, { status: 400 })
  }

  const { data: existingParticipants } = await admin
    .from('draft_participants')
    .select('user_id')
    .eq('competition_id', id)

  const participantCount = existingParticipants?.length || 0

  if (participantCount >= comp.max_participants) {
    return NextResponse.json({ error: 'Competition is full' }, { status: 400 })
  }

  const alreadyJoined = existingParticipants?.some(p => p.user_id === user.id)
  if (alreadyJoined) {
    return NextResponse.json({ success: true, alreadyJoined: true })
  }

  const { error: joinError } = await admin
    .from('draft_participants')
    .insert({ competition_id: id, user_id: user.id })

  if (joinError) {
    console.error('Failed to join competition:', joinError)
    return NextResponse.json({ error: 'Failed to join competition' }, { status: 500 })
  }

  const newCount = participantCount + 1

  if (newCount >= comp.max_participants) {
    await admin
      .from('draft_competitions')
      .update({ status: 'voting' })
      .eq('id', id)

    const allUserIds = [...(existingParticipants?.map(p => p.user_id) || []), user.id]
    const notif = {
      type: 'draft_voting_start',
      title: 'All players joined! Time to vote for captains.',
      body: `Cast your vote in "${comp.name}".`,
      url: `/draft/${id}`,
    }
    await Promise.all([
      sendPushToAll(allUserIds, notif),
      saveNotifications(allUserIds, notif),
    ])
  }

  return NextResponse.json({ success: true })
}
