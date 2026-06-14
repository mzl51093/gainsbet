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

  const admin = adminClient()

  const { data: duel } = await admin
    .from('duel_challenges')
    .select('*')
    .eq('id', id)
    .single()

  if (!duel) return NextResponse.json({ error: 'Duel not found' }, { status: 404 })
  if (duel.status !== 'active') return NextResponse.json({ error: 'Duel is not active' }, { status: 400 })

  const isCompetitorA = user.id === duel.competitor_a_id
  const isCompetitorB = user.id === duel.competitor_b_id
  const isWatcher = (duel.watcher_ids || []).includes(user.id)

  if (!isCompetitorA && !isCompetitorB && !isWatcher && user.id !== duel.created_by) {
    return NextResponse.json({ error: 'Not a participant' }, { status: 403 })
  }

  const formData = await req.formData()
  const weightStr = formData.get('weight') as string
  const targetUserId = formData.get('targetUserId') as string
  const isStartingWeight = formData.get('isStartingWeight') === 'true'
  const notes = formData.get('notes') as string | null
  const photoFile = formData.get('photo') as File | null

  const weight = parseFloat(weightStr)
  if (!weight || weight <= 0 || weight > 999) {
    return NextResponse.json({ error: 'Invalid weight' }, { status: 400 })
  }

  const competitorId = targetUserId || user.id
  if (competitorId !== duel.competitor_a_id && competitorId !== duel.competitor_b_id) {
    return NextResponse.json({ error: 'Invalid competitor' }, { status: 400 })
  }

  let photoUrl: string | null = null
  if (photoFile) {
    const ext = photoFile.name.split('.').pop() || 'jpg'
    const path = `${user.id}/${id}/${Date.now()}.${ext}`
    const arrayBuffer = await photoFile.arrayBuffer()
    const { error: uploadError } = await admin.storage
      .from('duel-proofs')
      .upload(path, arrayBuffer, { contentType: photoFile.type })
    if (!uploadError) photoUrl = path
  }

  const { data: weighIn, error: weighInError } = await admin
    .from('duel_weigh_ins')
    .insert({
      duel_id: id,
      user_id: competitorId,
      weight,
      photo_url: photoUrl,
      submitted_by: user.id,
      is_starting_weight: isStartingWeight,
      verified: true,
      notes: notes?.trim() || null,
    })
    .select()
    .single()

  if (weighInError || !weighIn) {
    return NextResponse.json({ error: 'Failed to save weigh-in' }, { status: 500 })
  }

  // Update starting/lowest weights on the duel
  const isA = competitorId === duel.competitor_a_id
  const updates: Record<string, number> = {}

  if (isStartingWeight) {
    updates[isA ? 'starting_weight_a' : 'starting_weight_b'] = weight
    // Only set lowest if it's not already set or this is lower
    const currentLowest = isA ? duel.lowest_weight_a : duel.lowest_weight_b
    if (!currentLowest || weight < currentLowest) {
      updates[isA ? 'lowest_weight_a' : 'lowest_weight_b'] = weight
    }
  } else {
    const currentLowest = isA ? duel.lowest_weight_a : duel.lowest_weight_b
    if (!currentLowest || weight < currentLowest) {
      updates[isA ? 'lowest_weight_a' : 'lowest_weight_b'] = weight
    }
  }

  if (Object.keys(updates).length > 0) {
    await admin.from('duel_challenges').update(updates).eq('id', id)
  }

  // Notify the other competitor + watchers
  const { data: competitorProfile } = await admin
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single()

  const submitName = competitorProfile?.display_name?.split(' ')[0] || 'Someone'
  const allParticipants = [duel.competitor_a_id, duel.competitor_b_id, ...(duel.watcher_ids || [])]

  await Promise.all(allParticipants
    .filter((pid: string) => pid !== user.id)
    .map(async (pid: string) => {
      const notif = {
        type: 'duel_weigh_in',
        title: `⚖️ ${submitName} logged a weigh-in`,
        body: `${weight} lbs${isStartingWeight ? ' (starting weight)' : ''}. Check the duel.`,
        url: `/duel/${id}`,
      }
      await Promise.all([
        sendPushToUser(pid, notif).catch(() => null),
        saveNotification(pid, notif),
      ])
    })
  )

  return NextResponse.json({ id: weighIn.id })
}
