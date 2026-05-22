import { sendPushToUser } from './push'
import { saveNotification } from './notifications-db'
import { getEndOfDayEasternISO } from './timezone'

const WIN_BODIES = [
  (stake: string) => `Collect your prize: "${stake}" — you earned it. 🏆`,
  (stake: string) => `"${stake}" is yours. Go claim it. 👑`,
  (stake: string) => `Work beats excuses. Your prize: "${stake}" 🔥`,
]
const LOSS_BODIES = [
  (stake: string) => `You owe "${stake}" — time to pay up. 😬`,
  (stake: string) => `Debt collection is open: "${stake}". No running. 💀`,
  (stake: string) => `The bill arrived: "${stake}". Settle up. 📬`,
]

function pickFn<T>(arr: T[], seed: string): T {
  const n = seed.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return arr[n % arr.length]
}

export async function resolveExpiredWagers(admin: any, wagers: any[]) {
  for (const wager of wagers) {
    const { data: workouts } = await admin
      .from('workouts')
      .select('user_id, points')
      .in('user_id', wager.team_player_ids)
      .gte('logged_at', wager.week_start)
      .lte('logged_at', getEndOfDayEasternISO(wager.end_date))

    const pts: Record<string, number> = {}
    for (const w of (workouts || [])) pts[w.user_id] = (pts[w.user_id] || 0) + w.points

    const allWon = wager.team_player_ids.every((id: string) => (pts[id] || 0) >= wager.point_threshold)
    const winner = allWon ? 'competitors' : 'partners'

    // Atomic guard — skip if another request already resolved it
    const { data: updated } = await admin
      .from('wagers')
      .update({ status: 'resolved', winner, resolved_at: new Date().toISOString() })
      .eq('id', wager.id)
      .eq('status', 'active')
      .select('id')

    if (!updated || updated.length === 0) continue

    // Create debt record
    const debtorIds = winner === 'competitors' ? (wager.watcher_ids || []) : (wager.team_player_ids || [])
    const creditorIds = winner === 'competitors' ? (wager.team_player_ids || []) : (wager.watcher_ids || [])
    const description = winner === 'competitors' ? wager.stake_if_competitors_win : wager.stake_if_partners_win

    if (debtorIds.length > 0 && creditorIds.length > 0 && description) {
      await admin.from('wager_debts').insert({
        wager_id: wager.id,
        wager_title: wager.title,
        debtor_ids: debtorIds,
        creditor_ids: creditorIds,
        description,
        status: 'outstanding',
      }).select()
    }

    // Personalized push + in-app notifications for every participant
    const workerIds: string[] = wager.team_player_ids || []
    const motivatorIds: string[] = wager.watcher_ids || []
    const allParticipants = [...new Set([...workerIds, ...motivatorIds])]

    await Promise.all(
      allParticipants.map(async (userId) => {
        const isWorker = workerIds.includes(userId)
        const didWin =
          (isWorker && winner === 'competitors') ||
          (!isWorker && winner === 'partners')

        const myStake = didWin
          ? (isWorker ? wager.stake_if_competitors_win : wager.stake_if_partners_win)
          : (isWorker ? wager.stake_if_partners_win : wager.stake_if_competitors_win)

        const seed = userId + wager.id
        const notif = didWin
          ? {
              type: 'competition_ended_win',
              title: `🏆 You won "${wager.title}"!`,
              body: myStake
                ? pickFn(WIN_BODIES, seed)(myStake)
                : 'The work paid off. Go celebrate.',
              url: '/wagers',
            }
          : {
              type: 'competition_ended_loss',
              title: `💀 "${wager.title}" ended. You owe.`,
              body: myStake
                ? pickFn(LOSS_BODIES, seed)(myStake)
                : 'Better luck next time.',
              url: '/wagers',
            }

        await Promise.all([
          sendPushToUser(userId, notif).catch(() => null),
          saveNotification(userId, notif),
        ])
      })
    )
  }
}
