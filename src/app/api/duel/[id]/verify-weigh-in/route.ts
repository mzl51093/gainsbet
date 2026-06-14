import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

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

  const { weighInId, verified } = await req.json()
  if (!weighInId || typeof verified !== 'boolean') {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const admin = adminClient()

  const { data: duel } = await admin
    .from('duel_challenges')
    .select('competitor_a_id, competitor_b_id, watcher_ids, lowest_weight_a, lowest_weight_b')
    .eq('id', id)
    .single()

  if (!duel) return NextResponse.json({ error: 'Duel not found' }, { status: 404 })

  const isWatcher = (duel.watcher_ids || []).includes(user.id)
  const isParticipant = user.id === duel.competitor_a_id || user.id === duel.competitor_b_id
  if (!isWatcher && !isParticipant) {
    return NextResponse.json({ error: 'Not a participant' }, { status: 403 })
  }

  const { data: weighIn } = await admin
    .from('duel_weigh_ins')
    .select('*')
    .eq('id', weighInId)
    .eq('duel_id', id)
    .single()

  if (!weighIn) return NextResponse.json({ error: 'Weigh-in not found' }, { status: 404 })

  await admin.from('duel_weigh_ins').update({
    verified,
    verified_by: user.id,
    verified_at: new Date().toISOString(),
  }).eq('id', weighInId)

  // If verifying, update lowest weight on duel if applicable
  if (verified) {
    const isA = weighIn.user_id === duel.competitor_a_id
    const currentLowest = isA ? duel.lowest_weight_a : duel.lowest_weight_b
    if (!currentLowest || weighIn.weight < currentLowest) {
      await admin.from('duel_challenges')
        .update({ [isA ? 'lowest_weight_a' : 'lowest_weight_b']: weighIn.weight })
        .eq('id', id)
    }
  }

  return NextResponse.json({ ok: true })
}
