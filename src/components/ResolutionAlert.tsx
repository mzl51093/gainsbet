'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const WIN_MESSAGES = [
  "You actually did it. We're as shocked as you are. 🏆",
  "The work paid off. Go ahead, do a little dance. We won't judge. 💃",
  "The gym wins again. Your body is a temple. A winning temple. 🔥",
  "They underestimated you. Classic mistake. Classic you. 👑",
]
const LOSS_MESSAGES = [
  "The couch won this round. It always knew. 🛋️",
  "Ricki is ordering things on Amazon as we speak. Just so you know. 💅",
  "Not your best week. But hey, at least you have a wife who's thriving? 💀",
  "This is fine. Everything is fine. 😭",
]

const CONFETTI = ['🎉', '🏆', '⭐', '🥇', '✨', '💪', '🔥', '🎊']
const SKULL = ['💀', '😭', '😬', '🫠', '😮‍💨']

function pick(arr: string[], seed: string) {
  const n = seed.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return arr[n % arr.length]
}

interface Particle {
  id: number
  emoji: string
  left: number
  delay: number
  duration: number
}

interface AlertState {
  type: 'win' | 'loss'
  title: string
  stake: string
  settleUrl?: string  // where to navigate on "settle up"
}

function makeParticles(isWin: boolean): Particle[] {
  const emojiSet = isWin ? CONFETTI : SKULL
  return Array.from({ length: isWin ? 24 : 12 }, (_, i) => ({
    id: i,
    emoji: emojiSet[i % emojiSet.length],
    left: Math.random() * 100,
    delay: Math.random() * 1.5,
    duration: 1.5 + Math.random() * 2,
  }))
}

