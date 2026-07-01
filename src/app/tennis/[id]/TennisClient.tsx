'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Profile {
  id: string
  display_name: string
  username: string
  avatar_url?: string | null
}

interface SetScore { p1: number; p2: number }

interface Match {
  id: string
  player1_id: string
  player2_id: string
  winner_id: string | null
  set_scores: SetScore[]
  aces_p1: number
  aces_p2: number
  double_faults_p1: number
  double_faults_p2: number
  notes?: string | null
  played_at: string
}

interface Session {
  id: string
  user_id: string
  duration_minutes: number
  drill_focus?: string | null
  notes?: string | null
  session_date: string
  points: number
}

interface Comment {
  id: string
  user_id: string
  body: string
  created_at: string
  profiles?: Profile
}

interface Challenge {
  id: string
  name: string
  description?: string | null
  created_by: string
  participant_ids: string[]
  wager?: string | null
  start_date: string
  end_date?: string | null
  status: 'active' | 'completed'
  created_at: string
}

interface Props {
  challenge: Challenge
  matches: Match[]
  sessions: Session[]
  comments: Comment[]
  participants: Profile[]
  currentUserId: string
  challengeId: string
}

const DRILL_FOCUSES = [
  { value: 'serve', label: '🎯 Serve', emoji: '🎯' },
  { value: 'groundstrokes', label: '💥 Groundstrokes', emoji: '💥' },
  { value: 'volleys', label: '🕸️ Net/Volleys', emoji: '🕸️' },
  { value: 'footwork', label: '🏃 Footwork', emoji: '🏃' },
  { value: 'match_play', label: '🎾 Match Play', emoji: '🎾' },
  { value: 'mental', label: '🧘 Mental Game', emoji: '🧘' },
  { value: 'fitness', label: '💪 Court Fitness', emoji: '💪' },
]

const QUICK_REACTIONS = ['🔥', '💀', '👏', '😬', '💪', '🎾']

function computeMatchPoints(match: Match, userId: string) {
  const isP1 = match.player1_id === userId
  const won = match.winner_id === userId
  const sets = match.set_scores || []

  let pts = won ? 50 : 10
  let setsWon = 0, setsLost = 0, gamesWon = 0

  for (const s of sets) {
    const myG = isP1 ? s.p1 : s.p2
    const oppG = isP1 ? s.p2 : s.p1
    gamesWon += myG
    if (myG > oppG) {
      setsWon++
      if (myG === 6 && oppG === 0) pts += 15 // bagel bonus
    } else {
      setsLost++
    }
  }

  pts += setsWon * 10
  pts += gamesWon

  // Clean sweep bonus
  if (won && setsLost === 0 && sets.length >= 2) pts += 25

  // Aces (5 pts each, max 50)
  const myAces = isP1 ? match.aces_p1 : match.aces_p2
  pts += Math.min(myAces * 5, 50)

  return { pts, setsWon, gamesWon, won, myAces }
}

function computeStandings(matches: Match[], sessions: Session[], participants: Profile[]) {
  const stats: Record<string, { id: string; display_name: string; wins: number; losses: number; points: number; aces: number; matchPts: number; practicePts: number }> = {}
  for (const p of participants) {
    stats[p.id] = { id: p.id, display_name: p.display_name, wins: 0, losses: 0, points: 0, aces: 0, matchPts: 0, practicePts: 0 }
  }
  for (const m of matches) {
    for (const pid of [m.player1_id, m.player2_id]) {
      if (!stats[pid]) continue
      const { pts, won, myAces } = computeMatchPoints(m, pid)
      stats[pid].points += pts
      stats[pid].matchPts += pts
      stats[pid].aces += myAces
      if (won) stats[pid].wins++
      else stats[pid].losses++
    }
  }
  for (const s of sessions) {
    if (stats[s.user_id]) {
      stats[s.user_id].points += s.points
      stats[s.user_id].practicePts += s.points
    }
  }
  return Object.values(stats).sort((a, b) => b.points - a.points || b.wins - a.wins)
}

