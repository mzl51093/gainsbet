'use client'

import { usePathname } from 'next/navigation'
import BottomNav from './BottomNav'

const NAV_PATHS = [
  '/dashboard',
  '/log-workout',
  '/discover',
  '/wagers',
  '/notifications',
  '/profile',
  '/draft',
  '/player',
  '/duel',
]

export default function ConditionalBottomNav() {
  const pathname = usePathname()
  const show = NAV_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
  if (!show) return null
  return <BottomNav />
}
