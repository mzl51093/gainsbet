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

function computeHealthScore(habits: {
  ate_protein: boolean
  ate_vegetables: boolean
  drank_water: boolean
  within_goals: boolean
  drank_alcohol: boolean
  ate_fried_food: boolean
  ate_fast_food: boolean
  ate_dessert: boolean
  had_binge_meal: boolean
}): number {
  let score = 100
  if (habits.ate_protein) score += 25
  if (habits.ate_vegetables) score += 25
  if (habits.drank_water) score += 25
  if (habits.within_goals) score += 25
  if (habits.drank_alcohol) score -= 40
  if (habits.ate_fried_food) score -= 30
  if (habits.ate_fast_food) score -= 40
  if (habits.ate_dessert) score -= 15
  if (habits.had_binge_meal) score -= 50
  return Math.max(0, Math.min(200, score))
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
    meal_description,
    ate_protein,
    ate_vegetables,
    drank_water,
    within_goals,
    drank_alcohol,
    ate_fried_food,
    ate_fast_food,
    ate_dessert,
    had_binge_meal,
  } = body

  const habits = {
    ate_protein: !!ate_protein,
    ate_vegetables: !!ate_vegetables,
    drank_water: !!drank_water,
    within_goals: !!within_goals,
    drank_alcohol: !!drank_alcohol,
    ate_fried_food: !!ate_fried_food,
    ate_fast_food: !!ate_fast_food,
    ate_dessert: !!ate_dessert,
    had_binge_meal: !!had_binge_meal,
  }

  const health_score = computeHealthScore(habits)
  const earned_bonus = health_score >= 150
  const challenge_points = earned_bonus ? 10 : 0

  const { data: checkIn, error } = await admin
    .from('duel_daily_checkins')
    .upsert({
      duel_id: id,
      user_id: user.id,
      check_in_date: today,
      meal_description: meal_description?.trim() || null,
      ...habits,
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

  // Notify everyone
  const { data: profile } = await admin
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single()

  const name = profile?.display_name?.split(' ')[0] || 'Someone'
  const allParticipants = [duel.competitor_a_id, duel.competitor_b_id, ...(duel.watcher_ids || [])]

  const notifBody = earned_bonus
    ? `${name} earned Healthy Day Bonus (+10 pts)! Health score: ${health_score}/200`
    : `${name} completed check-in. Health score: ${health_score}/200. No bonus (need 150+).`

  await Promise.all(allParticipants
    .filter((pid: string) => pid !== user.id)
    .map(async (pid: string) => {
      const notif = {
        type: 'duel_checkin',
        title: earned_bonus
          ? `🥗 ${name} earned Healthy Day Bonus!`
          : `📋 ${name} completed daily check-in`,
        body: notifBody,
        url: `/duel/${id}`,
      }
      await Promise.all([
        sendPushToUser(pid, notif).catch(() => null),
        saveNotification(pid, notif),
      ])
    })
  )

  return NextResponse.json({
    id: checkIn.id,
    health_score,
    earned_bonus,
    challenge_points,
  })
}
