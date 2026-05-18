'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatRelativeTime } from '@/lib/utils'
import { PushToggle } from '@/components/PushNotificationPrompt'
import type { Profile, Workout } from '@/lib/types'

interface Props {
  profile: Profile
  stats: {
    totalPoints: number
    weekPoints: number
    totalWorkouts: number
    withProof: number
    weekGoal: number
  }
  recentWorkouts: Workout[]
  workoutTypes: readonly { value: string; label: string; ptsPerHour: number; emoji: string }[]
}

export default function ProfileClient({ profile, stats, recentWorkouts, workoutTypes }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [displayName, setDisplayName] = useState(profile.display_name)
  const [saving, setSaving] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [testingPush, setTestingPush] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [announcing, setAnnouncing] = useState(false)

  async function handleAnnounce() {
    setAnnouncing(true)
    try {
      const res = await fetch('/api/push/announce', { method: 'POST' })
      const json = await res.json()
      if (res.ok) setTestResult(`Announcement sent to ${json.sent} users!`)
      else setTestResult(`Failed: ${json.error}`)
    } catch {
      setTestResult('Network error')
    } finally {
      setAnnouncing(false)
    }
  }

  async function handleTestNotification() {
    setTestingPush(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/push/test', { method: 'POST' })
      const json = await res.json()
      if (res.ok) {
        setTestResult('Sent! Check for a notification.')
      } else {
        setTestResult(`Failed: ${json.error}`)
      }
    } catch {
      setTestResult('Network error — try again.')
    } finally {
      setTestingPush(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    await supabase.from('profiles').update({ display_name: displayName }).eq('id', profile.id)
    setEditing(false)
    setSaving(false)
    router.refresh()
  }

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  const weekPct = Math.min(100, (stats.weekPoints / stats.weekGoal) * 100)

  return (
    <div className="space-y-6">
      {/* Profile card */}
      <div className="bg-gray-900 rounded-2xl p-5">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-blue-600 flex items-center justify-center text-2xl font-bold text-white">
            {profile.display_name[0].toUpperCase()}
          </div>
          <div className="flex-1">
            {editing ? (
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-1 text-white w-full focus:outline-none focus:border-green-500"
              />
            ) : (
              <h2 className="text-xl font-bold text-white">{profile.display_name}</h2>
            )}
            <p className="text-gray-500 text-sm">@{profile.username}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium mt-1 inline-block ${
              profile.role === 'competitor'
                ? 'bg-green-900/40 text-green-400'
                : 'bg-purple-900/40 text-purple-400'
            }`}>
              {profile.role === 'competitor' ? '🏋️ Competitor' : '👀 Accountability Partner'}
            </span>
          </div>
        </div>

        {editing ? (
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-green-500 hover:bg-green-400 text-black font-bold py-2 rounded-xl text-sm transition-colors"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => { setEditing(false); setDisplayName(profile.display_name) }}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-xl text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 py-2 rounded-xl text-sm transition-colors"
          >
            Edit Name
          </button>
        )}
      </div>

      {/* This week */}
      <div className="bg-gray-900 rounded-2xl p-5">
        <h3 className="text-white font-semibold mb-3">This Week</h3>
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-400 text-sm">Progress</span>
          <span className={`font-bold ${stats.weekPoints >= stats.weekGoal ? 'text-green-400' : 'text-white'}`}>
            {stats.weekPoints} / {stats.weekGoal} pts
          </span>
        </div>
        <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${stats.weekPoints >= stats.weekGoal ? 'bg-green-500' : 'bg-blue-500'}`}
            style={{ width: `${weekPct}%` }}
          />
        </div>
        {stats.weekPoints >= stats.weekGoal && (
          <p className="text-green-400 text-sm mt-2 text-center">Goal reached! 🎉</p>
        )}
      </div>

      {/* All-time stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-900 rounded-2xl p-4 text-center">
          <p className="text-2xl font-bold text-white">{stats.totalPoints}</p>
          <p className="text-xs text-gray-500 mt-1">Total Points</p>
        </div>
        <div className="bg-gray-900 rounded-2xl p-4 text-center">
          <p className="text-2xl font-bold text-white">{stats.totalWorkouts}</p>
          <p className="text-xs text-gray-500 mt-1">Workouts</p>
        </div>
        <div className="bg-gray-900 rounded-2xl p-4 text-center">
          <p className="text-2xl font-bold text-white">{stats.withProof}</p>
          <p className="text-xs text-gray-500 mt-1">Proven 📸</p>
        </div>
      </div>

      {/* Recent workouts */}
      {recentWorkouts.length > 0 && (
        <div>
          <h3 className="text-white font-semibold mb-3">Recent Workouts</h3>
          <div className="space-y-2">
            {recentWorkouts.map(workout => {
              const wType = workoutTypes.find(t => t.value === workout.workout_type)
              return (
                <div key={workout.id} className="bg-gray-900 rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{wType?.emoji || '💪'}</span>
                    <div>
                      <p className="text-white text-sm font-medium">{wType?.label || workout.workout_type}</p>
                      <p className="text-gray-500 text-xs">{workout.duration_minutes}min · {formatRelativeTime(workout.logged_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {workout.proof_url && <span className="text-sm">📸</span>}
                    <span className="text-green-400 font-bold text-sm">+{workout.points}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Notifications */}
      <div className="bg-gray-900 rounded-2xl p-5 space-y-3">
        <h3 className="text-white font-semibold">Notifications</h3>
        <PushToggle />
        <button
          onClick={handleTestNotification}
          disabled={testingPush}
          className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 py-2 rounded-xl text-sm transition-colors disabled:opacity-50"
        >
          {testingPush ? 'Sending...' : 'Send me a test notification'}
        </button>
        <button
          onClick={handleAnnounce}
          disabled={announcing}
          className="w-full bg-blue-900/40 hover:bg-blue-900/60 text-blue-400 border border-blue-800/50 py-2 rounded-xl text-sm transition-colors disabled:opacity-50"
        >
          {announcing ? 'Sending...' : '📣 Announce new features to everyone'}
        </button>
        {testResult && (
          <p className={`text-xs text-center ${testResult.startsWith('Sent') ? 'text-green-400' : 'text-red-400'}`}>
            {testResult}
          </p>
        )}
      </div>

      {/* Sign out */}
      <button
        onClick={handleSignOut}
        disabled={signingOut}
        className="w-full bg-gray-900 hover:bg-gray-800 border border-gray-700 text-red-400 font-medium py-3 rounded-xl transition-colors"
      >
        {signingOut ? 'Signing out...' : 'Sign Out'}
      </button>
    </div>
  )
}
