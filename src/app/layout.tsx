import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import PushNotificationPrompt from '@/components/PushNotificationPrompt'

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
    <html lang="en">
      <body className={`${inter.className} bg-gray-950 text-white min-h-screen`}>
        {children}
        <PushNotificationPrompt />
      </body>
    </html>
  )
}
