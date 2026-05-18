import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { sendPushToAll } from '@/lib/push'
import { saveNotifications } from '@/lib/notifications-db'

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function getPickerForPick(
  pickNumber: number,
  captainAId: string,
  captainBId: string
): string {
  const round = Math.floor(pickNumber / 2)
  const posInRound = pickNumber % 2
  if (round % 2 === 0) {
    return posInRound === 0 ? captainAId : captainBId
  } else {
    return posInRound === 0 ? captainBId : captainAId
  }
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
  const { pickedUserId } = body

  if (!pickedUserId) {
    return NextResponse.json({ error: 'Missing pickedUserId' }, { status: 400 })
  }

  const admin = adminClient()

  const { data: comp, error: compError } = await admin
    .from('draft_competitions')
    .select('*')
    .eq('id', id)
    .single()

  if (compError || !comp) {
    return NextResponse.json({ error: 'Competition not found' }, { status: 404 })
  }

  if (comp.status !== 'drafting') {
    return NextResponse.json({ error: 'Competition is not in drafting phase' }, { status: 400 })
  }

  const expectedPicker = getPickerForPick(
    comp.pick_number,
    comp.captain_a_id,
    comp.captain_b_id
  )

  if (user.id !== expectedPicker) {
    return NextResponse.json({ error: 'It is not your turn to pick' }, { status: 403 })
  }

  const { data: participants } = await admin
    .from('draft_participants')
    .select('user_id, team')
    .eq('competition_id', id)

  const participantIds = participants?.map((p) => p.user_id) || []

  if (!participantIds.includes(pickedUserId)) {
    return NextResponse.json({ error: 'User is not a participant' }, { status: 400 })
  }

  const alreadyPicked = participants?.find(
    (p) => p.user_id === pickedUserId && p.team !== null
  )
  if (alreadyPicked) {
    return NextResponse.json({ error: 'User has already been picked' }, { status: 400 })
  }

  // Assign team based on who is picking
  const team = user.id === comp.captain_a_id ? 'a' : 'b'

  await admin
    .from('draft_participants')
    .update({ team })
    .eq('competition_id', id)
    .eq('user_id', pickedUserId)

  const newPickNumber = comp.pick_number + 1

  // Check if all non-captain participants have been picked
  const unpickedNonCaptains = participants?.filter(
    (p) =>
      p.team === null &&
      p.user_id !== pickedUserId &&
      p.user_id !== comp.captain_a_id &&
      p.user_id !== comp.captain_b_id
  )

  const allPicked = (unpickedNonCaptains?.length || 0) === 0

  await admin
    .from('draft_competitions')
    .update({
      pick_number: newPickNumber,
      status: allPicked ? 'configuring' : 'drafting',
    })
    .eq('id', id)

  // Get picked user's display name for notification
  const { data: pickedProfile } = await admin
    .from('profiles')
    .select('display_name')
    .eq('id', pickedUserId)
    .single()

  const { data: captainProfile } = await admin
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single()

  const pickedName = pickedProfile?.display_name?.split(' ')[0] || 'Someone'
  const captainName = captainProfile?.display_name?.split(' ')[0] || 'Captain'

  const notif = {
    type: 'draft_pick',
    title: `${pickedName} was picked by ${captainName}!`,
    body: allPicked
      ? `Draft complete! Captains are now configuring the competition.`
      : `The draft continues in "${comp.name}".`,
    url: `/draft/${id}`,
  }

  await Promise.all([
    sendPushToAll(participantIds, notif),
    saveNotifications(participantIds, notif),
  ])

  return NextResponse.json({ success: true, allPicked })
}
