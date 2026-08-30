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
  const { id: duelId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { courseName, holes, grossScore, notes, playedAt } = body

  const score = parseInt(grossScore)
  const holeCount = holes === 9 ? 9 : 18
  const minScore = holeCount === 9 ? 18 : 36

  if (!score || score < minScore || score > 200) {
    return NextResponse.json({ error: `Score must be between ${minScore} and 200` }, { status: 400 })
  }

  const admin = adminClient()

  // Verify user is a competitor in this duel
  const { data: duel } = await admin
    .from('duel_challenges')
    .select('competitor_a_id, competitor_b_id')
    .eq('id', duelId)
    .single()

  if (!duel || (duel.competitor_a_id !== user.id && duel.competitor_b_id !== user.id)) {
    return NextResponse.json({ error: 'Not a competitor in this duel' }, { status: 403 })
  }

  const { error } = await admin
    .from('golf_rounds')
    .insert({
      duel_id: duelId,
      user_id: user.id,
      course_name: courseName?.trim() || null,
      holes: holeCount,
      gross_score: score,
      notes: notes?.trim() || null,
      played_at: playedAt || new Date().toISOString(),
    })

  if (error) {
    console.error('Failed to log golf round:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
