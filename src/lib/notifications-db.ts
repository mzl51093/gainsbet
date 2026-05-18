import { createClient } from '@supabase/supabase-js'

interface NotifData {
  type: string
  title: string
  body: string
  url?: string
}

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function saveNotification(userId: string, data: NotifData) {
  await admin().from('notifications').insert({ user_id: userId, type: data.type, title: data.title, body: data.body, url: data.url || '/dashboard' }).catch(() => null)
}

export async function saveNotifications(userIds: string[], data: NotifData) {
  if (!userIds.length) return
  await admin().from('notifications').insert(userIds.map(user_id => ({ user_id, type: data.type, title: data.title, body: data.body, url: data.url || '/dashboard' }))).catch(() => null)
}