function getBadges(userId: string, matches: Match[], sessions: Session[]) {
  const badges: string[] = []
  const myMatches = matches.filter(m => m.player1_id === userId || m.player2_id === userId)
  const wins = myMatches.filter(m => m.winner_id === userId)
  const totalAces = myMatches.reduce((s, m) => s + (m.player1_id === userId ? m.aces_p1 : m.aces_p2), 0)
  const hasBagel = myMatches.some(m => {
    const isP1 = m.player1_id === userId
    return (m.set_scores || []).some(s => (isP1 ? s.p1 : s.p2) === 6 && (isP1 ? s.p2 : s.p1) === 0)
  })
  const mySessions = sessions.filter(s => s.user_id === userId)
  if (wins.length >= 3) badges.push('👑 Court King')
  if (totalAces >= 10) badges.push('🎯 Ace Machine')
  if (hasBagel) badges.push('🍕 Bagel Baker')
  if (mySessions.length >= 5) badges.push('🏋️ Grinder')
  if (wins.length > 0 && myMatches.length > 0 && wins.length === myMatches.length) badges.push('💀 Undefeated')
  return badges
}

function formatTimeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return days < 7 ? `${days}d ago` : new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function scoreDisplay(sets: SetScore[], viewingP1: boolean) {
  return sets.map(s => viewingP1 ? `${s.p1}-${s.p2}` : `${s.p2}-${s.p1}`).join(', ')
}

