import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendPushToUser, sendPushToAll } from '@/lib/push'
import { saveNotification, saveNotifications } from '@/lib/notifications-db'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { event, payload } = await req.json()

  const { data: me } = await supabase.from('profiles').select('display_name, username').eq('id', user.id).single()
  const name = me?.display_name?.split(' ')[0] || 'Someone'

  const { data: allProfiles } = await supabase.from('profiles').select('id')
  const everyoneElse = (allProfiles || []).map(p => p.id).filter(id => id !== user.id)

  switch (event) {
    case 'workout_logged': {
      const { points, workoutType } = payload
      const notif = { type: event, title: `${name} just logged a workout 💪`, body: `+${points} pts for ${workoutType}. Get off the couch.`, url: '/dashboard' }
      await Promise.all([sendPushToAll(everyoneElse, notif), saveNotifications(everyoneElse, notif)])
      break
    }
    case 'wager_proposed': {
      const { wagerTitle, participantIds } = payload
      const toNotify = (participantIds as string[]).filter(id => id !== user.id)
      const notif = { type: event, title: `${name} proposed a wager 🤝`, body: `"${wagerTitle}" — your acceptance is required.`, url: '/wagers' }
      await Promise.all([sendPushToAll(toNotify, notif), saveNotifications(toNotify, notif)])
      break
    }
    case 'wager_accepted': {
      const { wagerTitle, proposerId, allAccepted, participantIds } = payload
      if (allAccepted) {
        const toNotify = (participantIds as string[]).filter(id => id !== user.id)
        const notif = { type: event, title: 'Challenge is LIVE 🔥', body: `"${wagerTitle}" — everyone accepted. Game on.`, url: '/wagers' }
        await Promise.all([sendPushToAll(toNotify, notif), saveNotifications(toNotify, notif)])
      } else {
        const notif = { type: event, title: `${name} accepted your wager`, body: `"${wagerTitle}" — waiting for others.`, url: '/wagers' }
        await Promise.all([sendPushToUser(proposerId, notif), saveNotification(proposerId, notif)])
      }
      break
    }
    case 'wager_resolved': {
      const { wagerTitle, winner, participantIds } = payload
      const toNotify = (participantIds as string[]).filter(id => id !== user.id)
      const winnerText = winner === 'competitors' ? 'Workers won 🏆' : 'Motivators won 💅'
      const notif = { type: event, title: `Wager resolved: ${winnerText}`, body: `"${wagerTitle}" has been settled.`, url: '/wagers' }
      await Promise.all([sendPushToAll(toNotify, notif), saveNotifications(toNotify, notif)])
      break
    }
    case 'double_down_offered': {
      const { wagerTitle, workerIds } = payload
      const notif = { type: event, title: `Double down offered 💰`, body: `${name} wants to double down on "${wagerTitle}". Accept or decline.`, url: '/wagers' }
      await Promise.all([sendPushToAll(workerIds, notif), saveNotifications(workerIds, notif)])
      break
    }
    case 'comment_posted': {
      const { notifyUserIds, context } = payload
      const toNotify = (notifyUserIds as string[] || []).filter(id => id !== user.id)
      const notif = { type: event, title: `${name} left a comment 💬`, body: context || 'Trash talk incoming 🗑️', url: '/dashboard' }
      await Promise.all([sendPushToAll(toNotify, notif), saveNotifications(toNotify, notif)])
      break
    }
  }

  return NextResponse.json({ success: true })
}
