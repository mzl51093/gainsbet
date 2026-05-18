'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ActiveChallenge {
  id: string
  from_user_id: string
  exercise: string
  reps: number
  points: number
  expires_at: string
  created_at: string
  from_profile: { display_name: string }
}

interface OtherUser {
  id: string
  display_name: string
  username: string
  role: 'competitor' | 'partner'
}

interface SentChallenge {
  id: string
  to_user_id: string
  exercise: string
  reps: number
  points: number
  status: string
  expires_at: string
  created_at: string
  completed_at: string | null
  to_profile: { display_name: string }
}

interface Props {
  currentUserId: string
  otherUsers: OtherUser[]
  initialActiveChallenges: ActiveChallenge[]
  initialSentChallenges: SentChallenge[]
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function ChallengeCountdown({ expiresAt }: { expiresAt: string }) {
  const [timeLeft, setTimeLeft] = useState(() => Math.max(0, new Date(expiresAt).getTime() - Date.now()))

  useEffect(() => {
    const tick = () => setTimeLeft(Math.max(0, new Date(expiresAt).getTime() - Date.now()))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [expiresAt])

  if (timeLeft <= 0) {
    return <span className="text-red-400 font-mono font-bold text-sm">Expired</span>
  }

  const totalSeconds = Math.floor(timeLeft / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const isUrgent = timeLeft < 60 * 1000

  return (
    <span className={`font-mono font-bold text-sm ${isUrgent ? 'text-red-400' : 'text-yellow-400'}`}>
      {pad(minutes)}:{pad(seconds)}
    </span>
  )
}

const EXERCISES = [
  { label: 'Pushups', emoji: '💪' },
  { label: 'Squats', emoji: '🦵' },
  { label: 'Burpees', emoji: '🔥' },
  { label: 'Jumping Jacks', emoji: '⚡' },
]

const REPS_OPTIONS = [5, 10, 15, 20]
const POINTS_OPTIONS = [1, 2, 3]

export default function PokeSection({ currentUserId, otherUsers, initialActiveChallenges, initialSentChallenges }: Props) {
  const [activeChallenges, setActiveChallenges] = useState<ActiveChallenge[]>(initialActiveChallenges)
  const [sentChallenges, setSentChallenges] = useState<SentChallenge[]>(initialSentChallenges)
  const [toast, setToast] = useState<string | null>(null)

  // Per-user fun-poke disabled state (key = userId, value = true if disabled)
  const [pokedUsers, setPokedUsers] = useState<Record<string, boolean>>({})

  // Challenge modal state
  const [modalUser, setModalUser] = useState<OtherUser | null>(null)
  const [selectedExercise, setSelectedExercise] = useState('Pushups')
  const [selectedReps, setSelectedReps] = useState(10)
  const [selectedPoints, setSelectedPoints] = useState(1)
  const [sending, setSending] = useState(false)

  // Per-challenge uploading state
  const [uploadingId, setUploadingId] = useState<string | null>(null)

  // File input refs per challenge
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  function openModal(user: OtherUser) {
    setModalUser(user)
    setSelectedExercise('Pushups')
    setSelectedReps(10)
    setSelectedPoints(1)
    setSending(false)
  }

  function closeModal() {
    setModalUser(null)
  }

  async function sendFunPoke(userId: string) {
    setPokedUsers(prev => ({ ...prev, [userId]: true }))
    try {
      const res = await fetch('/api/pokes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toUserId: userId, type: 'fun' }),
      })
      if (res.ok) {
        showToast('Poked!')
      } else {
        showToast('Failed to poke')
      }
    } catch {
      showToast('Failed to poke')
    }
    setTimeout(() => {
      setPokedUsers(prev => ({ ...prev, [userId]: false }))
    }, 3000)
  }

  async function sendChallenge() {
    if (!modalUser || sending) return
    setSending(true)
    try {
      const res = await fetch('/api/pokes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toUserId: modalUser.id,
          type: 'challenge',
          exercise: selectedExercise,
          reps: selectedReps,
          points: selectedPoints,
        }),
      })
      if (res.ok) {
        closeModal()
        showToast('Challenge sent!')
      } else {
        const data = await res.json()
        showToast(data.error || 'Failed to send challenge')
        setSending(false)
      }
    } catch {
      showToast('Failed to send challenge')
      setSending(false)
    }
  }

  async function handleFileSelect(challenge: ActiveChallenge, file: File) {
    setUploadingId(challenge.id)
    try {
      const supabase = createClient()
      const path = `poke-challenges/${challenge.id}-${Date.now()}`
      const { error: uploadError } = await supabase.storage.from('proof').upload(path, file)
      if (uploadError) {
        showToast('Upload failed: ' + uploadError.message)
        setUploadingId(null)
        return
      }

      const { data: urlData } = supabase.storage.from('proof').getPublicUrl(path)
      const videoUrl = urlData.publicUrl

      const res = await fetch(`/api/pokes/${challenge.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl }),
      })

      if (res.ok) {
        setActiveChallenges(prev => prev.filter(c => c.id !== challenge.id))
        showToast('Challenge completed! 💪')
      } else {
        const data = await res.json()
        showToast(data.error || 'Failed to complete challenge')
      }
    } catch {
      showToast('Something went wrong')
    }
    setUploadingId(null)
  }

  const isChallengeExpired = (challenge: ActiveChallenge) =>
    new Date(challenge.expires_at).getTime() <= Date.now()

  return (
    <div className="space-y-4">
      {/* Section 1: Active incoming challenges */}
      {activeChallenges.length > 0 && (
        <div className="space-y-3">
          {activeChallenges.map(challenge => {
            const expired = isChallengeExpired(challenge)
            const uploading = uploadingId === challenge.id
            const ptLabel = challenge.points > 1 ? 's' : ''
            const name = challenge.from_profile?.display_name?.split(' ')[0] || 'Someone'

            return (
              <div
                key={challenge.id}
                className="bg-gray-900 border border-yellow-600/40 rounded-2xl p-4 space-y-3"
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <p className="text-yellow-400 font-semibold text-sm">
                    ⏱️ Challenge from {name}!
                  </p>
                  <ChallengeCountdown expiresAt={challenge.expires_at} />
                </div>

                {/* Body */}
                <p className="text-gray-300 text-sm">
                  {challenge.reps} {challenge.exercise} for {challenge.points} pt{ptLabel} — video required
                </p>

                {/* Record & Complete button */}
                <button
                  disabled={expired || uploading}
                  onClick={() => {
                    if (!expired && !uploading) {
                      fileRefs.current[challenge.id]?.click()
                    }
                  }}
                  className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-colors ${
                    expired
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : uploading
                      ? 'bg-green-700 text-green-200 cursor-wait'
                      : 'bg-green-500 hover:bg-green-400 text-black'
                  }`}
                >
                  {uploading ? 'Uploading…' : expired ? 'Expired' : '🎥 Record & Complete'}
                </button>

                {/* Hidden file input */}
                <input
                  type="file"
                  accept="video/*,image/*"
                  className="hidden"
                  ref={el => { fileRefs.current[challenge.id] = el }}
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) handleFileSelect(challenge, file)
                    // Reset input so same file can be re-selected
                    e.target.value = ''
                  }}
                />
              </div>
            )
          })}
        </div>
      )}

      {/* Section 1b: Challenges you sent */}
      {sentChallenges.length > 0 && (
        <div className="bg-gray-900 rounded-2xl p-4">
          <h2 className="text-white font-semibold mb-3">💪 Challenges Sent</h2>
          <div className="space-y-2">
            {sentChallenges.map(c => {
              const name = c.to_profile?.display_name?.split(' ')[0] || 'Someone'
              const isPending = c.status === 'pending' && new Date(c.expires_at).getTime() > Date.now()
              const isExpired = c.status === 'pending' && new Date(c.expires_at).getTime() <= Date.now()
              const isDone = c.status === 'completed'
              return (
                <div key={c.id} className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-300 truncate">
                      {name} — {c.reps} {c.exercise}
                    </p>
                    <p className="text-xs text-gray-600">{c.points} pt{c.points > 1 ? 's' : ''}</p>
                  </div>
                  <div className="shrink-0">
                    {isDone && <span className="text-green-400 text-xs font-semibold">✓ Done</span>}
                    {isPending && <ChallengeCountdown expiresAt={c.expires_at} />}
                    {isExpired && <span className="text-gray-600 text-xs">Expired</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Section 2: Poke someone */}
      {otherUsers.length > 0 && (
        <div className="bg-gray-900 rounded-2xl p-4">
          <h2 className="text-white font-semibold mb-3">👆 Poke</h2>
          <div className="space-y-2">
            {otherUsers.map(user => (
              <div key={user.id} className="flex items-center justify-between">
                <span className="text-gray-300 text-sm">{user.display_name}</span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={pokedUsers[user.id]}
                    onClick={() => sendFunPoke(user.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      pokedUsers[user.id]
                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                    }`}
                    title="Fun poke"
                  >
                    {pokedUsers[user.id] ? 'Poked!' : '👆'}
                  </button>
                  {user.role === 'competitor' && (
                    <button
                      onClick={() => openModal(user)}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium bg-amber-600/30 hover:bg-amber-600/50 text-amber-400 border border-amber-600/40 transition-colors"
                      title="Challenge poke"
                    >
                      💪
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Challenge modal */}
      {modalUser && (
        <div
          className="fixed inset-0 z-50 bg-black/60"
          onClick={e => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div className="absolute bottom-0 left-0 right-0 bg-gray-900 rounded-t-2xl p-6 pb-10 max-w-lg mx-auto space-y-5">
            {/* Modal title */}
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold text-lg">
                Challenge {modalUser.display_name.split(' ')[0]}
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-500 hover:text-gray-300 text-sm"
              >
                Cancel
              </button>
            </div>

            {/* Exercise picker */}
            <div>
              <p className="text-gray-400 text-xs mb-2 uppercase tracking-wide">Exercise</p>
              <div className="grid grid-cols-2 gap-2">
                {EXERCISES.map(ex => (
                  <button
                    key={ex.label}
                    onClick={() => setSelectedExercise(ex.label)}
                    className={`py-3 rounded-xl text-sm font-medium transition-colors border ${
                      selectedExercise === ex.label
                        ? 'border-green-500 bg-green-500/10 text-green-400'
                        : 'border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    {ex.emoji} {ex.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Reps picker */}
            <div>
              <p className="text-gray-400 text-xs mb-2 uppercase tracking-wide">Reps</p>
              <div className="flex gap-2">
                {REPS_OPTIONS.map(r => (
                  <button
                    key={r}
                    onClick={() => setSelectedReps(r)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors border ${
                      selectedReps === r
                        ? 'border-green-500 bg-green-500/10 text-green-400'
                        : 'border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Points picker */}
            <div>
              <p className="text-gray-400 text-xs mb-2 uppercase tracking-wide">Points</p>
              <div className="flex gap-2">
                {POINTS_OPTIONS.map(p => (
                  <button
                    key={p}
                    onClick={() => setSelectedPoints(p)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors border ${
                      selectedPoints === p
                        ? 'border-green-500 bg-green-500/10 text-green-400'
                        : 'border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    {p} pt{p > 1 ? 's' : ''}
                  </button>
                ))}
              </div>
            </div>

            {/* Note */}
            <p className="text-gray-500 text-xs text-center">
              They have 10 minutes with video proof
            </p>

            {/* Send button */}
            <button
              disabled={sending}
              onClick={sendChallenge}
              className={`w-full py-3 rounded-xl font-bold text-sm transition-colors ${
                sending
                  ? 'bg-green-700 text-green-200 cursor-wait'
                  : 'bg-green-500 hover:bg-green-400 text-black'
              }`}
            >
              {sending ? 'Sending…' : 'Send Challenge 🚀'}
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 right-4 z-50 bg-gray-800 text-white text-sm px-4 py-2 rounded-full shadow-lg border border-gray-700 pointer-events-none">
          {toast}
        </div>
      )}
    </div>
  )
}
