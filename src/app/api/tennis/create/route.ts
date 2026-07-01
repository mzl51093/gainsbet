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

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, description, participantIds, wager, startDate, endDate } = await req.json()

  if (!name?.trim() || !participantIds?.length || !startDate) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const allIds: string[] = [...new Set([user.id, ...participantIds])]

  const admin = adminClient()

  const { data: challenge, error } = await admin
    .from('tennis_challenges')
    .insert({
      name: name.trim(),
      description: description?.trim() || null,
      created_by: user.id,
      participant_ids: allIds,
      wager: wager?.trim() || null,
      start_date: startDate,
      end_date: endDate || null,
    })
    .select()
    .single()

  if (error || !challenge) {
    return NextResponse.json({ error: error?.message || 'Failed to create challenge' }, { status: 500 })
  }

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, display_name')
    .in('id', allIds)

  const profileMap: Record<string, string> = {}
  for (const p of profiles || []) profileMap[p.id] = p.display_name
  const creatorName = profileMap[user.id]?.split(' ')[0] || 'Someone'

  await Promise.all(
    allIds.filter(id => id !== user.id).map(async id => {
      const notif = {
        type: 'tennis_invited',
        title: `🎾 ${creatorName} invited you to "${name}"`,
        body: wager ? `Stakes: ${wager}` : 'Game on — let\'s see who\'s got court.',
        url: `/tennis/${challenge.id}`,
      }
      await Promise.all([
        sendPushToUser(id, notif).catch(() => null),
        saveNotification(id, notif),
      ])
    })
  )

  return NextResponse.json({ id: challenge.id })
}
