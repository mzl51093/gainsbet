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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: pokeId } = await params
  const { videoUrl } = await req.json()

  if (!videoUrl) {
    return NextResponse.json({ error: 'videoUrl is required' }, { status: 400 })
  }

  const admin = adminClient()

  // Look up the poke — must be a pending challenge addressed to current user
  const { data: poke, error: fetchError } = await admin
    .from('pokes')
    .select('*')
    .eq('id', pokeId)
    .eq('to_user_id', user.id)
    .eq('type', 'challenge')
    .eq('status', 'pending')
    .single()

  if (fetchError || !poke) {
    return NextResponse.json({ error: 'Poke not found or already completed' }, { status: 404 })
  }

  // Check expiry
  if (poke.expires_at && new Date(poke.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Challenge has expired' }, { status: 400 })
  }

  // Update poke to completed
  const { error: updateError } = await admin
    .from('pokes')
    .update({
      status: 'completed',
      video_url: videoUrl,
      completed_at: new Date().toISOString(),
    })
    .eq('id', pokeId)

  if (updateError) {
    console.error('Failed to update poke:', updateError)
    return NextResponse.json({ error: 'Failed to complete challenge' }, { status: 500 })
  }

  // Insert a workout for the completer
  const { error: workoutError } = await admin
    .from('workouts')
    .insert({
      user_id: user.id,
      workout_type: 'strength',
      duration_minutes: 5,
      points: poke.points,
      proof_url: videoUrl,
      proof_type: 'video',
      notes: `Poke challenge: ${poke.reps} ${poke.exercise}`,
    })

  if (workoutError) {
    console.error('Failed to insert workout:', workoutError)
    // Don't fail the whole request — poke is already marked complete
  }

  // Get completer's display name
  const { data: completerProfile } = await admin
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single()

  const completerName = completerProfile?.display_name?.split(' ')[0] || 'Someone'
  const ptLabel = (poke.points ?? 1) > 1 ? 's' : ''

  // Notify the challenger
  const notif = {
    type: 'poke_challenge_completed',
    title: `${completerName} crushed your challenge! 💪`,
    body: `${poke.reps} ${poke.exercise} done. +${poke.points} pt${ptLabel} awarded.`,
    url: '/dashboard',
  }

  await Promise.all([
    sendPushToUser(poke.from_user_id, notif),
    saveNotification(poke.from_user_id, notif),
  ])

  return NextResponse.json({ success: true })
}
