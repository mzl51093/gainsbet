'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatRelativeTime } from '@/lib/utils'
import { WORKOUT_TYPES, calculatePoints } from '@/lib/points'
import ProofViewer from './ProofViewer'
import CommentsSection from './CommentsSection'
import type { Workout, Profile } from '@/lib/types'

type WorkoutWithRelations = Workout & { profiles: Profile; workout_reactions: any[] }

interface Props {
  initialWorkouts: WorkoutWithRelations[]
  currentUserId: string
}

export default function ActivityFeedClient({ initialWorkouts, currentUserId }: Props) {
  const [workouts, setWorkouts] = useState(initialWorkouts)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editType, setEditType] = useState('')
  const [editDuration, setEditDuration] = useState(0)
  const [editNotes, setEditNotes] = useState('')
  const [saving, setSaving] = useState(false)

  function startEdit(workout: WorkoutWithRelations) {
    setEditingId(workout.id)
    setEditType(workout.workout_type)
    setEditDuration(workout.duration_minutes)
    setEditNotes(workout.notes || '')
  }

  async function handleSave(workoutId: string) {
    setSaving(true)
    const newPoints = calculatePoints(editType as any, editDuration)
    const supabase = createClient()
    const { error } = await supabase.from('workouts').update({
      workout_type: editType,
      duration_minutes: editDuration,
      notes: editNotes || null,
      points: newPoints,
    }).eq('id', workoutId)

    if (!error) {
      setWorkouts(prev => prev.map(w => w.id === workoutId ? {
        ...w,
        workout_type: editType,
        duration_minutes: editDuration,
        notes: editNotes || null,
        points: newPoints,
      } : w))
      setEditingId(null)
    }
    setSaving(false)
  }

  async function handleDelete(workoutId: string) {
    if (!confirm('Delete this workout?')) return
    const supabase = createClient()
    await supabase.from('workouts').delete().eq('id', workoutId)
    setWorkouts(prev => prev.filter(w => w.id !== workoutId))
  }

  if (workouts.length === 0) return null

  return (
    <div className="space-y-3">
      {workouts.map(workout => {
        const wType = WORKOUT_TYPES.find(t => t.value === workout.workout_type)
        const reactionCount = (workout.workout_reactions || []).length
        const isOwn = workout.user_id === currentUserId
        const isEditing = editingId === workout.id

        return (
          <div key={workout.id} className="bg-gray-900 rounded-2xl p-4">
            {isEditing ? (
              <div className="space-y-3">
                <select value={editType} onChange={e => setEditType(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500">
                  {WORKOUT_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>
                  ))}
                </select>
                <div className="flex items-center gap-3">
                  <label className="text-gray-400 text-sm shrink-0">Duration (min)</label>
                  <input type="number" value={editDuration} min={1} max={600}
                    onChange={e => setEditDuration(Number(e.target.value))}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500" />
                </div>
                <input type="text" value={editNotes} onChange={e => setEditNotes(e.target.value)}
                  placeholder="Notes (optional)"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500" />
                <p className="text-xs text-gray-500">
                  New points: <span className="text-green-400 font-bold">{calculatePoints(editType as any, editDuration)}</span>
                </p>
                <div className="flex gap-2">
                  <button onClick={() => handleSave(workout.id)} disabled={saving}
                    className="flex-1 bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-bold py-2 rounded-xl text-sm transition-colors">
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button onClick={() => setEditingId(null)}
                    className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-xl text-sm transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{wType?.emoji || '💪'}</span>
                    <div>
                      <p className="text-white font-medium text-sm">
                        {workout.profiles?.display_name || 'Unknown'}
                      </p>
                      <p className="text-gray-500 text-xs">
                        {wType?.label} · {workout.duration_minutes}min
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="text-right">
                      <span className="text-green-400 font-bold">+{workout.points}</span>
                      <p className="text-xs text-gray-600">{formatRelativeTime(workout.logged_at)}</p>
                    </div>
                    {isOwn && (
                      <div className="flex gap-1 pt-0.5">
                        <button onClick={() => startEdit(workout)}
                          className="text-gray-600 hover:text-gray-300 transition-colors text-sm leading-none px-1">
                          ✏️
                        </button>
                        <button onClick={() => handleDelete(workout.id)}
                          className="text-gray-600 hover:text-red-400 transition-colors text-sm leading-none px-1">
                          🗑
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {workout.notes && (
                  <p className="text-gray-400 text-sm mt-2 ml-8">{workout.notes}</p>
                )}
                {workout.proof_url && (
                  <div className="mt-2 ml-8">
                    <ProofViewer proofUrl={workout.proof_url} proofType={workout.proof_type} />
                  </div>
                )}
                {reactionCount > 0 && (
                  <div className="mt-2 ml-8 flex gap-1">
                    {(workout.workout_reactions || []).slice(0, 5).map((r: any) => (
                      <span key={r.id} className="text-sm">{r.emoji}</span>
                    ))}
                  </div>
                )}
                <div className="ml-8">
                  <CommentsSection
                    targetId={workout.id}
                    targetType="workout"
                    currentUserId={currentUserId}
                    initialCount={(workout.workout_comments || []).length}
                  />
                </div>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
