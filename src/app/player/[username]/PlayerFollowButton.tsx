'use client'

import { useState } from 'react'

export default function PlayerFollowButton({
  userId,
  initial,
}: {
  userId: string
  initial: boolean
}) {
  const [following, setFollowing] = useState(initial)
  const [loading, setLoading] = useState(false)

  async function toggle() {
    setLoading(true)
    const res = await fetch('/api/follow-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    const data = await res.json()
    if (res.ok) setFollowing(data.following)
    setLoading(false)
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`px-5 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${
        following
          ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          : 'bg-green-500 hover:bg-green-400 text-black'
      }`}
    >
      {loading ? '...' : following ? 'Following ✓' : '+ Follow'}
    </button>
  )
}
