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
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { startDate, endDate, pointGoal, wagerDescription } = body

  if (!startDate || !pointGoal) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
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

  if (user.id !== comp.captain_a_id && user.id !== comp.captain_b_id) {
    return NextResponse.json({ error: 'Only captains can configure the competition' }, { status: 403 })
  }

  await admin
    .from('draft_competitions')
    .update({
      start_date: startDate,
      end_date: endDate || null,
      point_goal: pointGoal,
      wager_description: wagerDescription || null,
      status: comp.status === 'configuring' ? 'active' : comp.status,
    })
    .eq('id', id)

  const { data: participants } = await admin
    .from('draft_participants')
    .select('user_id')
    .eq('competition_id', id)

  const participantIds = participants?.map((p) => p.user_id) || []

  const notif = {
    type: 'draft_competition_live',
    title: `Competition is LIVE! Race to ${pointGoal} pts!`,
    body: `"${comp.name}" has started. Give it everything you've got!`,
    url: `/draft/${id}`,
  }

  await Promise.all([
    sendPushToAll(participantIds, notif),
    saveNotifications(participantIds, notif),
  ])

  return NextResponse.json({ success: true })
}
