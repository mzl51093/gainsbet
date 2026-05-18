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
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { workoutId, approved } = body

  if (!workoutId || approved === undefined) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const admin = adminClient()

  // Verify competition exists
  const { data: comp, error: compError } = await admin
    .from('draft_competitions')
    .select('*')
    .eq('id', id)
    .single()

  if (compError || !comp) {
    return NextResponse.json({ error: 'Competition not found' }, { status: 404 })
  }

  // Get the workout
  const { data: workout, error: workoutError } = await admin
    .from('workouts')
    .select('*')
    .eq('id', workoutId)
    .eq('draft_competition_id', id)
    .single()

  if (workoutError || !workout) {
    return NextResponse.json({ error: 'Workout not found' }, { status: 404 })
  }

  // Verify validator is on same team as the workout logger
  const { data: validatorParticipant } = await admin
    .from('draft_participants')
    .select('team')
    .eq('competition_id', id)
    .eq('user_id', user.id)
    .single()

  if (!validatorParticipant) {
    return NextResponse.json({ error: 'You are not a participant' }, { status: 403 })
  }

  const { data: loggerParticipant } = await admin
    .from('draft_participants')
    .select('team')
    .eq('competition_id', id)
    .eq('user_id', workout.user_id)
    .single()

  if (!loggerParticipant || loggerParticipant.team !== validatorParticipant.team) {
    return NextResponse.json({ error: 'You can only validate workouts from your team' }, { status: 403 })
  }

  if (workout.user_id === user.id) {
    return NextResponse.json({ error: 'You cannot validate your own workout' }, { status: 400 })
  }

  // Insert or update approval
  const { error: approvalError } = await admin
    .from('draft_workout_approvals')
    .upsert(
      { workout_id: workoutId, validator_id: user.id, approved },
      { onConflict: 'workout_id,validator_id' }
    )

  if (approvalError) {
    console.error('Failed to save approval:', approvalError)
    return NextResponse.json({ error: 'Failed to save approval' }, { status: 500 })
  }

  // Count team members (excluding logger)
  const { data: teamMembers } = await admin
    .from('draft_participants')
    .select('user_id')
    .eq('competition_id', id)
    .eq('team', loggerParticipant.team)
    .neq('user_id', workout.user_id)

  const teamMemberCount = teamMembers?.length || 0
  const majority = Math.ceil(teamMemberCount / 2)

  // Count current approvals and rejections
  const { data: allApprovals } = await admin
    .from('draft_workout_approvals')
    .select('approved')
    .eq('workout_id', workoutId)

  const approveCount = (allApprovals || []).filter((a) => a.approved === true).length
  const rejectCount = (allApprovals || []).filter((a) => a.approved === false).length

  let newStatus = workout.validation_status
  if (approveCount >= majority) {
    newStatus = 'approved'
  } else if (rejectCount >= majority) {
    newStatus = 'rejected'
  }

  if (newStatus !== workout.validation_status) {
    await admin
      .from('workouts')
      .update({ validation_status: newStatus })
      .eq('id', workoutId)
  }

  return NextResponse.json({ success: true, validationStatus: newStatus })
}
