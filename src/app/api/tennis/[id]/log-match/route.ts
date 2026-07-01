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

function determineWinner(player1Id: string, player2Id: string, setScores: {p1: number, p2: number}[]): string | null {
  let p1Sets = 0, p2Sets = 0
  for (const s of setScores) {
    if (s.p1 > s.p2) p1Sets++
    else if (s.p2 > s.p1) p2Sets++
  }
  if (p1Sets > p2Sets) return player1Id
  if (p2Sets > p1Sets) return player2Id
  return null
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
    .select('participant_ids, name, status')
    .eq('id', id)
    .single()

  if (!challenge) return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
  if (!challenge.participant_ids.includes(user.id)) {
    return NextResponse.json({ error: 'You are not a participant' }, { status: 403 })
  }

  const { opponentId, setScores, acesMe, acesOpp, doubleFaultsMe, doubleFaultsOpp, notes } = await req.json()

  if (!opponentId || !setScores?.length) {
    return NextResponse.json({ error: 'Opponent and set scores required' }, { status: 400 })
  }
  if (!challenge.participant_ids.includes(opponentId)) {
    return NextResponse.json({ error: 'Opponent is not a participant' }, { status: 400 })
  }

  const winnerId = determineWinner(user.id, opponentId, setScores)

  const { data: match, error } = await admin
    .from('tennis_matches')
    .insert({
      challenge_id: id,
      player1_id: user.id,
      player2_id: opponentId,
      winner_id: winnerId,
      set_scores: setScores,
      aces_p1: acesMe || 0,
      aces_p2: acesOpp || 0,
      double_faults_p1: doubleFaultsMe || 0,
      double_faults_p2: doubleFaultsOpp || 0,
      notes: notes?.trim() || null,
    })
    .select()
    .single()

  if (error || !match) {
    return NextResponse.json({ error: error?.message || 'Failed to log match' }, { status: 500 })
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single()

  const myName = profile?.display_name?.split(' ')[0] || 'Someone'
  const scoreStr = setScores.map((s: {p1: number, p2: number}) => `${s.p1}-${s.p2}`).join(', ')
  const wonText = winnerId === user.id ? 'won' : 'lost'

  const othersToNotify = challenge.participant_ids.filter((pid: string) => pid !== user.id)
  await Promise.all(othersToNotify.map(async (pid: string) => {
    const notif = {
      type: 'tennis_match_logged',
      title: `🎾 ${myName} logged a match result`,
      body: `${myName} ${wonText} (${scoreStr}) in "${challenge.name}"`,
      url: `/tennis/${id}`,
    }
    await Promise.all([
      sendPushToUser(pid, notif).catch(() => null),
      saveNotification(pid, notif),
    ])
  }))

  return NextResponse.json({ id: match.id, winnerId })
}
