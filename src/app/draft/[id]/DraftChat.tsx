'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Message {
  id: string
  user_id: string
  channel: string
  content: string
  created_at: string
  profiles: { display_name: string; username: string } | null
}

interface Props {
  competitionId: string
  currentUserId: string
  myTeam: 'a' | 'b' | null
  initialGroupMessages: Message[]
  initialTeamMessages: Message[]
  teamName: string
}

export default function DraftChat({
  competitionId,
  currentUserId,
  myTeam,
  initialGroupMessages,
  initialTeamMessages,
  teamName,
}: Props) {
  const [activeTab, setActiveTab] = useState<'group' | 'team'>('group')
  const [groupMessages, setGroupMessages] = useState<Message[]>(initialGroupMessages)
  const [teamMessages, setTeamMessages] = useState<Message[]>(initialTeamMessages)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const teamChannel = myTeam ? `team_${myTeam}` : null
  const messages = activeTab === 'group' ? groupMessages : teamMessages

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [activeTab])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`draft-chat-${competitionId}-${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'draft_messages',
          filter: `competition_id=eq.${competitionId}`,
        },
        async (payload) => {
          const raw = payload.new as any

          // Dedupe: skip if we already have this message (optimistic insert)
          const isDupe = (prev: Message[]) => prev.some(m => m.id === raw.id)

          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name, username')
            .eq('id', raw.user_id)
            .single()

          const fullMsg: Message = {
            ...raw,
            profiles: profile ?? { display_name: 'Unknown', username: '' },
          }

          if (raw.channel === 'group') {
            setGroupMessages(prev => isDupe(prev) ? prev : [...prev, fullMsg])
          } else if (raw.channel === teamChannel) {
            setTeamMessages(prev => isDupe(prev) ? prev : [...prev, fullMsg])
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [competitionId, currentUserId, teamChannel])

  async function sendMessage() {
    const content = input.trim()
    if (!content || sending) return

    const channel = activeTab === 'group' ? 'group' : teamChannel
    if (!channel) return

    setInput('')
    setSending(true)

    const supabase = createClient()
    await supabase.from('draft_messages').insert({
      competition_id: competitionId,
      user_id: currentUserId,
      channel,
      content,
    })

    setSending(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="bg-gray-900 rounded-2xl overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-gray-800">
        <button
          onClick={() => setActiveTab('group')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === 'group'
              ? 'text-green-400 border-b-2 border-green-400 -mb-px'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          💬 Group Chat
        </button>
        {myTeam && (
          <button
            onClick={() => setActiveTab('team')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'team'
                ? 'text-green-400 border-b-2 border-green-400 -mb-px'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            🔒 Team Huddle
          </button>
        )}
      </div>

      {/* Channel label */}
      {activeTab === 'team' && (
        <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-800">
          <p className="text-xs text-gray-500">
            🔒 Only <span className="text-gray-300 font-medium">{teamName}</span> can see this
          </p>
        </div>
      )}

      {/* Messages */}
      <div className="h-64 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-600 text-sm text-center">
              {activeTab === 'group'
                ? 'No messages yet. Start the trash talk 🗑️'
                : 'Huddle up! Your strategy stays private here 🤫'}
            </p>
          </div>
        ) : (
          messages.map(msg => {
            const isMe = msg.user_id === currentUserId
            const time = new Date(msg.created_at).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
            })
            return (
              <div key={msg.id} className={`flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}>
                {!isMe && (
                  <span className="text-gray-500 text-xs px-1">
                    {msg.profiles?.display_name ?? 'Unknown'}
                  </span>
                )}
                <div
                  className={`max-w-[78%] px-3 py-2 rounded-2xl text-sm leading-snug ${
                    isMe
                      ? 'bg-green-600 text-white rounded-br-sm'
                      : 'bg-gray-800 text-gray-200 rounded-bl-sm'
                  }`}
                >
                  {msg.content}
                </div>
                <span className="text-gray-700 text-xs px-1">{time}</span>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-800 p-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            activeTab === 'group' ? 'Say something...' : 'Team eyes only...'
          }
          maxLength={1000}
          className="flex-1 bg-gray-800 text-white text-sm rounded-xl px-4 py-2.5 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-green-500 min-w-0"
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || sending}
          className="bg-green-500 hover:bg-green-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold px-4 py-2.5 rounded-xl text-sm transition-colors flex-shrink-0"
        >
          Send
        </button>
      </div>
    </div>
  )
}
