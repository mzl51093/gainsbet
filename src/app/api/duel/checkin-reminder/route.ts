import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { sendPushToUser } from '@/lib/push'
import { getTodayEastern } from '@/lib/timezone'

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Called by Vercel cron at 9 PM ET (02:00 UTC)
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = adminClient()
  const today = getTodayEastern()

  // Find all active duels
  const { data: activeDuels } = await admin
    .from('duel_challenges')
    .select('id, name, competitor_a_id, competitor_b_id')
    .eq('status', 'active')
    .lte('start_date', today)
    .gte('end_date', today)

  if (!activeDuels?.length) return NextResponse.json({ sent: 0 })

  // Find who already checked in today across all these duels
  const duelIds = activeDuels.map((d: any) => d.id)
  const { data: todayCheckIns } = await admin
    .from('duel_daily_checkins')
    .select('duel_id, user_id')
    .in('duel_id', duelIds)
    .eq('check_in_date', today)

  const checkedInSet = new Set(
    (todayCheckIns || []).map((c: any) => `${c.duel_id}:${c.user_id}`)
  )

  // Send reminder to each competitor who hasn't checked in yet
  const sends: Promise<unknown>[] = []
  for (const duel of activeDuels) {
    for (const userId of [duel.competitor_a_id, duel.competitor_b_id]) {
      if (!checkedInSet.has(`${duel.id}:${userId}`)) {
        sends.push(
          sendPushToUser(userId, {
            title: '🥗 Healthy Day Check-In',
            body: `Don't forget to log your habits for "${duel.name}" today!`,
            url: `/duel/${duel.id}`,
          }).catch(() => null)
        )
      }
    }
  }

  await Promise.all(sends)
  return NextResponse.json({ sent: sends.length })
}
