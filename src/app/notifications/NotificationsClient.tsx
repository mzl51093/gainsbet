'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatRelativeTime } from '@/lib/utils'

interface Notification {
  id: string
  type: string
  title: string
  body: string
  url: string
  read: boolean
  created_at: string
}

const TYPE_ICON: Record<string, string> = {
  workout_logged: '💪',
  comment_posted: '💬',
  wager_proposed: '🤝',
  wager_accepted: '✅',
  wager_resolved: '🏆',
  double_down_offered: '💰',
}

export default function NotificationsClient({ initialNotifications, currentUserId }: { initialNotifications: Notification[], currentUserId: string }) {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications)

  // Mark all unread as read on mount
  useEffect(() => {
    const unreadIds = initialNotifications.filter(n => !n.read).map(n => n.id)
    if (!unreadIds.length) return
    const supabase = createClient()
    supabase.from('notifications').update({ read: true }).in('id', unreadIds).then(() => {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    })
  }, [])

  // Realtime: new notifications while on this page
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('notifications-page')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${currentUserId}`,
      }, ({ new: notif }: any) => {
        setNotifications(prev => [{ ...notif, read: true }, ...prev])
        supabase.from('notifications').update({ read: true }).eq('id', notif.id)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [currentUserId])

  function handleTap(notif: Notification) {
    router.push(notif.url)
  }

  if (notifications.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-4xl mb-3">🔔</p>
        <p className="text-gray-500">No notifications yet.</p>
        <p className="text-gray-600 text-sm mt-1">When someone logs a workout, proposes a wager, or talks trash, it&apos;ll show up here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {notifications.map(notif => (
        <button
          key={notif.id}
          onClick={() => handleTap(notif)}
          className={`w-full text-left flex items-start gap-3 px-3 py-3 rounded-xl transition-colors ${
            notif.read ? 'bg-transparent hover:bg-gray-900' : 'bg-gray-900 hover:bg-gray-800'
          }`}
        >
          <span className="text-2xl mt-0.5 shrink-0">{TYPE_ICON[notif.type] || '🔔'}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className={`text-sm font-semibold leading-snug ${notif.read ? 'text-gray-400' : 'text-white'}`}>
                {notif.title}
              </p>
              {!notif.read && <span className="shrink-0 w-2 h-2 rounded-full bg-green-400 mt-1.5" />}
            </div>
            <p className={`text-sm mt-0.5 leading-snug ${notif.read ? 'text-gray-600' : 'text-gray-400'}`}>
              {notif.body}
            </p>
            <p className="text-xs text-gray-700 mt-1">{formatRelativeTime(notif.created_at)}</p>
          </div>
        </button>
      ))}
    </div>
  )
}
