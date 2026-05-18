'use client'

import { useState, useEffect } from 'react'

const MESSAGES = [
  {
    emoji: '😤',
    title: "Let's get it.",
    body: "Don't f*ck your brother. He picked you for a reason. Don't make it weird at Thanksgiving.",
  },
  {
    emoji: '💸',
    title: 'The meter is running.',
    body: "Every day you skip is a day closer to handing your buddy cash. Is your dignity worth $0? Thought so.",
  },
  {
    emoji: '🔥',
    title: 'They are already training.',
    body: "The other team woke up early this morning. You're still in bed reading this. FIX THAT.",
  },
  {
    emoji: '💀',
    title: 'No dead weight.',
    body: "Your team cannot win if you slack. One lazy bum tanks everyone. Don't be that guy. We beg you.",
  },
  {
    emoji: '👀',
    title: 'Everyone can see your points.',
    body: "There is nowhere to hide. Your score is public. Your excuses are not. Get. To. Work.",
  },
  {
    emoji: '🏋️',
    title: 'This is war.',
    body: "Friendly competition is a lie. They want to beat you. They will talk trash for years if they do. Is that what you want?",
  },
  {
    emoji: '😤',
    title: 'Your captain believed in you.',
    body: "They used a pick on you. A real pick. Honor that or live with the shame. Forever.",
  },
  {
    emoji: '🐔',
    title: 'The other captain is laughing.',
    body: "They think their team is better than yours. Prove them wrong or prove them right. Your call.",
  },
  {
    emoji: '💪',
    title: 'One team. Zero excuses.',
    body: "Sick? Work out anyway. Tired? Work out anyway. Busy? You had time to open this app, didn't you.",
  },
  {
    emoji: '🫵',
    title: "Don't be the reason.",
    body: "Imagine your teammate hitting their goal and looking over at your score. Imagine the silence. The disappointment. Don't.",
  },
  {
    emoji: '🤑',
    title: 'Money is on the line.',
    body: "This isn't for fun anymore. Real stakes. Real pain. Hit your numbers or start practicing your apology.",
  },
  {
    emoji: '👊',
    title: 'Your team or your comfort zone.',
    body: "Pick one. You cannot have both. Champions are uncomfortable every single day.",
  },
  {
    emoji: '🚀',
    title: 'First to move wins.',
    body: "Log a workout before the other team even wakes up. Set the tone. Be the nightmare they didn't see coming.",
  },
  {
    emoji: '😈',
    title: 'Respect is earned in the gym.',
    body: "Talk is cheap. Points are not. Your trash talk means nothing without the receipts.",
  },
  {
    emoji: '🫂',
    title: 'Your team is depending on you.',
    body: "Not in a soft way. In a \"we will never let you live this down\" kind of way. That's real love.",
  },
]

function getStorageKey(competitionId: string) {
  return `draft-kickoff-seen-${competitionId}`
}

export function hasKickoffBeenSeen(competitionId: string): boolean {
  if (typeof window === 'undefined') return false
  return !!localStorage.getItem(getStorageKey(competitionId))
}

interface Props {
  competitionId: string
  onDismiss: () => void
}

export default function DraftKickoffModal({ competitionId, onDismiss }: Props) {
  const [msg] = useState(() => MESSAGES[Math.floor(Math.random() * MESSAGES.length)])

  function dismiss() {
    localStorage.setItem(getStorageKey(competitionId), '1')
    onDismiss()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 pb-8">
      <div className="w-full max-w-sm bg-gray-900 rounded-3xl overflow-hidden shadow-2xl">
        {/* Top accent */}
        <div className="h-1 bg-gradient-to-r from-green-500 via-yellow-400 to-red-500" />

        <div className="px-6 py-7 text-center space-y-4">
          <div className="text-6xl">{msg.emoji}</div>
          <div>
            <h2 className="text-white text-xl font-black tracking-tight">{msg.title}</h2>
            <p className="text-gray-400 text-sm mt-2 leading-relaxed">{msg.body}</p>
          </div>
        </div>

        <div className="px-6 pb-7">
          <button
            onClick={dismiss}
            className="w-full py-3.5 rounded-2xl bg-green-500 hover:bg-green-400 text-black font-black text-sm transition-colors"
          >
            Let's go 🔥
          </button>
        </div>
      </div>
    </div>
  )
}