export default function TennisClient({ challenge, matches, sessions, comments: initialComments, participants, currentUserId, challengeId }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<'standings' | 'matches' | 'practice' | 'chat'>('standings')

  // Match log state
  const [opponentId, setOpponentId] = useState('')
  const [sets, setSets] = useState<SetScore[]>([{ p1: 0, p2: 0 }, { p1: 0, p2: 0 }])
  const [acesMe, setAcesMe] = useState(0)
  const [acesOpp, setAcesOpp] = useState(0)
  const [matchNotes, setMatchNotes] = useState('')
  const [loggingMatch, setLoggingMatch] = useState(false)
  const [matchError, setMatchError] = useState('')
  const [matchSuccess, setMatchSuccess] = useState<null | { pts: number; won: boolean }>(null)

  // Practice log state
  const [practiceDuration, setPracticeDuration] = useState(60)
  const [drillFocus, setDrillFocus] = useState('')
  const [practiceNotes, setPracticeNotes] = useState('')
  const [loggingPractice, setLoggingPractice] = useState(false)
  const [practiceError, setPracticeError] = useState('')
  const [practiceSuccess, setPracticeSuccess] = useState<null | { pts: number }>(null)

  // Chat state
  const [comments, setComments] = useState(initialComments)
  const [commentText, setCommentText] = useState('')
  const [postingComment, setPostingComment] = useState(false)

  const profileMap: Record<string, Profile> = {}
  for (const p of participants) profileMap[p.id] = p

  const standings = computeStandings(matches, sessions, participants)
  const isParticipant = challenge.participant_ids.includes(currentUserId)
  const opponents = participants.filter(p => p.id !== currentUserId)
  const myName = profileMap[currentUserId]?.display_name?.split(' ')[0] || 'You'

  // Determine match winner preview from current set input
  const p1Sets = sets.filter(s => s.p1 > s.p2).length
  const p2Sets = sets.filter(s => s.p2 > s.p1).length
  const previewWon = p1Sets > p2Sets
  const previewLost = p2Sets > p1Sets

  function updateSet(idx: number, field: 'p1' | 'p2', val: number) {
    setSets(prev => prev.map((s, i) => i === idx ? { ...s, [field]: Math.max(0, Math.min(99, val)) } : s))
  }

  function addSet() {
    if (sets.length < 3) setSets(prev => [...prev, { p1: 0, p2: 0 }])
  }

  function removeSet(idx: number) {
    if (sets.length > 2) setSets(prev => prev.filter((_, i) => i !== idx))
  }

  async function submitMatch() {
    if (!opponentId) { setMatchError('Select an opponent'); return }
    const hasScores = sets.some(s => s.p1 > 0 || s.p2 > 0)
    if (!hasScores) { setMatchError('Enter set scores'); return }
    setLoggingMatch(true)
    setMatchError('')
    const res = await fetch(`/api/tennis/${challengeId}/log-match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opponentId, setScores: sets, acesMe, acesOpp, notes: matchNotes }),
    })
    setLoggingMatch(false)
    if (res.ok) {
      const data = await res.json()
      const { pts } = computeMatchPoints({
        id: '', player1_id: currentUserId, player2_id: opponentId,
        winner_id: data.winnerId, set_scores: sets, aces_p1: acesMe, aces_p2: acesOpp,
        double_faults_p1: 0, double_faults_p2: 0, played_at: '',
      }, currentUserId)
      setMatchSuccess({ pts, won: data.winnerId === currentUserId })
      setOpponentId(''); setSets([{ p1: 0, p2: 0 }, { p1: 0, p2: 0 }])
      setAcesMe(0); setAcesOpp(0); setMatchNotes('')
      router.refresh()
    } else {
      const d = await res.json()
      setMatchError(d.error || 'Failed to log')
    }
  }

  async function submitPractice() {
    setLoggingPractice(true)
    setPracticeError('')
    const res = await fetch(`/api/tennis/${challengeId}/log-practice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ durationMinutes: practiceDuration, drillFocus: drillFocus || null, notes: practiceNotes }),
    })
    setLoggingPractice(false)
    if (res.ok) {
      const d = await res.json()
      setPracticeSuccess({ pts: d.points })
      setPracticeDuration(60); setDrillFocus(''); setPracticeNotes('')
      router.refresh()
    } else {
      const d = await res.json()
      setPracticeError(d.error || 'Failed')
    }
  }

  async function postComment() {
    if (!commentText.trim() || postingComment) return
    setPostingComment(true)
    const body = commentText.trim()
    setCommentText('')
    try {
      const res = await fetch(`/api/tennis/${challengeId}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })
      if (res.ok) router.refresh()
    } finally {
      setPostingComment(false)
    }
  }

  return (
    <>
      {/* Header */}
      <div className="bg-gray-900 px-4 pt-12 pb-4 border-b border-gray-800">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <Link href="/tennis" className="text-gray-400 hover:text-white text-sm transition-colors">← Back</Link>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
              challenge.status === 'active' ? 'bg-green-900/30 text-green-400' : 'bg-gray-800 text-gray-400'
            }`}>
              {challenge.status === 'active' ? 'Active' : 'Completed'}
            </span>
          </div>
          <h1 className="text-xl font-bold text-white leading-tight">{challenge.name}</h1>
          {challenge.description && (
            <p className="text-gray-500 text-xs mt-1">{challenge.description}</p>
          )}
        </div>
      </div>

      {/* Wager bar */}
      {challenge.wager && (
        <div className="bg-yellow-900/20 border-b border-yellow-800/30 px-4 py-2.5">
          <div className="max-w-lg mx-auto">
            <p className="text-yellow-400 text-xs font-semibold">
              💸 Stakes: <span className="font-normal text-yellow-300">"{challenge.wager}"</span>
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-gray-900 border-b border-gray-800 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex">
          {(['standings', 'matches', 'practice', 'chat'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-3 text-xs font-semibold transition-colors ${
                tab === t ? 'text-green-400 border-b-2 border-green-400' : 'text-gray-500 hover:text-gray-300'
              }`}>
              {t === 'standings' ? '🏆 Stand.' : t === 'matches' ? '🎾 Match' : t === 'practice' ? '🏋️ Practice' : '💬 Chat'}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">

        {/* ── STANDINGS TAB ── */}
        {tab === 'standings' && (
          <>
            <div className="space-y-3">
              {standings.map((s, rank) => {
                const isMe = s.id === currentUserId
                const winPct = s.wins + s.losses > 0
                  ? ((s.wins / (s.wins + s.losses)) * 100).toFixed(0)
                  : '—'
                const badges = getBadges(s.id, matches, sessions)
                return (
                  <div key={s.id} className={`rounded-2xl p-4 border ${
                    rank === 0 ? 'bg-yellow-950/20 border-yellow-700/40' : 'bg-gray-900 border-gray-800'
                  }`}>
                    <div className="flex items-center gap-3 mb-3">
                      <span className={`text-2xl font-black ${rank === 0 ? 'text-yellow-400' : 'text-gray-600'}`}>
                        {rank === 0 ? '👑' : `#${rank + 1}`}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-white font-bold text-sm">
                            {s.display_name.split(' ')[0]}
                            {isMe && <span className="text-green-400 text-xs ml-1">(you)</span>}
                          </p>
                        </div>
                        {badges.length > 0 && (
                          <p className="text-xs text-gray-500 mt-0.5">{badges.join(' · ')}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className={`text-2xl font-black ${rank === 0 ? 'text-yellow-400' : 'text-white'}`}>
                          {Math.round(s.points)}
                        </p>
                        <p className="text-gray-600 text-xs">pts</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div>
                        <p className="text-green-400 font-bold text-lg">{s.wins}</p>
                        <p className="text-gray-600 text-xs">W</p>
                      </div>
                      <div>
                        <p className="text-red-400 font-bold text-lg">{s.losses}</p>
                        <p className="text-gray-600 text-xs">L</p>
                      </div>
                      <div>
                        <p className="text-white font-bold text-lg">{winPct}{winPct !== '—' ? '%' : ''}</p>
                        <p className="text-gray-600 text-xs">Win%</p>
                      </div>
                      <div>
                        <p className="text-blue-400 font-bold text-lg">{s.aces}</p>
                        <p className="text-gray-600 text-xs">Aces</p>
                      </div>
                    </div>
                    <div className="mt-2 flex gap-3 text-xs text-gray-600">
                      <span>Match: <span className="text-gray-400">{Math.round(s.matchPts)}pts</span></span>
                      <span>Practice: <span className="text-blue-400">{Math.round(s.practicePts)}pts</span></span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Recent matches */}
            {matches.length > 0 && (
              <div className="space-y-2">
                <p className="text-gray-500 text-xs font-semibold">RECENT MATCHES</p>
                {matches.slice(0, 5).map(m => {
                  const p1 = profileMap[m.player1_id]
                  const p2 = profileMap[m.player2_id]
                  const scoreStr = m.set_scores.map(s => `${s.p1}-${s.p2}`).join(', ')
                  const winner = m.winner_id ? profileMap[m.winner_id] : null
                  return (
                    <div key={m.id} className="bg-gray-900 rounded-xl p-3 border border-gray-800">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className={`text-sm font-semibold ${m.winner_id === m.player1_id ? 'text-green-400' : 'text-gray-400'}`}>
                            {p1?.display_name?.split(' ')[0]}
                          </span>
                          <span className="text-gray-600 text-xs mx-2">vs</span>
                          <span className={`text-sm font-semibold ${m.winner_id === m.player2_id ? 'text-green-400' : 'text-gray-400'}`}>
                            {p2?.display_name?.split(' ')[0]}
                          </span>
                        </div>
                        <span className="text-gray-400 text-xs">{scoreStr}</span>
                      </div>
                      {(m.aces_p1 > 0 || m.aces_p2 > 0) && (
                        <p className="text-gray-600 text-xs mt-1">
                          Aces: {p1?.display_name?.split(' ')[0]} {m.aces_p1} · {p2?.display_name?.split(' ')[0]} {m.aces_p2}
                        </p>
                      )}
                      <p className="text-gray-700 text-xs">{formatTimeAgo(m.played_at)}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ── MATCHES TAB ── */}
        {tab === 'matches' && (
          <div className="space-y-4">
            {isParticipant && (
              <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 space-y-4">
                <h3 className="text-white font-semibold text-sm">🎾 Log a Match</h3>

                {matchSuccess && (
                  <div className={`rounded-xl px-4 py-3 border ${
                    matchSuccess.won ? 'bg-green-950/30 border-green-700/50' : 'bg-gray-800 border-gray-700'
                  }`}>
                    <p className={`font-bold text-sm ${matchSuccess.won ? 'text-green-400' : 'text-gray-300'}`}>
                      {matchSuccess.won ? '🏆 Match logged — You won!' : '💪 Match logged — You lost. Next time.'}
                    </p>
                    <p className="text-gray-500 text-xs">+{matchSuccess.pts} points earned</p>
                    <button onClick={() => setMatchSuccess(null)} className="text-gray-600 text-xs mt-1">dismiss</button>
                  </div>
                )}

                {/* Opponent */}
                <div>
                  <label className="text-gray-400 text-xs block mb-1.5">Opponent *</label>
                  <select value={opponentId} onChange={e => setOpponentId(e.target.value)}
                    className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 text-sm border border-gray-700 focus:border-green-500 focus:outline-none">
                    <option value="">Select opponent</option>
                    {opponents.map(p => (
                      <option key={p.id} value={p.id}>{p.display_name}</option>
                    ))}
                  </select>
                </div>

                {/* Set scores */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-gray-400 text-xs">Set Scores *</label>
                    {opponentId && (
                      <span className="text-xs text-gray-500">
                        {myName} <span className="text-gray-600">vs</span> {profileMap[opponentId]?.display_name?.split(' ')[0]}
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {sets.map((s, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-gray-600 text-xs w-10">Set {i + 1}</span>
                        <input type="number" value={s.p1} min={0} max={99}
                          onChange={e => updateSet(i, 'p1', Number(e.target.value))}
                          className="w-16 bg-gray-800 text-white text-center rounded-lg px-2 py-2 text-sm border border-gray-700 focus:border-green-500 focus:outline-none" />
                        <span className="text-gray-600">—</span>
                        <input type="number" value={s.p2} min={0} max={99}
                          onChange={e => updateSet(i, 'p2', Number(e.target.value))}
                          className="w-16 bg-gray-800 text-white text-center rounded-lg px-2 py-2 text-sm border border-gray-700 focus:border-green-500 focus:outline-none" />
                        {sets.length > 2 && (
                          <button onClick={() => removeSet(i)} className="text-gray-600 hover:text-red-400 text-sm">×</button>
                        )}
                        {i === 0 && s.p1 === 6 && s.p2 === 0 && <span className="text-yellow-400 text-xs">🍕 Bagel!</span>}
                        {i === 0 && s.p2 === 6 && s.p1 === 0 && <span className="text-red-400 text-xs">🍕 Bageled</span>}
                      </div>
                    ))}
                  </div>
                  {sets.length < 3 && (
                    <button onClick={addSet} className="mt-2 text-gray-500 hover:text-green-400 text-xs transition-colors">
                      + Add Set 3
                    </button>
                  )}

                  {/* Winner preview */}
                  {(previewWon || previewLost) && (
                    <div className={`mt-3 rounded-xl px-3 py-2 text-xs font-semibold ${
                      previewWon ? 'bg-green-950/30 text-green-400' : 'bg-red-950/20 text-red-400'
                    }`}>
                      {previewWon ? '🏆 You win this match' : '💀 Opponent wins this match'}
                      {previewWon && p2Sets === 0 && sets.length >= 2 && <span className="ml-2 text-yellow-400">+ Clean Sweep bonus!</span>}
                    </div>
                  )}
                </div>

                {/* Aces */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-gray-400 text-xs block mb-1.5">Your Aces</label>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setAcesMe(Math.max(0, acesMe - 1))}
                        className="w-8 h-8 bg-gray-800 rounded-lg text-white text-sm hover:bg-gray-700 transition-colors">−</button>
                      <span className="text-white font-bold text-lg w-8 text-center">{acesMe}</span>
                      <button onClick={() => setAcesMe(acesMe + 1)}
                        className="w-8 h-8 bg-gray-800 rounded-lg text-white text-sm hover:bg-gray-700 transition-colors">+</button>
                    </div>
                    {acesMe > 0 && <p className="text-green-400 text-xs mt-1">+{Math.min(acesMe * 5, 50)} pts</p>}
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs block mb-1.5">Opponent Aces</label>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setAcesOpp(Math.max(0, acesOpp - 1))}
                        className="w-8 h-8 bg-gray-800 rounded-lg text-white text-sm hover:bg-gray-700 transition-colors">−</button>
                      <span className="text-white font-bold text-lg w-8 text-center">{acesOpp}</span>
                      <button onClick={() => setAcesOpp(acesOpp + 1)}
                        className="w-8 h-8 bg-gray-800 rounded-lg text-white text-sm hover:bg-gray-700 transition-colors">+</button>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="text-gray-400 text-xs block mb-1.5">Notes <span className="text-gray-600">(optional)</span></label>
                  <input type="text" value={matchNotes} onChange={e => setMatchNotes(e.target.value)}
                    placeholder="e.g. Played at hard courts, windy"
                    className="w-full bg-gray-800 text-white rounded-xl px-4 py-2.5 text-sm border border-gray-700 focus:border-green-500 focus:outline-none" />
                </div>

                {matchError && <p className="text-red-400 text-sm">{matchError}</p>}
                <button onClick={submitMatch} disabled={loggingMatch || !opponentId}
                  className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-bold py-3 rounded-xl text-sm transition-colors">
                  {loggingMatch ? 'Logging...' : '🎾 Log Match'}
                </button>
              </div>
            )}

            {/* Match history */}
            {matches.length > 0 && (
              <div className="space-y-3">
                <p className="text-gray-500 text-xs font-semibold">ALL MATCHES ({matches.length})</p>
                {matches.map(m => {
                  const p1 = profileMap[m.player1_id]
                  const p2 = profileMap[m.player2_id]
                  const viewingP1 = m.player1_id === currentUserId
                  const iParticipated = m.player1_id === currentUserId || m.player2_id === currentUserId
                  const iWon = m.winner_id === currentUserId
                  const scoreStr = scoreDisplay(m.set_scores, viewingP1)
                  const myStats = iParticipated ? computeMatchPoints(m, currentUserId) : null
                  return (
                    <div key={m.id} className={`rounded-2xl p-4 border ${
                      iParticipated
                        ? iWon ? 'bg-green-950/20 border-green-800/50' : 'bg-gray-900 border-gray-800'
                        : 'bg-gray-900 border-gray-800'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`font-bold text-sm ${m.winner_id === m.player1_id ? 'text-green-400' : 'text-gray-400'}`}>
                            {p1?.display_name?.split(' ')[0]}
                          </span>
                          <span className="text-gray-600 text-xs">vs</span>
                          <span className={`font-bold text-sm ${m.winner_id === m.player2_id ? 'text-green-400' : 'text-gray-400'}`}>
                            {p2?.display_name?.split(' ')[0]}
                          </span>
                        </div>
                        {iParticipated && myStats && (
                          <span className={`text-sm font-bold ${iWon ? 'text-green-400' : 'text-gray-500'}`}>
                            {iWon ? '✓ W' : '✗ L'} +{myStats.pts}
                          </span>
                        )}
                      </div>
                      <p className="text-white text-sm font-mono">{m.set_scores.map(s => `${s.p1}-${s.p2}`).join('  ')}</p>
                      {(m.aces_p1 > 0 || m.aces_p2 > 0) && (
                        <p className="text-gray-600 text-xs mt-1">
                          🎯 {p1?.display_name?.split(' ')[0]}: {m.aces_p1}A · {p2?.display_name?.split(' ')[0]}: {m.aces_p2}A
                        </p>
                      )}
                      {m.notes && <p className="text-gray-500 text-xs mt-1 italic">"{m.notes}"</p>}
                      <p className="text-gray-700 text-xs mt-1">{formatTimeAgo(m.played_at)}</p>
                    </div>
                  )
                })}
              </div>
            )}

            {matches.length === 0 && !isParticipant && (
              <div className="text-center py-10">
                <p className="text-gray-500 text-sm">No matches logged yet.</p>
              </div>
            )}
          </div>
        )}

        {/* ── PRACTICE TAB ── */}
        {tab === 'practice' && (
          <div className="space-y-4">
            {isParticipant && (
              <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 space-y-4">
                <h3 className="text-white font-semibold text-sm">🏋️ Log Practice</h3>

                {practiceSuccess && (
                  <div className="bg-blue-950/30 border border-blue-700/50 rounded-xl px-4 py-3">
                    <p className="text-blue-400 font-bold text-sm">✓ Practice logged! +{practiceSuccess.pts} pts</p>
                    <button onClick={() => setPracticeSuccess(null)} className="text-gray-600 text-xs mt-1">dismiss</button>
                  </div>
                )}

                {/* Duration */}
                <div>
                  <label className="text-gray-400 text-xs block mb-2">Duration</label>
                  <div className="flex gap-2 flex-wrap mb-2">
                    {[30, 45, 60, 90, 120].map(d => (
                      <button key={d} onClick={() => setPracticeDuration(d)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          practiceDuration === d ? 'bg-green-500 text-black' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        }`}>
                        {d}m
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="number" value={practiceDuration} min={10} max={300}
                      onChange={e => setPracticeDuration(Number(e.target.value))}
                      className="w-24 bg-gray-800 text-white rounded-xl px-3 py-2 text-sm border border-gray-700 focus:border-green-500 focus:outline-none" />
                    <span className="text-gray-500 text-sm">min = <span className="text-blue-400 font-bold">{Math.round((practiceDuration / 60) * 10)} pts</span></span>
                  </div>
                </div>

                {/* Drill focus */}
                <div>
                  <label className="text-gray-400 text-xs block mb-2">What did you work on?</label>
                  <div className="flex flex-wrap gap-2">
                    {DRILL_FOCUSES.map(f => (
                      <button key={f.value} onClick={() => setDrillFocus(drillFocus === f.value ? '' : f.value)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                          drillFocus === f.value ? 'bg-green-500 text-black' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        }`}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="text-gray-400 text-xs block mb-1.5">Notes <span className="text-gray-600">(optional)</span></label>
                  <input type="text" value={practiceNotes} onChange={e => setPracticeNotes(e.target.value)}
                    placeholder="e.g. 200 serves, cross-court drills"
                    className="w-full bg-gray-800 text-white rounded-xl px-4 py-2.5 text-sm border border-gray-700 focus:border-green-500 focus:outline-none" />
                </div>

                {practiceError && <p className="text-red-400 text-sm">{practiceError}</p>}
                <button onClick={submitPractice} disabled={loggingPractice}
                  className="w-full bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition-colors">
                  {loggingPractice ? 'Logging...' : `🏋️ Log ${practiceDuration}min Practice (+${Math.round((practiceDuration / 60) * 10)} pts)`}
                </button>
              </div>
            )}

            {/* Practice history */}
            {sessions.length > 0 && (
              <div className="space-y-2">
                <p className="text-gray-500 text-xs font-semibold">ALL PRACTICE SESSIONS</p>
                {sessions.map(s => {
                  const p = profileMap[s.user_id]
                  const focus = DRILL_FOCUSES.find(f => f.value === s.drill_focus)
                  return (
                    <div key={s.id} className="bg-gray-900 rounded-xl p-3 border border-gray-800">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white text-sm font-medium">
                            {focus ? focus.emoji : '🎾'} {p?.display_name?.split(' ')[0]}
                          </p>
                          <p className="text-gray-500 text-xs">
                            {s.duration_minutes}min{focus ? ` · ${focus.label}` : ''}
                          </p>
                          {s.notes && <p className="text-gray-600 text-xs mt-0.5 italic">"{s.notes}"</p>}
                          <p className="text-gray-700 text-xs">{s.session_date}</p>
                        </div>
                        <span className="text-blue-400 font-bold text-sm">+{s.points}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {sessions.length === 0 && !isParticipant && (
              <div className="text-center py-10">
                <p className="text-gray-500 text-sm">No practice sessions yet.</p>
              </div>
            )}
          </div>
        )}

        {/* ── CHAT TAB ── */}
        {tab === 'chat' && (
          <div className="space-y-3">
            {comments.length === 0 && (
              <p className="text-gray-600 text-sm text-center py-6">No trash talk yet. Start something.</p>
            )}
            {comments.map(c => (
              <div key={c.id} className="bg-gray-900 rounded-2xl p-3 border border-gray-800">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-white text-xs font-semibold">{c.profiles?.display_name?.split(' ')[0] || '?'}</span>
                  <span className="text-gray-600 text-xs">{formatTimeAgo(c.created_at)}</span>
                </div>
                <p className="text-gray-300 text-sm">{c.body}</p>
              </div>
            ))}
            <div className="flex gap-2">
              <input type="text" value={commentText} onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && postComment()}
                placeholder="Talk your tennis talk..."
                className="flex-1 bg-gray-900 text-white rounded-xl px-4 py-3 text-sm placeholder-gray-600 border border-gray-800 focus:border-green-500 focus:outline-none" />
              <button onClick={postComment} disabled={postingComment || !commentText.trim()}
                className="bg-green-500 hover:bg-green-400 disabled:opacity-40 text-black font-bold px-4 py-3 rounded-xl text-sm transition-colors">
                {postingComment ? '...' : '→'}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
