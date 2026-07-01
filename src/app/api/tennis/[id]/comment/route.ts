import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { sendPushToUser } from '@/lib/push'
import { saveNotification } from '@/lib/notifications-db'

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

  const { body } = await req.json()
  if (!body?.trim()) return NextResponse.json({ error: 'Empty comment' }, { status: 400 })

  const admin = adminClient()

  const { data: challenge } = await admin
    .from('tennis_challenges')
    .select('participant_ids, name')
    .eq('id', id)
    .single()

  if (!challenge) return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })

  const { data: comment, error } = await admin
    .from('tennis_comments')
    .insert({ challenge_id: id, user_id: user.id, body: body.trim() })
    .select()
    .single()

  if (error || !comment) return NextResponse.json({ error: 'Failed to post' }, { status: 500 })

  const { data: profile } = await admin
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single()

  const name = profile?.display_name?.split(' ')[0] || 'Someone'
  const others = (challenge.participant_ids as string[]).filter(pid => pid !== user.id)

  await Promise.all(others.map(async pid => {
    const notif = {
      type: 'tennis_comment',
      title: `💬 ${name} in "${challenge.name}"`,
      body: body.trim().slice(0, 100),
      url: `/tennis/${id}`,
    }
    await Promise.all([
      sendPushToUser(pid, notif).catch(() => null),
      saveNotification(pid, notif),
    ])
  }))

  return NextResponse.json({ id: comment.id })
}
