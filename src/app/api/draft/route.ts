import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

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
  const { name, pointGoal, maxParticipants, wagerDescription } = body

  if (!name || !pointGoal || !maxParticipants) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const admin = adminClient()

  const { data: comp, error: compError } = await admin
    .from('draft_competitions')
    .insert({
      name,
      point_goal: pointGoal,
      max_participants: maxParticipants,
      wager_description: wagerDescription || null,
      created_by: user.id,
      status: 'recruiting',
    })
    .select()
    .single()

  if (compError || !comp) {
    console.error('Failed to create competition:', compError)
    return NextResponse.json({ error: 'Failed to create competition' }, { status: 500 })
  }

  const { error: partError } = await admin
    .from('draft_participants')
    .insert({ competition_id: comp.id, user_id: user.id })

  if (partError) {
    console.error('Failed to add creator as participant:', partError)
    return NextResponse.json({ error: 'Failed to join competition' }, { status: 500 })
  }

  return NextResponse.json({ id: comp.id })
}
