'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DraftTutorial, { hasDraftTutorialBeenSeen } from '@/components/DraftTutorial'
import DraftChat from './DraftChat'
import DraftKickoffModal, { hasKickoffBeenSeen } from './DraftKickoffModal'
import DraftInvitePanel from './DraftInvitePanel'

interface Profile {
  id: string
  display_name: string
  username: string
  avatar_url?: string | null
  venmo_username?: string | null
}

interface Participant {
  id: string
  user_id: string
  competition_id: string
  team: string | null
  joined_at: string
  profiles: Profile
}

interface Competition {
  id: string
  name: string
  status: string
  point_goal: number
  min_contribution_pct: number
  wager_description: string | null
  start_date: string | null
  end_date: string | null
  captain_a_id: string | null
  captain_b_id: string | null
  winner_team: string | null
  max_participants: number
  pick_number: number
  created_by: string
}

interface Workout {
  id: string
  user_id: string
  points: number
  notes: string | null
  duration_minutes: number
  workout_type: string
  logged_at: string
  validation_status: string
  draft_competition_id: string | null
  profiles: { display_name: string; username: string }
}

interface ChatMessage {
  id: string
  user_id: string
  channel: string
  content: string
  created_at: string
  profiles: { display_name: string; username: string } | null
}

interface InviteProfile {
  id: string
  display_name: string
  username: string
}

interface Props {
  competition: Competition
  participants: Participant[]
  voteCounts: Record<string, number>
  voterIds: string[]
  workouts: Workout[]
  pendingWorkouts: Workout[]
  currentUserId: string
  competitionId: string
  myTeam: 'a' | 'b' | null
  initialGroupMessages: ChatMessage[]
  initialTeamMessages: ChatMessage[]
  allProfiles: InviteProfile[]
  invitedIds: string[]
}

function getPickerForPick(
  pickNumber: number,
  captainAId: string,
  captainBId: string
): string {
  const round = Math.floor(pickNumber / 2)
  const posInRound = pickNumber % 2
  if (round % 2 === 0) {
    return posInRound === 0 ? captainAId : captainBId
  } else {
    return posInRound === 0 ? captainBId : captainAId
  }
}

// ── Recruiting Phase ──────────────────────────────────────────────────────────

