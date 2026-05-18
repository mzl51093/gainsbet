import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendPushToUser, sendPushToAll } from '@/lib/push'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { event, payload } = await req.json()

  // Get caller's profile
  const { data: me } = await supabase
    .from('profiles')
    .select('display_name, username')
    .eq('id', user.id)
    .single()

  const name = me?.display_name?.split(' ')[0] || 'Someone'

  // Get all other user IDs to potentially notify
  const { data: allProfiles } = await supabase.from('profiles').select('id')
  const everyoneElse = (allProfiles || []).map(p => p.id).filter(id => id !== user.id)

  switch (event) {
    case 'workout_logged': {
      const { points, workoutType } = payload
      await sendPushToAll(everyoneElse, {
        title: `${name} just logged a workout 💪`,
        body: `+${points} pts for ${workoutType}. Get off the couch.`,
        url: '/dashboard',
      })
      break
    }

    case 'wager_proposed': {
      const { wagerId, wagerTitle, participantIds } = payload
      const toNotify = (participantIds as string[]).filter(id => id !== user.id)
      await sendPushToAll(toNotify, {
        title: `${name} proposed a wager 🤝`,
        body: `"${wagerTitle}" — your acceptance is required.`,
        url: '/wagers',
      })
      break
    }

    case 'wager_accepted': {
      const { wagerId, wagerTitle, proposerId, allAccepted } = payload
      if (allAccepted) {
        // Notify everyone in the wager the challenge is live
        const { participantIds } = payload
        const toNotify = (participantIds as string[]).filter(id => id !== user.id)
        await sendPushToAll(toNotify, {
          title: 'Challenge is LIVE 🔥',
          body: `"${wagerTitle}" — everyone accepted. Game on.`,
          url: '/wagers',
        })
      } else {
        // Just notify the proposer that someone accepted
        await sendPushToUser(proposerId, {
          title: `${name} accepted your wager`,
          body: `"${wagerTitle}" — waiting for others.`,
          url: '/wagers',
        })
      }
      break
    }

    case 'wager_resolved': {
      const { wagerTitle, winner, participantIds } = payload
      const toNotify = (participantIds as string[]).filter(id => id !== user.id)
      const winnerText = winner === 'competitors' ? 'Workers won 🏆' : 'Motivators won 💅'
      await sendPushToAll(toNotify, {
        title: `Wager resolved: ${winnerText}`,
        body: `"${wagerTitle}" has been settled.`,
        url: '/wagers',
      })
      break
    }

    case 'double_down_offered': {
      const { wagerTitle, workerIds } = payload
      await sendPushToAll(workerIds, {
        title: `Double down offered 💰`,
        body: `${name} wants to double down on "${wagerTitle}". Accept or decline.`,
        url: '/wagers',
      })
      break
    }

    case 'comment_posted': {
      const { targetOwnerId, context } = payload
      if (targetOwnerId && targetOwnerId !== user.id) {
        await sendPushToUser(targetOwnerId, {
          title: `${name} left a comment`,
          body: context || 'Trash talk incoming 🗑️',
          url: '/dashboard',
        })
      }
      break
    }
  }

  return NextResponse.json({ success: true })
}
