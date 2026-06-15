import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import DuelClient from './DuelClient'

export const revalidate = 0

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export default async function DuelPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const admin = adminClient()

  const { data: duel, error: duelError } = await admin
    .from('duel_challenges')
    .select(`
      *,
      profileA:profiles!duel_challenges_competitor_a_id_fkey(id, display_name, username, avatar_url),
      profileB:profiles!duel_challenges_competitor_b_id_fkey(id, display_name, username, avatar_url),
      creator:profiles!duel_challenges_created_by_fkey(id, display_name, username)
    `)
    .eq('id', id)
    .single()

  if (duelError || !duel) redirect('/duel')

  // Fetch workouts for both competitors in date window
  const startISO = duel.start_date
  const endISO = duel.end_date + 'T23:59:59'

  const [
    { data: workoutsA },
    { data: workoutsB },
    { data: weighIns },
    { data: comments },
    { data: reactions },
    { data: watcherProfiles },
    { data: checkInsA },
    { data: checkInsB },
  ] = await Promise.all([
    admin
      .from('workouts')
      .select('id, points, workout_type, duration_minutes, logged_at, notes')
      .eq('user_id', duel.competitor_a_id)
      .gte('logged_at', startISO)
      .lte('logged_at', endISO)
      .order('logged_at', { ascending: false }),
    admin
      .from('workouts')
      .select('id, points, workout_type, duration_minutes, logged_at, notes')
      .eq('user_id', duel.competitor_b_id)
      .gte('logged_at', startISO)
      .lte('logged_at', endISO)
      .order('logged_at', { ascending: false }),
    admin
      .from('duel_weigh_ins')
      .select('*, submitter:profiles!duel_weigh_ins_submitted_by_fkey(display_name)')
      .eq('duel_id', id)
      .order('weighed_at', { ascending: false }),
    admin
      .from('duel_comments')
      .select('*, profiles!duel_comments_user_id_fkey(id, display_name, username)')
      .eq('duel_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
    admin
      .from('duel_reactions')
      .select('*')
      .eq('duel_id', id),
    duel.watcher_ids?.length > 0
      ? admin
          .from('profiles')
          .select('id, display_name, username')
          .in('id', duel.watcher_ids)
      : Promise.resolve({ data: [] }),
    admin
      .from('duel_daily_checkins')
      .select('*')
      .eq('duel_id', id)
      .eq('user_id', duel.competitor_a_id)
      .order('check_in_date', { ascending: false }),
    admin
      .from('duel_daily_checkins')
      .select('*')
      .eq('duel_id', id)
      .eq('user_id', duel.competitor_b_id)
      .order('check_in_date', { ascending: false }),
  ])

  return (
    <div className="min-h-screen bg-gray-950 pb-24">
      <DuelClient
        duel={duel}
        workoutsA={workoutsA || []}
        workoutsB={workoutsB || []}
        weighIns={weighIns || []}
        comments={comments || []}
        reactions={reactions || []}
        watcherProfiles={watcherProfiles || []}
        checkInsA={checkInsA || []}
        checkInsB={checkInsB || []}
        currentUserId={user.id}
        duelId={id}
      />
    </div>
  )
}
