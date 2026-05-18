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

  const body = await req.json()
  const { toUserId, type, exercise, reps, points = 1 } = body

  if (!toUserId || !type) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (toUserId === user.id) {
    return NextResponse.json({ error: 'Cannot poke yourself' }, { status: 400 })
  }

  if (type !== 'fun' && type !== 'challenge') {
    return NextResponse.json({ error: 'Invalid poke type' }, { status: 400 })
  }

  // Validate target user exists and get their role
  const { data: targetProfile } = await supabase
    .from('profiles')
    .select('id, display_name, role')
    .eq('id', toUserId)
    .single()

  if (!targetProfile) {
    return NextResponse.json({ error: 'Target user not found' }, { status: 404 })
  }

  // Get sender's display name
  const { data: senderProfile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single()

  const senderName = senderProfile?.display_name?.split(' ')[0] || 'Someone'

  const admin = adminClient()

  // Build poke record
  const pokeData: Record<string, unknown> = {
    from_user_id: user.id,
    to_user_id: toUserId,
    type,
    points,
    status: 'pending',
  }

  if (type === 'challenge') {
    pokeData.exercise = exercise
    pokeData.reps = reps
    pokeData.expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString()
  }

  const { data: poke, error } = await admin
    .from('pokes')
    .insert(pokeData)
    .select()
    .single()

  if (error || !poke) {
    console.error('Failed to insert poke:', error)
    return NextResponse.json({ error: 'Failed to create poke' }, { status: 500 })
  }

  // Send notification
  if (type === 'fun') {
    const notif = {
      type: 'poke_fun',
      title: `${senderName} poked you 👆`,
      body: 'Poke back if you dare.',
      url: '/notifications',
    }
    await Promise.all([
      sendPushToUser(toUserId, notif),
      saveNotification(toUserId, notif),
    ])
  } else {
    const ptLabel = (points ?? 1) > 1 ? 's' : ''
    const isPartner = targetProfile.role === 'partner'
    const challengeBody = isPartner
      ? `${reps} ${exercise} in 10 mins — complete it and ${senderName} loses ${points} pt${ptLabel} from their score! 😈`
      : `${reps} ${exercise} in 10 mins for ${points} pt${ptLabel}. Video required!`
    const notif = {
      type: 'poke_challenge',
      title: `${senderName} challenged you! ⏱️`,
      body: challengeBody,
      url: '/dashboard',
    }
    await Promise.all([
      sendPushToUser(toUserId, notif),
      saveNotification(toUserId, notif),
    ])
  }

  return NextResponse.json({ success: true, pokeId: poke.id })
}
