import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { sendPushToUser } from '@/lib/push'
import { saveNotification } from '@/lib/notifications-db'
import { getTodayEastern } from '@/lib/timezone'

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
    .select('competitor_a_id, competitor_b_id, watcher_ids, name, start_date, end_date, status')
    .eq('id', id)
    .single()

  if (!duel) return NextResponse.json({ error: 'Duel not found' }, { status: 404 })
  if (duel.status !== 'active') return NextResponse.json({ error: 'Duel is not active' }, { status: 400 })

  const isCompetitor = user.id === duel.competitor_a_id || user.id === duel.competitor_b_id
  if (!isCompetitor) return NextResponse.json({ error: 'Only competitors can check in' }, { status: 403 })

  const today = getTodayEastern()
  if (today < duel.start_date || today > duel.end_date) {
    return NextResponse.json({ error: 'Check-in only available during the duel window' }, { status: 400 })
  }

  const body = await req.json()
  const {
    breakfast_notes,
    lunch_notes,
    dinner_notes,
    snack_notes,
    drank_alcohol,
    ate_fried_food,
    ate_fast_food,
    ate_dessert,
    had_binge_meal,
  } = body

  const hasMealEntry = [breakfast_notes, lunch_notes, dinner_notes, snack_notes]
    .some((s: string | null | undefined) => s?.trim())

  const hasDisqualifier = !!(drank_alcohol || ate_fried_food || ate_fast_food || ate_dessert || had_binge_meal)

  const earned_bonus = hasMealEntry && !hasDisqualifier
  const challenge_points = earned_bonus ? 10 : 0
  // health_score kept for DB compat: 100 = earned, 0 = not
  const health_score = earned_bonus ? 100 : 0

  const { data: checkIn, error } = await admin
    .from('duel_daily_checkins')
    .upsert({
      duel_id: id,
      user_id: user.id,
      check_in_date: today,
      meal_description: [breakfast_notes, lunch_notes, dinner_notes, snack_notes]
        .filter(Boolean).join(' | ') || null,
      breakfast_notes: breakfast_notes?.trim() || null,
      lunch_notes: lunch_notes?.trim() || null,
      dinner_notes: dinner_notes?.trim() || null,
      snack_notes: snack_notes?.trim() || null,
      // Positive habits not used — set false
      ate_protein: false,
      ate_vegetables: false,
      drank_water: false,
      within_goals: false,
      // Negative habits (disqualifiers)
      drank_alcohol: !!drank_alcohol,
      ate_fried_food: !!ate_fried_food,
      ate_fast_food: !!ate_fast_food,
      ate_dessert: !!ate_dessert,
      had_binge_meal: !!had_binge_meal,
      health_score,
      earned_bonus,
      challenge_points,
    }, { onConflict: 'duel_id,user_id,check_in_date' })
    .select()
    .single()

  if (error || !checkIn) {
    console.error('Check-in error:', error)
    return NextResponse.json({ error: error?.message || 'Failed to save check-in' }, { status: 500 })
  }

  // Notify everyone else
  const { data: profile } = await admin
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single()

  const name = profile?.display_name?.split(' ')[0] || 'Someone'
  const allParticipants = [duel.competitor_a_id, duel.competitor_b_id, ...(duel.watcher_ids || [])]

  await Promise.all(allParticipants
    .filter((pid: string) => pid !== user.id)
    .map(async (pid: string) => {
      const notif = {
        type: 'duel_checkin',
        title: earned_bonus
          ? `🥗 ${name} earned Healthy Day Bonus!`
          : `📋 ${name} completed daily check-in`,
        body: earned_bonus
          ? `${name} logged their meals and stayed clean. +10 pts.`
          : hasDisqualifier
            ? `${name} checked in but had a disqualifier. No bonus.`
            : `${name} didn't log their meals. No bonus.`,
        url: `/duel/${id}`,
      }
      await Promise.all([
        sendPushToUser(pid, notif).catch(() => null),
        saveNotification(pid, notif),
      ])
    })
  )

  return NextResponse.json({ id: checkIn.id, earned_bonus, challenge_points })
}
