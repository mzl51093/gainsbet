import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import PushNotificationPrompt from '@/components/PushNotificationPrompt'
import ConditionalBottomNav from '@/components/ConditionalBottomNav'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'GainsBet — Workout Competition',
  description: 'Compete, prove it, collect the glory.',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} bg-gray-950 text-white h-full flex flex-col`}>
        <div className="flex-1 overflow-y-auto min-h-0">
          {children}
          <PushNotificationPrompt />
        </div>
        <ConditionalBottomNav />
      </body>
    </html>
  )
}
