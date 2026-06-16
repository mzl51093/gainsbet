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

  const admin = adminClient()

  const { data: duel } = await admin
    .from('duel_challenges')
    .select('competitor_a_id, competitor_b_id, starting_weight_a, starting_weight_b, lowest_weight_a, lowest_weight_b')
    .eq('id', id)
    .single()

  if (!duel) return NextResponse.json({ error: 'Duel not found' }, { status: 404 })

  const isA = user.id === duel.competitor_a_id
  const isB = user.id === duel.competitor_b_id
  if (!isA && !isB) return NextResponse.json({ error: 'Not a competitor' }, { status: 403 })

  const { startingWeight, targetWeight } = await req.json()

  const updates: Record<string, number | null> = {}

  if (targetWeight !== undefined) {
    updates[isA ? 'target_weight_a' : 'target_weight_b'] = targetWeight ? Number(targetWeight) : null
  }
  if (startingWeight !== undefined) {
    const sw = startingWeight ? Number(startingWeight) : null
    updates[isA ? 'starting_weight_a' : 'starting_weight_b'] = sw
    // Also set lowest_weight if not yet set or if new starting weight is lower
    const currentLowest = isA ? duel.lowest_weight_a : duel.lowest_weight_b
    if (sw && (!currentLowest || sw < currentLowest)) {
      updates[isA ? 'lowest_weight_a' : 'lowest_weight_b'] = sw
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true })
  }

  const { error } = await admin.from('duel_challenges').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
