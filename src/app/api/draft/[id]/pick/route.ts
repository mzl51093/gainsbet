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

const DRAFT_COMPLETE_MESSAGES = [
  "Rosters locked. No more hiding — time to earn it. 🏋️",
  "Teams set. Someone's getting humbled. Let's find out who. 💀",
  "The draft is DONE. May the gains be ever in your favor. 💪",
  "All picked. The only question now: who actually shows up. ⚡",
  "Rosters sealed. Captains, start the clock. Let the suffering begin. 🔥",
  "Draft complete. Zero excuses left. Time to suffer beautifully. 😤",
  "Teams locked in. Go log a workout before they even configure it. 🚀",
]

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

  // Find remaining unpicked non-captains (excluding the player we just picked)
  const stillUnpicked = (participants || []).filter(
    (p) =>
      p.team === null &&
      p.user_id !== pickedUserId &&
      p.user_id !== comp.captain_a_id &&
      p.user_id !== comp.captain_b_id
  )

  let allPicked = stillUnpicked.length === 0
  let newPickNumber = comp.pick_number + 1

  // Auto-pick the last remaining player — no decision needed
  if (stillUnpicked.length === 1) {
    const lastPlayer = stillUnpicked[0]
    const autoTeam = team === 'a' ? 'b' : 'a'
    await admin
      .from('draft_participants')
      .update({ team: autoTeam })
      .eq('competition_id', id)
      .eq('user_id', lastPlayer.user_id)
    newPickNumber += 1
    allPicked = true
  }

  await admin
    .from('draft_competitions')
    .update({
      pick_number: newPickNumber,
      status: allPicked ? 'configuring' : 'drafting',
    })
    .eq('id', id)

  // Notifications
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

  const notif = allPicked
    ? {
        type: 'draft_complete',
        title: `🔥 Rosters locked — "${comp.name}"`,
        body: DRAFT_COMPLETE_MESSAGES[Math.floor(Math.random() * DRAFT_COMPLETE_MESSAGES.length)],
        url: `/draft/${id}`,
      }
    : {
        type: 'draft_pick',
        title: `${pickedName} was picked by ${captainName}!`,
        body: `The draft continues in "${comp.name}".`,
        url: `/draft/${id}`,
      }

  await Promise.all([
    sendPushToAll(participantIds, notif),
    saveNotifications(participantIds, notif),
  ])

  return NextResponse.json({ success: true, allPicked })
}
