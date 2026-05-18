import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { saveNotification } from '@/lib/notifications-db'
import { sendPushToUser } from '@/lib/push'

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

  const { userId } = await req.json()
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  const db = admin()

  // Must be a participant to invite
  const { data: myPart } = await db
    .from('draft_participants')
    .select('id')
    .eq('competition_id', id)
    .eq('user_id', user.id)
    .single()
  if (!myPart) return NextResponse.json({ error: 'Not a participant' }, { status: 403 })

  const { data: comp } = await db
    .from('draft_competitions')
    .select('id, name')
    .eq('id', id)
    .single()
  if (!comp) return NextResponse.json({ error: 'Competition not found' }, { status: 404 })

  // Already joined?
  const { data: alreadyIn } = await db
    .from('draft_participants')
    .select('id')
    .eq('competition_id', id)
    .eq('user_id', userId)
    .single()
  if (alreadyIn) return NextResponse.json({ error: 'Already a participant' }, { status: 409 })

  // Upsert invite — ignore if already exists
  const { error: inviteErr } = await db
    .from('draft_invites')
    .upsert(
      { competition_id: id, invited_user_id: userId, invited_by_id: user.id },
      { onConflict: 'competition_id,invited_user_id', ignoreDuplicates: true }
    )
  if (inviteErr) return NextResponse.json({ error: 'Failed to save invite' }, { status: 500 })

  const { data: me } = await db
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single()
  const name = me?.display_name?.split(' ')[0] || 'Someone'

  const notif = {
    type: 'draft_invite',
    title: `${name} invited you to a draft 🏆`,
    body: `Join "${comp.name}" before spots fill up!`,
    url: `/draft/${id}`,
  }

  await Promise.allSettled([
    saveNotification(userId, notif),
    sendPushToUser(userId, notif),
  ])

  return NextResponse.json({ invited: true })
}
