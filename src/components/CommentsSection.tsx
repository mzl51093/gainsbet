'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatRelativeTime } from '@/lib/utils'

const WORKOUT_TAUNTS = [
  { label: '🛋️ Couch misses you', text: 'The couch called. It misses you. Just saying.' },
  { label: '🔥 LET\'S GO', text: 'LESSGOOOO 🔥🔥🔥' },
  { label: '💀 That\'s it??', text: 'That\'s it?? My grandma logs more than this 💀' },
  { label: '👏 Okay respect', text: 'Fine. Okay. I respect it. Don\'t let it go to your head.' },
  { label: '😴 Still alive?', text: 'Haven\'t seen you log anything in a while... everything okay out there? 😴' },
]

const WAGER_TAUNTS = [
  { label: '😈 You\'re cooked', text: 'Checked the numbers. You\'re cooked. Fully medium-well. Good luck 😈' },
  { label: '💅 Already planning', text: 'Already mentally spending the prize money tbh 💅' },
  { label: '😤 Prove me wrong', text: 'Go ahead. Prove me wrong. I\'ll wait. (I won\'t wait.)' },
  { label: '👀 I\'m watching', text: 'Just want you to know I\'m watching every single point. No pressure. 👀' },
  { label: '🤝 May the best win', text: 'May the best person win. (It\'s going to be me.)' },
]

interface Comment {
  id: string
  body: string
  created_at: string
  user_id: string
  profiles: { display_name: string }
}

interface Props {
  targetId: string
  targetType: 'workout' | 'wager'
  currentUserId: string
  initialCount?: number
}

export default function CommentsSection({ targetId, targetType, currentUserId, initialCount = 0 }: Props) {
  const [open, setOpen] = useState(false)
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [text, setText] = useState('')
  const [count, setCount] = useState(initialCount)

  const table = targetType === 'workout' ? 'workout_comments' : 'wager_comments'
  const foreignKey = targetType === 'workout' ? 'workout_id' : 'wager_id'
  const taunts = targetType === 'workout' ? WORKOUT_TAUNTS : WAGER_TAUNTS

  async function load() {
    if (comments.length > 0) return
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from(table)
      .select('*, profiles(display_name)')
      .eq(foreignKey, targetId)
      .order('created_at', { ascending: true })
    setComments((data as Comment[]) || [])
    setCount((data || []).length)
    setLoading(false)
  }

  function handleToggle() {
    if (!open) load()
    setOpen(o => !o)
  }

  async function handleSubmit(body: string) {
    if (!body.trim()) return
    setSubmitting(true)
    const supabase = createClient()
    const { data } = await supabase
      .from(table)
      .insert({ [foreignKey]: targetId, user_id: currentUserId, body: body.trim() })
      .select('*, profiles(display_name)')
      .single()
    if (data) {
      setComments(prev => [...prev, data as Comment])
      setCount(c => c + 1)
    }
    setText('')
    setSubmitting(false)
  }

  async function handleDelete(commentId: string) {
    const supabase = createClient()
    await supabase.from(table).delete().eq('id', commentId)
    setComments(prev => prev.filter(c => c.id !== commentId))
    setCount(c => c - 1)
  }

  const label = targetType === 'workout' ? 'comment' : 'taunt'

  return (
    <div className="mt-2">
      <button
        onClick={handleToggle}
        className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-400 transition-colors"
      >
        <span>💬</span>
        <span>{count > 0 ? `${count} ${label}${count === 1 ? '' : 's'}` : `Add a ${label}`}</span>
        {count > 0 && <span className="text-gray-700">{open ? '▲' : '▼'}</span>}
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {/* Quick taunts */}
          <div className="flex flex-wrap gap-1.5">
            {taunts.map(t => (
              <button
                key={t.label}
                onClick={() => handleSubmit(t.text)}
                disabled={submitting}
                className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white px-2 py-1 rounded-lg transition-colors disabled:opacity-40"
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Comments list */}
          {loading ? (
            <p className="text-xs text-gray-600 py-1">Loading...</p>
          ) : comments.length === 0 ? (
            <p className="text-xs text-gray-700 italic py-1">
              {targetType === 'workout'
                ? 'No comments yet. Be the first to say something mean. 😈'
                : 'No trash talk yet. Don\'t be shy. 💅'}
            </p>
          ) : (
            <div className="space-y-1.5">
              {comments.map(c => (
                <div key={c.id} className="flex items-start gap-2 group">
                  <div className="flex-1 bg-gray-800/60 rounded-xl px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-gray-400">
                        {c.profiles?.display_name?.split(' ')[0]}
                      </span>
                      <span className="text-xs text-gray-700">{formatRelativeTime(c.created_at)}</span>
                    </div>
                    <p className="text-sm text-white mt-0.5">{c.body}</p>
                  </div>
                  {c.user_id === currentUserId && (
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="text-gray-700 hover:text-red-500 text-xs pt-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      🗑
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(text) } }}
              placeholder={targetType === 'workout' ? 'Say something... 😈' : 'Talk your trash... 💅'}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-gray-500"
            />
            <button
              onClick={() => handleSubmit(text)}
              disabled={submitting || !text.trim()}
              className="bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white px-3 py-2 rounded-xl text-sm transition-colors"
            >
              {submitting ? '...' : '→'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
