import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendPushToAll } from '@/lib/push'
import { saveNotifications } from '@/lib/notifications-db'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: allProfiles } = await admin.from('profiles').select('id')
  const everyone = (allProfiles || []).map(p => p.id)

  const notif = {
    type: 'announcement',
    title: '🆕 New features dropped!',
    body: 'Poke challenges, notifications inbox & more. Check the dashboard!',
    url: '/dashboard',
  }

  await Promise.all([
    sendPushToAll(everyone, notif),
    saveNotifications(everyone, notif),
  ])

  return NextResponse.json({ success: true, sent: everyone.length })
}
