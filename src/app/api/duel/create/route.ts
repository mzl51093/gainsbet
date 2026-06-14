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

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    name,
    competitorAId,
    competitorBId,
    watcherIds,
    wager,
    rules,
    startDate,
    endDate,
    startingWeightA,
    startingWeightB,
  } = body

  if (!name?.trim() || !competitorAId || !competitorBId || !startDate || !endDate) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (competitorAId === competitorBId) {
    return NextResponse.json({ error: 'Competitors must be different people' }, { status: 400 })
  }
  if (endDate <= startDate) {
    return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 })
  }

  const admin = adminClient()

  const { data: duel, error } = await admin
    .from('duel_challenges')
    .insert({
      name: name.trim(),
      created_by: user.id,
      competitor_a_id: competitorAId,
      competitor_b_id: competitorBId,
      watcher_ids: watcherIds || [],
      wager: wager?.trim() || null,
      rules: rules?.trim() || null,
      start_date: startDate,
      end_date: endDate,
      starting_weight_a: startingWeightA || null,
      starting_weight_b: startingWeightB || null,
      lowest_weight_a: startingWeightA || null,
      lowest_weight_b: startingWeightB || null,
    })
    .select()
    .single()

  if (error || !duel) {
    console.error('Failed to create duel:', error)
    return NextResponse.json({ error: 'Failed to create duel' }, { status: 500 })
  }

  // Notify all participants
  const allIds = [...new Set([competitorAId, competitorBId, ...(watcherIds || [])])]
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, display_name')
    .in('id', allIds)

  const profileMap: Record<string, string> = {}
  for (const p of profiles || []) profileMap[p.id] = p.display_name

  const creatorName = profileMap[user.id] || 'Someone'

  await Promise.all(allIds
    .filter(id => id !== user.id)
    .map(async (id) => {
      const isCompetitor = id === competitorAId || id === competitorBId
      const notif = {
        type: 'duel_invited',
        title: isCompetitor
          ? `⚔️ You've been challenged! "${name}"`
          : `👀 You're watching "${name}"`,
        body: isCompetitor
          ? `${creatorName} set up a duel. ${wager ? `Stakes: ${wager}` : 'No wager set.'}`
          : `${creatorName} added you as a watcher.`,
        url: `/duel/${duel.id}`,
      }
      await Promise.all([
        sendPushToUser(id, notif).catch(() => null),
        saveNotification(id, notif),
      ])
    })
  )

  return NextResponse.json({ id: duel.id })
}
