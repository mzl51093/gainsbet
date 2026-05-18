'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  { href: '/dashboard', label: 'Home', icon: '🏠' },
  { href: '/log-workout', label: 'Log', icon: '➕' },
  { href: '/wagers', label: 'Wagers', icon: '💰' },
  { href: '/notifications', label: 'Alerts', icon: '🔔' },
  { href: '/profile', label: 'Profile', icon: '👤' },
]

interface Props {
  pendingWagerCount?: number
}

export default function BottomNav({ pendingWagerCount = 0 }: Props) {
  const pathname = usePathname()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null

    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const fetchCount = async () => {
        const { count } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('read', false)
        setUnreadCount(count || 0)
      }

      await fetchCount()

      channel = supabase
        .channel('notif-badge')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, fetchCount)
        .subscribe()
    })()

    return () => {
      if (channel) {
        const supabase = createClient()
        supabase.removeChannel(channel)
      }
    }
  }, [pathname])

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 z-50">
      <div className="max-w-lg mx-auto flex">
        {navItems.map(item => {
          const active = pathname === item.href
          const showWagerBadge = item.href === '/wagers' && pendingWagerCount > 0
          const showNotifBadge = item.href === '/notifications' && unreadCount > 0
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex-1 flex flex-col items-center justify-center py-3 gap-0.5 transition-colors relative',
                active ? 'text-green-400' : 'text-gray-500'
              )}
            >
              <span className="text-xl leading-none relative">
                {item.icon}
                {showWagerBadge && (
                  <span className="absolute -top-1 -right-2 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold leading-none">
                    {pendingWagerCount}
                  </span>
                )}
                {showNotifBadge && (
                  <span className="absolute -top-1 -right-2 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold leading-none">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </span>
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