export default function ResolutionAlert({ currentUserId }: { currentUserId: string }) {
  const router = useRouter()
  const [alert, setAlert] = useState<AlertState | null>(null)
  const [particles, setParticles] = useState<Particle[]>([])
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    async function checkResolutions() {
      const supabase = createClient()

      // ── 1. Wager resolutions ────────────────────────────────────────────────
      const seenWagerKey = `seen_resolutions_${currentUserId}`
      const seenWagers: string[] = JSON.parse(localStorage.getItem(seenWagerKey) || '[]')

      const { data: wagers } = await supabase
        .from('wagers')
        .select('*')
        .eq('status', 'resolved')
        .not('winner', 'is', null)
        .order('resolved_at', { ascending: false })
        .limit(20)

      const newWagers = (wagers || []).filter(w =>
        !seenWagers.includes(w.id) && (
          (w.team_player_ids || []).includes(currentUserId) ||
          (w.watcher_ids || []).includes(currentUserId)
        )
      )

      if (newWagers.length > 0) {
        localStorage.setItem(seenWagerKey, JSON.stringify(
          [...new Set([...seenWagers, ...newWagers.map(w => w.id)])]
        ))
        const w = newWagers[0]
        const isWorker = (w.team_player_ids || []).includes(currentUserId)
        const didWin = (isWorker && w.winner === 'competitors') || (!isWorker && w.winner === 'partners')
        const stake = didWin
          ? (isWorker ? w.stake_if_competitors_win : w.stake_if_partners_win)
          : (isWorker ? w.stake_if_partners_win : w.stake_if_competitors_win)
        setAlert({ type: didWin ? 'win' : 'loss', title: w.title, stake, settleUrl: '/wagers' })
        setParticles(makeParticles(didWin))
        setTimeout(() => setVisible(true), 100)
        return
      }

      // ── 2. Draft competition completions ────────────────────────────────────
      const seenDraftKey = `seen_draft_completions_${currentUserId}`
      const seenDrafts: string[] = JSON.parse(localStorage.getItem(seenDraftKey) || '[]')

      // Get all draft competitions the user participated in
      const { data: myParts } = await supabase
        .from('draft_participants')
        .select('competition_id, team')
        .eq('user_id', currentUserId)

      const myPartMap: Record<string, string> = Object.fromEntries(
        (myParts || []).map(p => [p.competition_id, p.team])
      )
      const myCompIds = Object.keys(myPartMap)

      if (myCompIds.length === 0) return

      const { data: completedDrafts } = await supabase
        .from('draft_competitions')
        .select('id, name, winner_team, wager_description')
        .in('id', myCompIds)
        .eq('status', 'completed')
        .not('winner_team', 'is', null)
        .order('created_at', { ascending: false })
        .limit(10)

      const newDrafts = (completedDrafts || []).filter(d => !seenDrafts.includes(d.id))

      if (newDrafts.length === 0) return

      localStorage.setItem(seenDraftKey, JSON.stringify(
        [...new Set([...seenDrafts, ...newDrafts.map(d => d.id)])]
      ))

      const draft = newDrafts[0]
      const myTeam = myPartMap[draft.id]
      const didWin = myTeam === draft.winner_team
      const stake = draft.wager_description || 'Bragging rights'

      setAlert({ type: didWin ? 'win' : 'loss', title: draft.name, stake, settleUrl: '/wagers' })
      setParticles(makeParticles(didWin))
      setTimeout(() => setVisible(true), 100)
    }

    checkResolutions()
  }, [currentUserId])

  if (!alert) return null

  const isWin = alert.type === 'win'
  const seed = currentUserId + alert.title
  const message = isWin ? pick(WIN_MESSAGES, seed) : pick(LOSS_MESSAGES, seed)

  function dismiss() { setVisible(false); setTimeout(() => setAlert(null), 500) }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}
      style={{ background: isWin ? 'rgba(0,20,0,0.92)' : 'rgba(20,0,0,0.92)' }}
    >
      {/* Falling particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map(p => (
          <span
            key={p.id}
            className="absolute text-2xl select-none"
            style={{
              left: `${p.left}%`,
              top: '-10%',
              animation: `fall ${p.duration}s ${p.delay}s ease-in forwards`,
            }}
          >
            {p.emoji}
          </span>
        ))}
      </div>

      {/* Modal */}
      <div className={`relative max-w-sm w-full rounded-3xl p-8 text-center border-2 shadow-2xl ${
        isWin ? 'bg-gray-950 border-green-500/60' : 'bg-gray-950 border-red-800/60'
      }`}>
        <div
          className="text-7xl mb-4 inline-block"
          style={{ animation: isWin ? 'bounce-in 0.6s ease-out' : 'shake 0.6s ease-out' }}
        >
          {isWin ? '🏆' : '💀'}
        </div>

        <h2 className={`text-2xl font-black mb-1 ${isWin ? 'text-green-400' : 'text-red-400'}`}>
          {isWin ? 'YOU WON!' : 'YOU LOST.'}
        </h2>
        <p className="text-gray-400 text-sm mb-4 font-medium">{alert.title}</p>

        <div className={`rounded-2xl px-4 py-3 mb-4 ${
          isWin ? 'bg-green-900/30 border border-green-700/50' : 'bg-red-900/30 border border-red-700/50'
        }`}>
          <p className="text-xs text-gray-500 mb-1">{isWin ? 'You earned:' : 'You owe:'}</p>
          <p className={`font-bold text-sm ${isWin ? 'text-green-300' : 'text-red-300'}`}>
            "{alert.stake}"
          </p>
        </div>

        <p className="text-gray-400 text-sm mb-6 italic">{message}</p>

        {isWin ? (
          <button
            onClick={dismiss}
            className="w-full font-bold py-3 rounded-xl text-sm transition-colors bg-green-500 hover:bg-green-400 text-black"
          >
            Collect my glory 👑
          </button>
        ) : (
          <div className="flex flex-col gap-2">
            <button
              onClick={() => {
                setVisible(false)
                setTimeout(() => { setAlert(null); router.push(alert.settleUrl ?? '/wagers') }, 300)
              }}
              className="w-full font-bold py-3 rounded-xl text-sm transition-colors bg-red-600 hover:bg-red-500 text-white"
            >
              Go settle up 💸
            </button>
            <button
              onClick={dismiss}
              className="w-full font-medium py-2 rounded-xl text-xs transition-colors bg-gray-800 hover:bg-gray-700 text-gray-400"
            >
              Close (in shame) 😔
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fall {
          0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
        @keyframes bounce-in {
          0%   { transform: scale(0); }
          60%  { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%       { transform: translateX(-8px) rotate(-5deg); }
          40%       { transform: translateX(8px) rotate(5deg); }
          60%       { transform: translateX(-5px); }
          80%       { transform: translateX(5px); }
        }
      `}</style>
    </div>
  )
}
