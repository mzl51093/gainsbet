import webpush from 'web-push'
import { createClient } from '@/lib/supabase/server'

function initWebPush() {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return false
  webpush.setVapidDetails('mailto:marc.lipnicki@gmail.com', pub, priv)
  return true
}

export interface PushPayload {
  title: string
  body: string
  url?: string
  icon?: string
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!initWebPush()) return
  const supabase = await createClient()
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('subscription')
    .eq('user_id', userId)

  if (!subs || subs.length === 0) return

  const sends = subs.map((row) =>
    webpush
      .sendNotification(row.subscription, JSON.stringify(payload))
      .catch(() => null)
  )
  await Promise.all(sends)
}

export async function sendPushToAll(userIds: string[], payload: PushPayload) {
  await Promise.all(userIds.map((id) => sendPushToUser(id, payload)))
}
