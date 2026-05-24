import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import DraftCompetitionClient from './DraftCompetitionClient'

export const revalidate = 0

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export default async function DraftCompetitionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const admin = adminClient()

  const { data: comp, error: compError } = await admin
    .from('draft_competitions')
    .select('*')
    .eq('id', id)
    .single()

  if (compError || !comp) {
    redirect('/draft')
  }

  const { data: participants } = await admin
    .from('draft_participants')
    .select('*, profiles(*)')
    .eq('competition_id', id)

  const { data: votes } = await admin
    .from('draft_captain_votes')
    .select('voted_for_id, voter_id')
    .eq('competition_id', id)

  const voteCounts: Record<string, number> = {}
  const voterIds: string[] = []
  for (const v of votes || []) {
    voteCounts[v.voted_for_id] = (voteCounts[v.voted_for_id] || 0) + 1
    voterIds.push(v.voter_id)
  }

  let workouts: any[] = []
  let pendingWorkouts: any[] = []

  if (comp.status === 'active' || comp.status === 'completed') {
    const participantIds = (participants || []).map((p: any) => p.user_id)

    if (participantIds.length > 0) {
      // Query by participant user IDs + date window so workouts logged from
      // any entry point (not just the competition-specific button) are counted
      let q = admin
        .from('workouts')
        .select('*, profiles!workouts_user_id_fkey(display_name, username)')
        .in('user_id', participantIds)
        .order('logged_at', { ascending: false })

      if (comp.start_date) {
        q = q.gte('logged_at', comp.start_date)
      }
      if (comp.end_date) {
        q = q.lte('logged_at', comp.end_date + 'T23:59:59')
      }

      const { data: ws } = await q
      workouts = ws || []

      if (comp.status === 'active') {
        pendingWorkouts = workouts.filter((w: any) => w.validation_status === 'pending')

        // Auto-complete: check if a team has hit the point goal with all members
        // meeting the minimum contribution. Counts only approved workouts.
        const approvedWorkouts = workouts.filter((w: any) => w.validation_status === 'approved')
        const goal = comp.point_goal
        const minPct = comp.min_contribution_pct || 0
        const minRequired = minPct > 0 ? Math.ceil((goal * minPct) / 100) : 0

        function teamQualifies(letter: 'a' | 'b'): boolean {
          const members = (participants || []).filter((p: any) => p.team === letter)
          const total = members.reduce((sum: number, p: any) => {
            return sum + approvedWorkouts.filter((w: any) => w.user_id === p.user_id).reduce((s: number, w: any) => s + w.points, 0)
          }, 0)
          if (total < goal) return false
          if (minRequired === 0) return true
          return members.every((p: any) => {
            const pts = approvedWorkouts.filter((w: any) => w.user_id === p.user_id).reduce((s: number, w: any) => s + w.points, 0)
            return pts >= minRequired
          })
        }

        const aQualifies = teamQualifies('a')
        const bQualifies = teamQualifies('b')

        if (aQualifies || bQualifies) {
          let winner: 'a' | 'b'
          if (aQualifies && !bQualifies) winner = 'a'
          else if (bQualifies && !aQualifies) winner = 'b'
          else {
            // Both qualified simultaneously — whoever has more points wins
            const aTotal = (participants || []).filter((p: any) => p.team === 'a')
              .reduce((s: number, p: any) => s + approvedWorkouts.filter((w: any) => w.user_id === p.user_id).reduce((ss: number, w: any) => ss + w.points, 0), 0)
            const bTotal = (participants || []).filter((p: any) => p.team === 'b')
              .reduce((s: number, p: any) => s + approvedWorkouts.filter((w: any) => w.user_id === p.user_id).reduce((ss: number, w: any) => ss + w.points, 0), 0)
            winner = aTotal >= bTotal ? 'a' : 'b'
          }

          await admin.from('draft_competitions').update({ status: 'completed', winner_team: winner }).eq('id', id)

          // Create debt record for the losing team
          if (comp.wager_description) {
            const winnerIds = (participants || []).filter((p: any) => p.team === winner).map((p: any) => p.user_id)
            const loserIds  = (participants || []).filter((p: any) => p.team !== winner).map((p: any) => p.user_id)
            if (winnerIds.length > 0 && loserIds.length > 0) {
              await admin.from('wager_debts').insert({
                wager_title: comp.name,
                debtor_ids: loserIds,
                creditor_ids: winnerIds,
                description: comp.wager_description,
                status: 'outstanding',
              }).select().then(() => null, () => null)  // no-op if wager_id NOT NULL constraint exists
            }
          }

          // Notify all participants
          const { sendPushToUser } = await import('@/lib/push')
          const { saveNotification } = await import('@/lib/notifications-db')
          const winnerName = winner === 'a'
            ? (participants || []).find((p: any) => p.user_id === comp.captain_a_id)?.profiles?.display_name?.split(' ')[0] || 'Team A'
            : (participants || []).find((p: any) => p.user_id === comp.captain_b_id)?.profiles?.display_name?.split(' ')[0] || 'Team B'

          await Promise.all((participants || []).map(async (p: any) => {
            const isWinner = p.team === winner
            const notif = isWinner ? {
              type: 'draft_completed_win',
              title: `🏆 ${comp.name} — Your team won!`,
              body: comp.wager_description ? `Collect your prize: "${comp.wager_description}"` : 'Goal reached. You earned it.',
              url: `/draft/${id}`,
            } : {
              type: 'draft_completed_loss',
              title: `💀 ${comp.name} — ${winnerName}'s team wins.`,
              body: comp.wager_description ? `You owe: "${comp.wager_description}"` : 'Better luck next time.',
              url: `/draft/${id}`,
            }
            await Promise.all([
              sendPushToUser(p.user_id, notif).catch(() => null),
              saveNotification(p.user_id, notif),
            ])
          }))

          // Reload with completed status so the page renders the results view
          redirect(`/draft/${id}`)
        }
      }
    }
  }

  // Chat: determine user's team, then fetch initial messages for each channel
  const userParticipant = (participants || []).find(p => p.user_id === user.id)
  const myTeam = (userParticipant?.team as 'a' | 'b' | null) ?? null
  const teamChannel = myTeam ? `team_${myTeam}` : null

  const [{ data: groupMessages }, { data: teamMessages }, { data: allProfiles }, { data: existingInvites }] = await Promise.all([
    admin
      .from('draft_messages')
      .select('*, profiles!draft_messages_user_id_fkey(display_name, username)')
      .eq('competition_id', id)
      .eq('channel', 'group')
      .order('created_at', { ascending: true })
      .limit(50),
    teamChannel
      ? admin
          .from('draft_messages')
          .select('*, profiles!draft_messages_user_id_fkey(display_name, username)')
          .eq('competition_id', id)
          .eq('channel', teamChannel)
          .order('created_at', { ascending: true })
          .limit(50)
      : Promise.resolve({ data: [] as any[] }),
    // All profiles for invite search (exclude current user)
    admin
      .from('profiles')
      .select('id, display_name, username')
      .neq('id', user.id)
      .order('display_name'),
    // Already-invited user IDs for this competition
    admin
      .from('draft_invites')
      .select('invited_user_id')
      .eq('competition_id', id),
  ])

  return (
    <div className="min-h-screen bg-gray-950 pb-24">
      <DraftCompetitionClient
        competition={comp}
        participants={participants || []}
        voteCounts={voteCounts}
        voterIds={voterIds}
        workouts={workouts}
        pendingWorkouts={pendingWorkouts}
        currentUserId={user.id}
        competitionId={id}
        myTeam={myTeam}
        initialGroupMessages={groupMessages || []}
        initialTeamMessages={teamMessages || []}
        allProfiles={allProfiles || []}
        invitedIds={(existingInvites || []).map(r => r.invited_user_id)}
      />
    </div>
  )
}
