import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { getTodayEastern } from '@/lib/timezone'
import { resolveExpiredWagers } from '@/lib/resolve-wager'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const todayEastern = getTodayEastern()

  const { data: allActive } = await admin
    .from('wagers')
    .select('*')
    .eq('status', 'active')

  const expired = (allActive || []).filter((w: any) =>
    w.end_date && w.end_date < todayEastern && (w.team_player_ids || []).length > 0
  )

  if (expired.length === 0) return NextResponse.json({ resolved: 0 })

  await resolveExpiredWagers(admin, expired)
  return NextResponse.json({ resolved: expired.length })
}
