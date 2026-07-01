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

  const { data: challenge } = await admin
    .from('tennis_challenges')
    .select('participant_ids')
    .eq('id', id)
    .single()

  if (!challenge) return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
  if (!challenge.participant_ids.includes(user.id)) {
    return NextResponse.json({ error: 'Not a participant' }, { status: 403 })
  }

  const { durationMinutes, drillFocus, notes, sessionDate } = await req.json()
  if (!durationMinutes || durationMinutes < 10) {
    return NextResponse.json({ error: 'Duration must be at least 10 minutes' }, { status: 400 })
  }

  const points = Math.round((durationMinutes / 60) * 10)

  const { data: session, error } = await admin
    .from('tennis_sessions')
    .insert({
      challenge_id: id,
      user_id: user.id,
      duration_minutes: durationMinutes,
      drill_focus: drillFocus || null,
      notes: notes?.trim() || null,
      session_date: sessionDate || new Date().toISOString().split('T')[0],
      points,
    })
    .select()
    .single()

  if (error || !session) {
    return NextResponse.json({ error: error?.message || 'Failed to log session' }, { status: 500 })
  }

  return NextResponse.json({ id: session.id, points })
}
