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

  const body = await req.json()
  const { pointGoal, endDate, wagerDescription } = body

  const admin = adminClient()

  const { data: comp, error: compError } = await admin
    .from('draft_competitions')
    .select('status, captain_a_id, captain_b_id')
    .eq('id', id)
    .single()

  if (compError || !comp) {
    return NextResponse.json({ error: 'Competition not found' }, { status: 404 })
  }

  if (comp.status !== 'active') {
    return NextResponse.json({ error: 'Can only edit an active competition' }, { status: 400 })
  }

  const isCaptain = user.id === comp.captain_a_id || user.id === comp.captain_b_id
  if (!isCaptain) {
    return NextResponse.json({ error: 'Only captains can edit settings' }, { status: 403 })
  }

  if (pointGoal !== undefined && (typeof pointGoal !== 'number' || pointGoal < 1)) {
    return NextResponse.json({ error: 'Invalid point goal' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (pointGoal !== undefined) updates.point_goal = pointGoal
  if (endDate !== undefined) updates.end_date = endDate || null
  if (wagerDescription !== undefined) updates.wager_description = wagerDescription || null

  const { error } = await admin
    .from('draft_competitions')
    .update(updates)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
