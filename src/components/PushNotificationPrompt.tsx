'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff, X } from 'lucide-react'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export default function PushNotificationPrompt() {
  const [supported, setSupported] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    setSupported(true)

    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => null)

    setDismissed(localStorage.getItem('push-dismissed') === '1')
  }, [])

  async function subscribe() {
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ),
      })
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      })
      setSubscribed(true)
    } catch (e) {
      console.error('Push subscribe failed', e)
    } finally {
      setLoading(false)
    }
  }

  async function unsubscribe() {
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setSubscribed(false)
    } finally {
      setLoading(false)
    }
  }

  function dismiss() {
    localStorage.setItem('push-dismissed', '1')
    setDismissed(true)
  }

  if (!supported || subscribed || dismissed) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 bg-gray-800 border border-gray-700 rounded-xl p-4 shadow-lg flex items-start gap-3">
      <Bell className="text-green-400 mt-0.5 shrink-0" size={20} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">Enable notifications</p>
        <p className="text-xs text-gray-400 mt-0.5">Get alerted when rivals log workouts, wagers are proposed, and trash talk lands.</p>
        <div className="flex gap-2 mt-3">
          <button
            onClick={subscribe}
            disabled={loading}
            className="bg-green-500 hover:bg-green-400 text-white text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50"
          >
            {loading ? 'Enabling…' : 'Enable'}
          </button>
          <button
            onClick={dismiss}
            className="text-gray-400 hover:text-white text-xs px-3 py-1.5"
          >
            Not now
          </button>
        </div>
      </div>
      <button onClick={dismiss} className="text-gray-500 hover:text-white shrink-0">
        <X size={16} />
      </button>
    </div>
  )
}

export function PushToggle() {
  const [supported, setSupported] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    setSupported(true)
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => null)
  }, [])

  async function toggle() {
    setLoading(true)
    if (subscribed) {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setSubscribed(false)
    } else {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      })
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      })
      setSubscribed(true)
    }
    setLoading(false)
  }

  if (!supported) return null

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className="flex items-center gap-2 text-sm text-gray-300 hover:text-white disabled:opacity-50"
    >
      {subscribed ? <Bell size={16} className="text-green-400" /> : <BellOff size={16} />}
      {subscribed ? 'Notifications on' : 'Enable notifications'}
    </button>
  )
}
