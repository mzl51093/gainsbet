'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Home', icon: '🏠' },
  { href: '/log-workout', label: 'Log', icon: '➕' },
  { href: '/wagers', label: 'Wagers', icon: '💰' },
  { href: '/profile', label: 'Profile', icon: '👤' },
]

interface Props {
  pendingWagerCount?: number
}

export default function BottomNav({ pendingWagerCount = 0 }: Props) {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 z-50">
      <div className="max-w-lg mx-auto flex">
        {navItems.map(item => {
          const active = pathname === item.href
          const showBadge = item.href === '/wagers' && pendingWagerCount > 0
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
                {showBadge && (
                  <span className="absolute -top-1 -right-2 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold leading-none">
                    {pendingWagerCount}
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
