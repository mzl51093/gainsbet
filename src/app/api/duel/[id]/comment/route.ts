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

  const { body: commentBody } = await req.json()
  if (!commentBody?.trim()) {
    return NextResponse.json({ error: 'Comment cannot be empty' }, { status: 400 })
  }

  const admin = adminClient()

  const { data: duel } = await admin
    .from('duel_challenges')
    .select('competitor_a_id, competitor_b_id, watcher_ids, name, created_by')
    .eq('id', id)
    .single()

  if (!duel) return NextResponse.json({ error: 'Duel not found' }, { status: 404 })

  const { data: comment, error } = await admin
    .from('duel_comments')
    .insert({ duel_id: id, user_id: user.id, body: commentBody.trim() })
    .select()
    .single()

  if (error || !comment) {
    return NextResponse.json({ error: 'Failed to post comment' }, { status: 500 })
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single()

  const commenterName = profile?.display_name?.split(' ')[0] || 'Someone'
  const allParticipants = [duel.competitor_a_id, duel.competitor_b_id, ...(duel.watcher_ids || [])]

  await Promise.all(allParticipants
    .filter((pid: string) => pid !== user.id)
    .map(async (pid: string) => {
      const notif = {
        type: 'duel_comment',
        title: `💬 ${commenterName} in "${duel.name}"`,
        body: commentBody.trim().slice(0, 100),
        url: `/duel/${id}`,
      }
      await Promise.all([
        sendPushToUser(pid, notif).catch(() => null),
        saveNotification(pid, notif),
      ])
    })
  )

  return NextResponse.json({ id: comment.id })
}
