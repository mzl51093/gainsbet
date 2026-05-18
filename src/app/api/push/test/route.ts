import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendPushToUser } from '@/lib/push'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint')
    .eq('user_id', user.id)

  if (!subs || subs.length === 0) {
    return NextResponse.json({ error: 'No subscription found for your account. Enable notifications first.' }, { status: 400 })
  }

  try {
    await sendPushToUser(user.id, {
      title: 'Test notification',
      body: 'If you see this, notifications are working!',
      url: '/profile',
    })
    return NextResponse.json({ success: true, subscriptions: subs.length })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Push send failed' }, { status: 500 })
  }
}
