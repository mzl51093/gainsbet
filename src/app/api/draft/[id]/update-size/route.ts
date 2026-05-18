import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { sendPushToAll } from '@/lib/push'
import { saveNotifications } from '@/lib/notifications-db'

function admin() {
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

  const { maxParticipants } = await req.json()
  const newMax = parseInt(maxParticipants)
  if (!newMax || newMax < 2) {
    return NextResponse.json({ error: 'Minimum 2 players required' }, { status: 400 })
  }

  const db = admin()

  const { data: comp } = await db
    .from('draft_competitions')
    .select('*')
    .eq('id', id)
    .single()

  if (!comp) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (comp.status !== 'recruiting') return NextResponse.json({ error: 'Can only edit size during recruiting' }, { status: 400 })
  if (comp.created_by !== user.id) return NextResponse.json({ error: 'Only the organizer can change this' }, { status: 403 })

  const { data: participants } = await db
    .from('draft_participants')
    .select('user_id')
    .eq('competition_id', id)

  const currentCount = participants?.length || 0

  if (newMax < currentCount) {
    return NextResponse.json({
      error: `Can't go below ${currentCount} — that's how many people already joined`,
    }, { status: 400 })
  }

  // Update the max
  await db
    .from('draft_competitions')
    .update({ max_participants: newMax })
    .eq('id', id)

  // If lobby is now full, advance to voting
  if (currentCount >= newMax) {
    await db
      .from('draft_competitions')
      .update({ status: 'voting' })
      .eq('id', id)

    const allUserIds = (participants || []).map(p => p.user_id)
    const notif = {
      type: 'draft_voting_start',
      title: 'Lobby locked! Time to vote for captains.',
      body: `Cast your vote in "${comp.name}".`,
      url: `/draft/${id}`,
    }
    await Promise.allSettled([
      sendPushToAll(allUserIds, notif),
      saveNotifications(allUserIds, notif),
    ])

    return NextResponse.json({ updated: true, advancedToVoting: true })
  }

  return NextResponse.json({ updated: true, advancedToVoting: false })
}