function RecruitingPhase({
  competition,
  participants,
  currentUserId,
  competitionId,
  onJoined,
  allProfiles,
  invitedIds,
}: {
  competition: Competition
  participants: Participant[]
  currentUserId: string
  competitionId: string
  onJoined: () => void
  allProfiles: InviteProfile[]
  invitedIds: string[]
}) {
  const [showTutorial, setShowTutorial] = useState(false)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [editingSize, setEditingSize] = useState(false)
  const [newSize, setNewSize] = useState(competition.max_participants)
  const [sizeError, setSizeError] = useState('')
  const [savingSize, setSavingSize] = useState(false)

  const isOrganizer = currentUserId === competition.created_by
  const isJoined = participants.some((p) => p.user_id === currentUserId)
  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/draft/${competitionId}`
      : `/draft/${competitionId}`

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for HTTP or browsers without clipboard API
      const el = document.createElement('textarea')
      el.value = shareUrl
      el.style.position = 'fixed'
      el.style.opacity = '0'
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  async function joinCompetition() {
    setJoining(true)
    setError('')
    try {
      const res = await fetch(`/api/draft/${competitionId}/join`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to join')
        return
      }
      onJoined()
    } catch {
      setError('Something went wrong.')
    } finally {
      setJoining(false)
    }
  }

  function handleEnterDraft() {
    if (hasDraftTutorialBeenSeen()) {
      joinCompetition()
    } else {
      setShowTutorial(true)
    }
  }

  async function saveSize() {
    if (newSize === competition.max_participants) { setEditingSize(false); return }
    setSavingSize(true)
    setSizeError('')
    try {
      const res = await fetch(`/api/draft/${competitionId}/update-size`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxParticipants: newSize }),
      })
      const data = await res.json()
      if (!res.ok) { setSizeError(data.error || 'Failed to update'); return }
      setEditingSize(false)
      onJoined() // triggers router.refresh()
    } catch {
      setSizeError('Something went wrong.')
    } finally {
      setSavingSize(false)
    }
  }

  return (
    <>
      {showTutorial && (
        <DraftTutorial
          pointGoal={competition.point_goal}
          onDismiss={() => {
            setShowTutorial(false)
            joinCompetition()
          }}
        />
      )}

      <div className="space-y-4">
        <div className="bg-gray-900 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold">Players</h2>
            {editingSize ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={newSize}
                  min={participants.length}
                  max={20}
                  onChange={e => setNewSize(Math.max(participants.length, parseInt(e.target.value) || participants.length))}
                  className="w-14 bg-gray-800 text-white text-sm text-center rounded-lg px-2 py-1 border border-gray-600 focus:border-green-500 focus:outline-none"
                />
                <button
                  onClick={saveSize}
                  disabled={savingSize}
                  className="text-xs bg-green-600 hover:bg-green-500 disabled:opacity-50 text-black font-bold px-3 py-1 rounded-lg transition-colors"
                >
                  {savingSize ? '...' : 'Save'}
                </button>
                <button
                  onClick={() => { setEditingSize(false); setNewSize(competition.max_participants); setSizeError('') }}
                  className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-sm">
                  {participants.length}/{competition.max_participants} joined
                </span>
                {isOrganizer && (
                  <button
                    onClick={() => { setEditingSize(true); setNewSize(competition.max_participants) }}
                    className="text-gray-600 hover:text-gray-300 text-xs transition-colors"
                    title="Change lobby size"
                  >
                    ✏️
                  </button>
                )}
              </div>
            )}
          </div>

          {sizeError && (
            <p className="text-red-400 text-xs mb-3">{sizeError}</p>
          )}

          {/* Progress bar */}
          <div className="h-1.5 bg-gray-800 rounded-full mb-5">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{
                width: `${(participants.length / competition.max_participants) * 100}%`,
              }}
            />
          </div>

          <div className="space-y-2">
            {participants.map((p) => (
              <div key={p.user_id} className="flex items-center gap-3 py-1">
                <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold text-white">
                  {p.profiles.display_name[0]}
                </div>
                <span className="text-gray-300 text-sm">{p.profiles.display_name}</span>
                {p.user_id === competition.created_by && (
                  <span className="text-xs text-gray-600">organizer</span>
                )}
                {p.user_id === currentUserId && (
                  <span className="text-xs text-green-500">you</span>
                )}
              </div>
            ))}

            {/* Empty slots */}
            {Array.from({ length: competition.max_participants - participants.length }).map(
              (_, i) => (
                <div key={`empty-${i}`} className="flex items-center gap-3 py-1 opacity-30">
                  <div className="w-8 h-8 rounded-full border border-dashed border-gray-600 flex items-center justify-center">
                    <span className="text-gray-600 text-xs">?</span>
                  </div>
                  <span className="text-gray-600 text-sm">Waiting...</span>
                </div>
              )
            )}
          </div>
        </div>

        {!isJoined ? (
          <div className="bg-gray-900 rounded-2xl p-5">
            <h3 className="text-white font-semibold mb-1">Ready to compete?</h3>
            <p className="text-gray-500 text-sm mb-4">
              Goal: {competition.point_goal} pts. Every member must hit at least{' '}
              {competition.min_contribution_pct}%.
              {competition.wager_description && (
                <> Stakes: {competition.wager_description}</>
              )}
            </p>
            {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
            <button
              onClick={handleEnterDraft}
              disabled={joining}
              className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-bold py-3 rounded-xl text-sm transition-colors"
            >
              {joining ? 'Joining...' : 'Enter the Draft'}
            </button>
          </div>
        ) : (
          <>
            {participants.length < competition.max_participants && (
              <div className="bg-gray-900 rounded-2xl p-4 text-center">
                <p className="text-gray-500 text-sm">
                  Waiting for {competition.max_participants - participants.length} more player{competition.max_participants - participants.length === 1 ? '' : 's'}…
                </p>
              </div>
            )}

            {/* Invite friends — prominent, above the link */}
            <DraftInvitePanel
              competitionId={competitionId}
              participantIds={participants.map(p => p.user_id)}
              initialInvitedIds={invitedIds}
              allProfiles={allProfiles}
            />

            {/* Share link — kept as fallback */}
            <div className="bg-gray-900 rounded-2xl p-4">
              <p className="text-gray-500 text-xs mb-2">Or share link directly</p>
              <div className="flex gap-2">
                <code className="flex-1 bg-gray-800 text-gray-400 rounded-lg px-3 py-2 text-xs truncate">
                  {shareUrl}
                </code>
                <button
                  onClick={copyLink}
                  className={`px-3 py-2 rounded-lg text-xs transition-colors ${copied ? 'bg-green-700 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'}`}
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}

// ── Voting Phase ──────────────────────────────────────────────────────────────

function VotingPhase({
  competition,
  participants,
  currentUserId,
  competitionId,
  voterIds,
  voteCounts,
  onVoted,
}: {
  competition: Competition
  participants: Participant[]
  currentUserId: string
  competitionId: string
  voterIds: string[]
  voteCounts: Record<string, number>
  onVoted: () => void
}) {
  const [selected, setSelected] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const hasVoted = voterIds.includes(currentUserId)
  const allVoted = voterIds.length >= participants.length
  const showResults = allVoted

  async function submitVote() {
    if (!selected) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/draft/${competitionId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ votedForId: selected }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to vote')
        return
      }
      onVoted()
    } catch {
      setError('Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-gray-900 rounded-2xl p-5">
        <h2 className="text-white font-semibold mb-1">Vote for Captain</h2>
        <p className="text-gray-500 text-sm mb-4">
          Top 2 vote-getters become team captains. You cannot vote for yourself.
          {voterIds.length < participants.length && (
            <> {voterIds.length}/{participants.length} voted so far.</>
          )}
        </p>

        {/* Who has / hasn't voted yet */}
        {!showResults && (
          <div className="mb-4 space-y-1">
            {participants.map(p => {
              const voted = voterIds.includes(p.user_id)
              const isMe = p.user_id === currentUserId
              return (
                <div
                  key={p.user_id}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl ${
                    voted ? 'bg-green-900/20' : 'bg-gray-800/60'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    voted ? 'bg-green-700 text-white' : 'bg-gray-700 text-gray-500'
                  }`}>
                    {voted ? '✓' : '–'}
                  </div>
                  <span className={`text-sm flex-1 ${voted ? 'text-white' : 'text-gray-400'}`}>
                    {p.profiles.display_name}{isMe ? ' (you)' : ''}
                  </span>
                  <span className={`text-xs font-medium ${voted ? 'text-green-400' : 'text-gray-600'}`}>
                    {voted ? 'Voted' : 'Not yet'}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {hasVoted && !showResults && (
          <div className="bg-green-900/20 border border-green-700/40 rounded-xl px-4 py-3 mb-4">
            <p className="text-green-400 text-sm">Vote cast! Waiting for others...</p>
          </div>
        )}

        {!hasVoted && (
          <div className="space-y-2 mb-4">
            {participants
              .filter((p) => p.user_id !== currentUserId)
              .map((p) => (
                <button
                  key={p.user_id}
                  onClick={() => setSelected(p.user_id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left ${
                    selected === p.user_id
                      ? 'bg-green-900/30 border-green-600'
                      : 'bg-gray-800 border-transparent hover:border-gray-600'
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                    {p.profiles.display_name[0]}
                  </div>
                  <span className="text-white text-sm font-medium">{p.profiles.display_name}</span>
                  {selected === p.user_id && (
                    <span className="ml-auto text-green-400 text-lg">✓</span>
                  )}
                </button>
              ))}
          </div>
        )}

        {showResults && (
          <div className="space-y-2 mb-4">
            {participants
              .sort(
                (a, b) => (voteCounts[b.user_id] || 0) - (voteCounts[a.user_id] || 0)
              )
              .map((p, i) => {
                const votes = voteCounts[p.user_id] || 0
                const isCaptain =
                  p.user_id === competition.captain_a_id ||
                  p.user_id === competition.captain_b_id
                return (
                  <div
                    key={p.user_id}
                    className={`flex items-center gap-3 p-3 rounded-xl ${
                      isCaptain ? 'bg-green-900/20 border border-green-700/40' : 'bg-gray-800'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold text-white">
                      {p.profiles.display_name[0]}
                    </div>
                    <span className="text-white text-sm flex-1">{p.profiles.display_name}</span>
                    <span className="text-gray-400 text-sm">{votes} vote{votes !== 1 ? 's' : ''}</span>
                    {isCaptain && <span className="text-yellow-400 text-sm">Captain</span>}
                  </div>
                )
              })}
          </div>
        )}

        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

        {!hasVoted && (
          <button
            onClick={submitVote}
            disabled={!selected || submitting}
            className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold py-3 rounded-xl text-sm transition-colors"
          >
            {submitting ? 'Submitting...' : 'Cast Vote'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Drafting Phase ────────────────────────────────────────────────────────────

function DraftingPhase({
  competition,
  participants,
  currentUserId,
  competitionId,
  onPicked,
}: {
  competition: Competition
  participants: Participant[]
  currentUserId: string
  competitionId: string
  onPicked: () => void
}) {
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState('')

  const captainAId = competition.captain_a_id!
  const captainBId = competition.captain_b_id!
  const currentPickerId = getPickerForPick(competition.pick_number, captainAId, captainBId)
  const isMyTurn = currentUserId === currentPickerId

  const teamA = participants.filter((p) => p.team === 'a')
  const teamB = participants.filter((p) => p.team === 'b')
  const available = participants.filter(
    (p) => p.team === null
  )

  const captainAName =
    participants.find((p) => p.user_id === captainAId)?.profiles.display_name || 'Captain A'
  const captainBName =
    participants.find((p) => p.user_id === captainBId)?.profiles.display_name || 'Captain B'
  const currentPickerName =
    participants.find((p) => p.user_id === currentPickerId)?.profiles.display_name ||
    'Captain'

  async function makePick(pickedUserId: string) {
    setPicking(true)
    setError('')
    try {
      const res = await fetch(`/api/draft/${competitionId}/pick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pickedUserId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to make pick')
        return
      }
      onPicked()
    } catch {
      setError('Something went wrong.')
    } finally {
      setPicking(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Current turn indicator */}
      <div
        className={`rounded-2xl p-4 ${
          isMyTurn
            ? 'bg-green-900/30 border border-green-600'
            : 'bg-gray-900 border border-gray-700'
        }`}
      >
        <p className="text-sm text-gray-400">
          {isMyTurn ? (
            <span className="text-green-400 font-semibold">Your turn to pick!</span>
          ) : (
            <>
              Waiting for{' '}
              <span className="text-white font-medium">{currentPickerName}</span> to pick...
            </>
          )}
        </p>
        <p className="text-xs text-gray-600 mt-0.5">
          Pick #{competition.pick_number + 1} of {participants.length - 2}
        </p>
      </div>

      {/* Draft board */}
      <div className="grid grid-cols-2 gap-3">
        {/* Team A */}
        <div className="bg-gray-900 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-white text-sm font-semibold">{captainAName}</span>
          </div>
          <div className="space-y-2">
            {teamA.map((p) => (
              <div key={p.user_id} className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-900/40 flex items-center justify-center text-xs font-bold text-blue-300">
                  {p.profiles.display_name[0]}
                </div>
                <span className="text-gray-300 text-xs">
                  {p.profiles.display_name.split(' ')[0]}
                  {p.user_id === captainAId && (
                    <span className="text-blue-400 ml-1">C</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Team B */}
        <div className="bg-gray-900 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-white text-sm font-semibold">{captainBName}</span>
          </div>
          <div className="space-y-2">
            {teamB.map((p) => (
              <div key={p.user_id} className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-red-900/40 flex items-center justify-center text-xs font-bold text-red-300">
                  {p.profiles.display_name[0]}
                </div>
                <span className="text-gray-300 text-xs">
                  {p.profiles.display_name.split(' ')[0]}
                  {p.user_id === captainBId && (
                    <span className="text-red-400 ml-1">C</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Available players */}
      {available.length > 0 && (
        <div className="bg-gray-900 rounded-2xl p-4">
          {available.length === 1 ? (
            /* Last player — no decision needed, auto-pick */
            <div className="text-center">
              <p className="text-gray-400 text-xs mb-3">Last player remaining — auto-pick!</p>
              <div className="flex items-center gap-3 bg-gray-800 rounded-xl px-4 py-3 mb-4">
                <div className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold text-white">
                  {available[0].profiles.display_name[0]}
                </div>
                <span className="text-white text-sm flex-1 text-left">{available[0].profiles.display_name}</span>
              </div>
              {isMyTurn && (
                <button
                  onClick={() => makePick(available[0].user_id)}
                  disabled={picking}
                  className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-bold py-3 rounded-xl text-sm transition-colors"
                >
                  {picking ? 'Locking in...' : '⚡ Lock In Rosters — LET\'S GO'}
                </button>
              )}
              {!isMyTurn && (
                <p className="text-gray-500 text-sm">
                  <span className="text-white font-medium">{currentPickerName}</span> is locking in the last pick...
                </p>
              )}
            </div>
          ) : (
            <>
              <h3 className="text-white text-sm font-semibold mb-3">
                Available Players ({available.length})
              </h3>
              <div className="space-y-2">
                {available.map((p) => (
                  <div key={p.user_id} className="flex items-center gap-3 py-1.5">
                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold text-white">
                      {p.profiles.display_name[0]}
                    </div>
                    <span className="text-gray-300 text-sm flex-1">{p.profiles.display_name}</span>
                    {isMyTurn && (
                      <button
                        onClick={() => makePick(p.user_id)}
                        disabled={picking}
                        className="bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-bold px-4 py-1.5 rounded-lg text-xs transition-colors"
                      >
                        Pick
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
          {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
        </div>
      )}
    </div>
  )
}

// ── Configure Phase ────────────────────────────────────────────────────────────

function ConfigurePhase({
  competition,
  participants,
  currentUserId,
  competitionId,
  onConfigured,
}: {
  competition: Competition
  participants: Participant[]
  currentUserId: string
  competitionId: string
  onConfigured: () => void
}) {
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [endDate, setEndDate] = useState('')
  const [pointGoal, setPointGoal] = useState(competition.point_goal)
  const [wagerDesc, setWagerDesc] = useState(competition.wager_description || '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const isCaptain =
    currentUserId === competition.captain_a_id ||
    currentUserId === competition.captain_b_id

  const captainAName =
    participants.find((p) => p.user_id === competition.captain_a_id)?.profiles.display_name ||
    'Captain A'
  const captainBName =
    participants.find((p) => p.user_id === competition.captain_b_id)?.profiles.display_name ||
    'Captain B'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/draft/${competitionId}/configure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate,
          endDate: endDate || undefined,
          pointGoal,
          wagerDescription: wagerDesc || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to configure')
        return
      }
      onConfigured()
    } catch {
      setError('Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  // Show teams
  const teamA = participants.filter((p) => p.team === 'a')
  const teamB = participants.filter((p) => p.team === 'b')

  return (
    <div className="space-y-4">
      {/* Teams summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-900 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-blue-400 text-sm font-semibold">{captainAName}</span>
          </div>
          {teamA.map((p) => (
            <p key={p.user_id} className="text-gray-400 text-xs py-0.5">
              {p.profiles.display_name.split(' ')[0]}
              {p.user_id === competition.captain_a_id && ' (C)'}
            </p>
          ))}
        </div>
        <div className="bg-gray-900 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-red-400 text-sm font-semibold">{captainBName}</span>
          </div>
          {teamB.map((p) => (
            <p key={p.user_id} className="text-gray-400 text-xs py-0.5">
              {p.profiles.display_name.split(' ')[0]}
              {p.user_id === competition.captain_b_id && ' (C)'}
            </p>
          ))}
        </div>
      </div>

      {isCaptain ? (
        <div className="bg-gray-900 rounded-2xl p-5">
          <h2 className="text-white font-semibold mb-1">Configure Competition</h2>
          <p className="text-gray-500 text-sm mb-4">Set the dates and finalize the goal.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="text-gray-400 text-xs block mb-1.5">Start Date *</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="w-full bg-gray-800 text-white rounded-xl px-4 py-2.5 text-sm border border-gray-700 focus:border-green-500 focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="text-gray-400 text-xs block mb-1.5">
                End Date <span className="text-gray-600">(optional)</span>
              </span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                className="w-full bg-gray-800 text-white rounded-xl px-4 py-2.5 text-sm border border-gray-700 focus:border-green-500 focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="text-gray-400 text-xs block mb-1.5">Point Goal</span>
              <input
                type="number"
                value={pointGoal}
                onChange={(e) => setPointGoal(Math.max(1, parseInt(e.target.value) || 1))}
                min={1}
                className="w-full bg-gray-800 text-white rounded-xl px-4 py-2.5 text-sm border border-gray-700 focus:border-green-500 focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="text-gray-400 text-xs block mb-1.5">
                What's at stake? <span className="text-gray-600">(optional)</span>
              </span>
              <textarea
                value={wagerDesc}
                onChange={(e) => setWagerDesc(e.target.value)}
                rows={2}
                className="w-full bg-gray-800 text-white rounded-xl px-4 py-2.5 text-sm border border-gray-700 focus:border-green-500 focus:outline-none resize-none"
              />
            </label>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-bold py-3 rounded-xl text-sm transition-colors"
            >
              {submitting ? 'Starting...' : 'Start Competition!'}
            </button>
          </form>
        </div>
      ) : (
        <div className="bg-gray-900 rounded-2xl p-5 text-center">
          <div className="text-4xl mb-3">⏳</div>
          <p className="text-white font-semibold mb-1">Almost there!</p>
          <p className="text-gray-500 text-sm">
            Captains {captainAName} and {captainBName} are setting up the competition...
          </p>
        </div>
      )}
    </div>
  )
}

// ── Active Competition ─────────────────────────────────────────────────────────

function ActiveCompetition({
  competition,
  participants,
  workouts,
  pendingWorkouts,
  currentUserId,
  competitionId,
  onRefresh,
}: {
  competition: Competition
  participants: Participant[]
  workouts: Workout[]
  pendingWorkouts: Workout[]
  currentUserId: string
  competitionId: string
  onRefresh: () => void
}) {
  const [validating, setValidating] = useState<string | null>(null)
  const [editingSettings, setEditingSettings] = useState(false)
  const [editGoal, setEditGoal] = useState(competition.point_goal)
  const [editEndDate, setEditEndDate] = useState(competition.end_date?.split('T')[0] ?? '')
  const [editWager, setEditWager] = useState(competition.wager_description ?? '')
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsError, setSettingsError] = useState('')

  const isCaptain =
    currentUserId === competition.captain_a_id || currentUserId === competition.captain_b_id

  async function saveSettings() {
    setSavingSettings(true)
    setSettingsError('')
    try {
      const res = await fetch(`/api/draft/${competitionId}/update-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pointGoal: editGoal,
          endDate: editEndDate || undefined,
          wagerDescription: editWager || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setSettingsError(data.error || 'Failed to save'); return }
      setEditingSettings(false)
      onRefresh()
    } catch {
      setSettingsError('Something went wrong.')
    } finally {
      setSavingSettings(false)
    }
  }

  const teamAParticipants = participants.filter((p) => p.team === 'a')
  const teamBParticipants = participants.filter((p) => p.team === 'b')

  const approvedWorkouts = workouts.filter((w) => w.validation_status === 'approved')
  const pendingAll = workouts.filter((w) => w.validation_status === 'pending')

  function getMemberPoints(userId: string): number {
    return approvedWorkouts
      .filter((w) => w.user_id === userId)
      .reduce((sum, w) => sum + w.points, 0)
  }

  function getMemberPending(userId: string): number {
    return pendingAll
      .filter((w) => w.user_id === userId)
      .reduce((sum, w) => sum + w.points, 0)
  }

  function getTeamTotal(teamParticipants: Participant[]): number {
    return teamParticipants.reduce((sum, p) => sum + getMemberPoints(p.user_id), 0)
  }

  const teamATotal = getTeamTotal(teamAParticipants)
  const teamBTotal = getTeamTotal(teamBParticipants)
  const goal = competition.point_goal
  const minPct = competition.min_contribution_pct

  function canTeamWin(teamParticipants: Participant[], teamTotal: number): boolean {
    if (teamTotal < goal) return false
    return teamParticipants.every((p) => {
      const pts = getMemberPoints(p.user_id)
      const pct = (pts / goal) * 100
      return pct >= minPct
    })
  }

  const teamACanWin = canTeamWin(teamAParticipants, teamATotal)
  const teamBCanWin = canTeamWin(teamBParticipants, teamBTotal)

  const currentUserParticipant = participants.find((p) => p.user_id === currentUserId)
  const myTeam = currentUserParticipant?.team

  const captainAName =
    participants.find((p) => p.user_id === competition.captain_a_id)?.profiles.display_name ||
    'Team A'
  const captainBName =
    participants.find((p) => p.user_id === competition.captain_b_id)?.profiles.display_name ||
    'Team B'

  async function handleValidate(workoutId: string, approved: boolean) {
    setValidating(workoutId)
    try {
      await fetch(`/api/draft/${competitionId}/validate-workout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workoutId, approved }),
      })
      onRefresh()
    } finally {
      setValidating(null)
    }
  }

  function TeamColumn({
    teamName,
    teamParticipants,
    teamTotal,
    canWin,
    teamLetter,
  }: {
    teamName: string
    teamParticipants: Participant[]
    teamTotal: number
    canWin: boolean
    teamLetter: 'a' | 'b'
  }) {
    const color = teamLetter === 'a' ? 'blue' : 'red'
    const progressPct = Math.min(100, (teamTotal / goal) * 100)
    const blockingMembers = teamParticipants.filter((p) => {
      const pts = getMemberPoints(p.user_id)
      return (pts / goal) * 100 < minPct
    })

    return (
      <div className="bg-gray-900 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <div
            className={`w-3 h-3 rounded-full ${
              teamLetter === 'a' ? 'bg-blue-500' : 'bg-red-500'
            }`}
          />
          <span className="text-white text-sm font-semibold truncate">{teamName}</span>
        </div>
        <div className="flex items-baseline gap-1 mb-2">
          <span
            className={`text-2xl font-bold ${
              teamLetter === 'a' ? 'text-blue-400' : 'text-red-400'
            }`}
          >
            {teamTotal}
          </span>
          <span className="text-gray-600 text-xs">/ {goal} pts</span>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-gray-800 rounded-full mb-3">
          <div
            className={`h-full rounded-full transition-all ${
              teamLetter === 'a' ? 'bg-blue-500' : 'bg-red-500'
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Win/block indicator */}
        {teamTotal >= goal && !canWin && blockingMembers.length > 0 && (
          <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-lg px-2 py-1.5 mb-3">
            <p className="text-yellow-400 text-xs">
              ⚠️ {blockingMembers[0].profiles.display_name.split(' ')[0]} is blocking the win!
            </p>
          </div>
        )}
        {canWin && (
          <div className="bg-green-900/20 border border-green-700/40 rounded-lg px-2 py-1.5 mb-3">
            <p className="text-green-400 text-xs font-semibold">🏆 Can win!</p>
          </div>
        )}

        {/* Member list */}
        <div className="space-y-1.5">
          {teamParticipants.map((p) => {
            const pts = getMemberPoints(p.user_id)
            const pendingPts = getMemberPending(p.user_id)
            const pct = Math.min(100, (pts / goal) * 100)
            const needed = Math.max(0, Math.ceil(goal * (minPct / 100)) - pts)
            const belowMin = pct < minPct

            return (
              <div key={p.user_id} className="space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${belowMin ? 'text-red-400' : 'text-gray-300'}`}>
                    {p.profiles.display_name.split(' ')[0]}
                    {p.user_id === competition.captain_a_id ||
                    p.user_id === competition.captain_b_id
                      ? ' (C)'
                      : ''}
                    {p.user_id === currentUserId ? ' · you' : ''}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {pendingPts > 0 && (
                      <span className="text-xs text-yellow-600" title="Pending validation">
                        +{pendingPts} ⏳
                      </span>
                    )}
                    <span className={`text-xs font-semibold ${belowMin ? 'text-red-400' : 'text-gray-400'}`}>
                      {pts}
                    </span>
                  </div>
                </div>
                {belowMin && needed > 0 && (
                  <p className="text-red-600 text-xs">Needs {needed} more pts</p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Pending workouts for my team (teammates only — can't validate your own)
  const myTeamPending = pendingWorkouts.filter((w) => {
    if (w.user_id === currentUserId) return false
    const loggerParticipant = participants.find((p) => p.user_id === w.user_id)
    return loggerParticipant?.team === myTeam
  })

  // My own workouts awaiting validation
  const myOwnPending = pendingWorkouts.filter((w) => w.user_id === currentUserId)

  return (
    <div className="space-y-4">
      {/* Scoreboard */}
      <div className="grid grid-cols-2 gap-3">
        <TeamColumn
          teamName={captainAName}
          teamParticipants={teamAParticipants}
          teamTotal={teamATotal}
          canWin={teamACanWin}
          teamLetter="a"
        />
        <TeamColumn
          teamName={captainBName}
          teamParticipants={teamBParticipants}
          teamTotal={teamBTotal}
          canWin={teamBCanWin}
          teamLetter="b"
        />
      </div>

      {/* Stakes + captain edit */}
      <div className="bg-gray-900 rounded-2xl p-4">
        {editingSettings ? (
          <div className="space-y-3">
            <h3 className="text-white font-semibold text-sm">Edit Competition Settings</h3>
            <label className="block">
              <span className="text-gray-400 text-xs block mb-1">Point Goal</span>
              <input
                type="number"
                min={1}
                value={editGoal}
                onChange={e => setEditGoal(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full bg-gray-800 text-white rounded-xl px-4 py-2 text-sm border border-gray-700 focus:border-green-500 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-gray-400 text-xs block mb-1">End Date <span className="text-gray-600">(optional)</span></span>
              <input
                type="date"
                value={editEndDate}
                onChange={e => setEditEndDate(e.target.value)}
                className="w-full bg-gray-800 text-white rounded-xl px-4 py-2 text-sm border border-gray-700 focus:border-green-500 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-gray-400 text-xs block mb-1">Stakes <span className="text-gray-600">(optional)</span></span>
              <input
                type="text"
                value={editWager}
                onChange={e => setEditWager(e.target.value)}
                placeholder="e.g. $5 venmo"
                className="w-full bg-gray-800 text-white rounded-xl px-4 py-2 text-sm border border-gray-700 focus:border-green-500 focus:outline-none"
              />
            </label>
            {settingsError && <p className="text-red-400 text-xs">{settingsError}</p>}
            <div className="flex gap-2">
              <button
                onClick={saveSettings}
                disabled={savingSettings}
                className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-black font-bold py-2 rounded-xl text-sm transition-colors"
              >
                {savingSettings ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => { setEditingSettings(false); setSettingsError('') }}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between">
            <div>
              {competition.wager_description && (
                <>
                  <p className="text-gray-500 text-xs mb-0.5">Stakes</p>
                  <p className="text-white text-sm">{competition.wager_description}</p>
                </>
              )}
              {!competition.wager_description && (
                <p className="text-gray-600 text-xs">No stakes set</p>
              )}
            </div>
            {isCaptain && (
              <button
                onClick={() => {
                  setEditGoal(competition.point_goal)
                  setEditEndDate(competition.end_date?.split('T')[0] ?? '')
                  setEditWager(competition.wager_description ?? '')
                  setEditingSettings(true)
                }}
                className="text-gray-600 hover:text-gray-300 text-xs transition-colors ml-3 flex-shrink-0"
                title="Edit settings"
              >
                ✏️ Edit
              </button>
            )}
          </div>
        )}
      </div>

      {/* My own workouts awaiting teammate validation */}
      {myOwnPending.length > 0 && (
        <div className="bg-yellow-900/15 border border-yellow-700/30 rounded-2xl p-4">
          <h3 className="text-yellow-400 font-semibold text-sm mb-1">
            ⏳ Awaiting Validation ({myOwnPending.length})
          </h3>
          <p className="text-gray-500 text-xs mb-3">
            Your workouts below are pending — a teammate needs to approve them before they count.
          </p>
          <div className="space-y-2">
            {myOwnPending.map((w) => (
              <div key={w.id} className="bg-gray-800/60 rounded-xl px-3 py-2 flex items-center justify-between">
                <div>
                  <p className="text-gray-300 text-xs font-medium">
                    {w.workout_type} · {w.duration_minutes} min
                  </p>
                  {w.notes && <p className="text-gray-600 text-xs italic">{w.notes}</p>}
                </div>
                <span className="text-yellow-500 text-sm font-bold">+{w.points} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Teammate validation queue */}
      {myTeamPending.length > 0 && (
        <div className="bg-gray-900 rounded-2xl p-4">
          <h3 className="text-white font-semibold text-sm mb-3">
            Pending Validation ({myTeamPending.length})
          </h3>
          <p className="text-gray-500 text-xs mb-3">
            Validate your teammates&apos; workouts.
          </p>
          <div className="space-y-3">
            {myTeamPending.map((w) => (
              <div key={w.id} className="bg-gray-800 rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-white text-sm font-medium">
                    {w.profiles.display_name.split(' ')[0]}
                  </span>
                  <span className="text-gray-500 text-xs">
                    {new Date(w.logged_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-gray-400 text-xs mb-1">
                  {w.workout_type} · {w.duration_minutes} min · {w.points} pts
                </p>
                {w.notes && (
                  <p className="text-gray-600 text-xs mb-2 italic">{w.notes}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleValidate(w.id, true)}
                    disabled={validating === w.id}
                    className="flex-1 bg-green-900/40 hover:bg-green-900/60 disabled:opacity-50 text-green-400 font-semibold py-1.5 rounded-lg text-xs transition-colors"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleValidate(w.id, false)}
                    disabled={validating === w.id}
                    className="flex-1 bg-red-900/40 hover:bg-red-900/60 disabled:opacity-50 text-red-400 font-semibold py-1.5 rounded-lg text-xs transition-colors"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Log workout CTA */}
      <Link
        href={`/log-workout?draftId=${competitionId}`}
        className="block w-full text-center bg-green-500 hover:bg-green-400 text-black font-bold py-3 rounded-xl text-sm transition-colors"
      >
        + Log Workout for This Competition
      </Link>
    </div>
  )
}

// ── Completed Phase ────────────────────────────────────────────────────────────

function CompletedPhase({
  competition,
  participants,
  workouts,
}: {
  competition: Competition
  participants: Participant[]
  workouts: Workout[]
}) {
  const teamAParticipants = participants.filter((p) => p.team === 'a')
  const teamBParticipants = participants.filter((p) => p.team === 'b')

  const approvedWorkouts = workouts.filter((w) => w.validation_status === 'approved')

  function getMemberPoints(userId: string): number {
    return approvedWorkouts
      .filter((w) => w.user_id === userId)
      .reduce((sum, w) => sum + w.points, 0)
  }

  const teamATotal = teamAParticipants.reduce((sum, p) => sum + getMemberPoints(p.user_id), 0)
  const teamBTotal = teamBParticipants.reduce((sum, p) => sum + getMemberPoints(p.user_id), 0)

  const captainAName =
    participants.find((p) => p.user_id === competition.captain_a_id)?.profiles.display_name || 'Team A'
  const captainBName =
    participants.find((p) => p.user_id === competition.captain_b_id)?.profiles.display_name || 'Team B'

  const winnerTeam = competition.winner_team
  const loserTeam = winnerTeam === 'a' ? 'b' : winnerTeam === 'b' ? 'a' : null
  const winnerName = winnerTeam === 'a' ? captainAName : winnerTeam === 'b' ? captainBName : null

  const winnerParticipants = winnerTeam ? participants.filter((p) => p.team === winnerTeam) : []
  const loserParticipants = loserTeam ? participants.filter((p) => p.team === loserTeam) : []

  const note = encodeURIComponent(`GainsBet: ${competition.name}${competition.wager_description ? ' — ' + competition.wager_description : ''}`)

  function venmoLink(username: string) {
    return `https://venmo.com/${username}?txn=pay&note=${note}`
  }

  return (
    <div className="space-y-4">
      {/* Winner banner */}
      <div className="bg-gradient-to-br from-yellow-900/30 to-yellow-600/10 border border-yellow-600/40 rounded-2xl p-6 text-center">
        <div className="text-5xl mb-3">🏆</div>
        {winnerName ? (
          <>
            <h2 className="text-yellow-400 text-xl font-bold">{winnerName}'s team wins!</h2>
            <p className="text-gray-400 text-sm mt-1">Competition complete</p>
          </>
        ) : (
          <h2 className="text-white text-xl font-bold">Competition Complete!</h2>
        )}
        {competition.wager_description && (
          <p className="text-amber-400 text-sm mt-2">💰 {competition.wager_description}</p>
        )}
      </div>

      {/* Final scores */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { name: captainAName, total: teamATotal, team: teamAParticipants, letter: 'a' },
          { name: captainBName, total: teamBTotal, team: teamBParticipants, letter: 'b' },
        ].map(({ name, total, team, letter }) => (
          <div
            key={letter}
            className={`bg-gray-900 rounded-2xl p-4 ${winnerTeam === letter ? 'ring-2 ring-yellow-500/50' : ''}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-3 h-3 rounded-full ${letter === 'a' ? 'bg-blue-500' : 'bg-red-500'}`} />
              <span className="text-white text-sm font-semibold truncate">{name}</span>
              {winnerTeam === letter && <span className="text-yellow-400 text-xs ml-auto">W</span>}
            </div>
            <p className={`text-2xl font-bold mb-3 ${letter === 'a' ? 'text-blue-400' : 'text-red-400'}`}>
              {total} pts
            </p>
            {team.map((p) => (
              <div key={p.user_id} className="flex justify-between py-0.5">
                <span className="text-gray-400 text-xs">{p.profiles.display_name.split(' ')[0]}</span>
                <span className="text-gray-500 text-xs">{getMemberPoints(p.user_id)} pts</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Venmo pay section */}
      {loserParticipants.length > 0 && winnerParticipants.length > 0 && (
        <div className="bg-gray-900 rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-1">💸 Settle Up</h3>
          <p className="text-gray-500 text-sm mb-4">
            Losers — tap to pay each winner on Venmo.
          </p>
          <div className="space-y-2">
            {winnerParticipants.map((p) => {
              const venmo = p.profiles.venmo_username
              return (
                <div key={p.user_id} className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-white text-sm font-medium">{p.profiles.display_name.split(' ')[0]}</p>
                    {venmo && <p className="text-gray-500 text-xs">@{venmo}</p>}
                  </div>
                  {venmo ? (
                    <a
                      href={venmoLink(venmo)}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors"
                    >
                      Pay on Venmo
                    </a>
                  ) : (
                    <span className="text-gray-600 text-xs">No Venmo set</span>
                  )}
                </div>
              )
            })}
          </div>
          <p className="text-gray-700 text-xs mt-3 text-center">
            Winners: add your Venmo in Profile settings
          </p>
        </div>
      )}
    </div>
  )
}

// ── Main Client Component ─────────────────────────────────────────────────────

export default function DraftCompetitionClient({
  competition: initialCompetition,
  participants: initialParticipants,
  voteCounts: initialVoteCounts,
  voterIds: initialVoterIds,
  workouts,
  pendingWorkouts: initialPendingWorkouts,
  currentUserId,
  competitionId,
  myTeam,
  initialGroupMessages,
  initialTeamMessages,
  allProfiles,
  invitedIds,
}: Props) {
  const router = useRouter()
  const [competition, setCompetition] = useState(initialCompetition)
  const [participants, setParticipants] = useState(initialParticipants)
  const [voteCounts, setVoteCounts] = useState(initialVoteCounts)
  const [voterIds, setVoterIds] = useState(initialVoterIds)
  const [pendingWorkouts, setPendingWorkouts] = useState(initialPendingWorkouts)
  const [showKickoff, setShowKickoff] = useState(
    () => initialCompetition.status === 'active' && !hasKickoffBeenSeen(competitionId)
  )
  const [showHowItWorks, setShowHowItWorks] = useState(false)

  function refresh() {
    router.refresh()
  }

  const statusLabel: Record<string, string> = {
    recruiting: 'Recruiting',
    voting: 'Voting',
    drafting: 'Drafting',
    configuring: 'Configuring',
    active: 'Active',
    completed: 'Completed',
  }

  const statusColor: Record<string, string> = {
    recruiting: 'bg-blue-900/40 text-blue-400',
    voting: 'bg-purple-900/40 text-purple-400',
    drafting: 'bg-yellow-900/40 text-yellow-400',
    configuring: 'bg-orange-900/40 text-orange-400',
    active: 'bg-green-900/40 text-green-400',
    completed: 'bg-gray-800 text-gray-500',
  }

  return (
    <div>
      {showKickoff && (
        <DraftKickoffModal
          competitionId={competitionId}
          onDismiss={() => setShowKickoff(false)}
        />
      )}

      {showHowItWorks && (
        <DraftTutorial
          pointGoal={competition.point_goal}
          minPct={competition.min_contribution_pct}
          onDismiss={() => setShowHowItWorks(false)}
        />
      )}

      {/* Header */}
      <div className="bg-gray-900 px-4 pt-12 pb-5 border-b border-gray-800">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <Link href="/draft" className="text-gray-400 hover:text-white transition-colors text-sm">
              ← Back
            </Link>
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                statusColor[competition.status] || 'bg-gray-800 text-gray-500'
              }`}
            >
              {statusLabel[competition.status] || competition.status}
            </span>
            <button
              onClick={() => setShowHowItWorks(true)}
              className="ml-auto text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1"
            >
              <span className="w-4 h-4 rounded-full border border-gray-600 flex items-center justify-center text-gray-500 text-xs font-bold">?</span>
              How it works
            </button>
          </div>
          <h1 className="text-xl font-bold text-white">{competition.name}</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Goal: {competition.point_goal} pts
            {competition.wager_description && ` · ${competition.wager_description}`}
          </p>
          <Link href="/rules" className="text-xs text-gray-600 hover:text-gray-400 transition-colors mt-1 inline-block">
            Full rules & scoring guide →
          </Link>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-5">
        {competition.status === 'recruiting' && (
          <RecruitingPhase
            competition={competition}
            participants={participants}
            currentUserId={currentUserId}
            competitionId={competitionId}
            onJoined={refresh}
            allProfiles={allProfiles}
            invitedIds={invitedIds}
          />
        )}

        {competition.status === 'voting' && (
          <VotingPhase
            competition={competition}
            participants={participants}
            currentUserId={currentUserId}
            competitionId={competitionId}
            voterIds={voterIds}
            voteCounts={voteCounts}
            onVoted={refresh}
          />
        )}

        {competition.status === 'drafting' && (
          <DraftingPhase
            competition={competition}
            participants={participants}
            currentUserId={currentUserId}
            competitionId={competitionId}
            onPicked={refresh}
          />
        )}

        {competition.status === 'configuring' && (
          <ConfigurePhase
            competition={competition}
            participants={participants}
            currentUserId={currentUserId}
            competitionId={competitionId}
            onConfigured={refresh}
          />
        )}

        {competition.status === 'active' && (
          <ActiveCompetition
            competition={competition}
            participants={participants}
            workouts={workouts}
            pendingWorkouts={pendingWorkouts}
            currentUserId={currentUserId}
            competitionId={competitionId}
            onRefresh={refresh}
          />
        )}

        {competition.status === 'completed' && (
          <CompletedPhase
            competition={competition}
            participants={participants}
            workouts={workouts}
          />
        )}

        {/* Chat — visible to participants in all phases */}
        {participants.some(p => p.user_id === currentUserId) && (() => {
          const captainAName =
            participants.find(p => p.user_id === competition.captain_a_id)?.profiles.display_name ?? 'Team A'
          const captainBName =
            participants.find(p => p.user_id === competition.captain_b_id)?.profiles.display_name ?? 'Team B'
          const teamName = myTeam === 'a' ? captainAName : myTeam === 'b' ? captainBName : ''
          return (
            <div className="mt-4 mb-2">
              <h2 className="text-white font-semibold text-sm mb-3 px-1">Chat</h2>
              <DraftChat
                competitionId={competitionId}
                currentUserId={currentUserId}
                myTeam={myTeam}
                initialGroupMessages={initialGroupMessages}
                initialTeamMessages={initialTeamMessages}
                teamName={teamName}
              />
            </div>
          )
        })()}
      </div>
    </div>
  )
}
