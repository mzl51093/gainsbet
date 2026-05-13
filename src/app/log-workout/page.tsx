'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { WORKOUT_TYPES, calculatePoints, getDurationMultiplier } from '@/lib/points'
import BottomNav from '@/components/BottomNav'
import type { WorkoutType } from '@/lib/points'

const PROOF_TYPES = [
  { value: 'photo', label: 'Gym Photo', emoji: '📸' },
  { value: 'screenshot', label: 'App Screenshot', emoji: '📱' },
  { value: 'whoop', label: 'Whoop / Tracker', emoji: '⌚' },
  { value: 'other', label: 'Other', emoji: '📎' },
]

export default function LogWorkoutPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [workoutType, setWorkoutType] = useState<WorkoutType>('strength')
  const [duration, setDuration] = useState(45)
  const [notes, setNotes] = useState('')
  const [proofType, setProofType] = useState('photo')
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [proofPreview, setProofPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const points = calculatePoints(workoutType, duration)
  const multiplier = getDurationMultiplier(duration)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setProofFile(file)
    const reader = new FileReader()
    reader.onloadend = () => setProofPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }

    let proofUrl: string | null = null

    // Upload proof if provided
    if (proofFile) {
      const ext = proofFile.name.split('.').pop()
      const filePath = `${user.id}/${Date.now()}.${ext}`
      const { error: uploadError, data } = await supabase.storage
        .from('workout-proofs')
        .upload(filePath, proofFile, { cacheControl: '3600', upsert: false })

      if (uploadError) {
        setError('Failed to upload proof: ' + uploadError.message)
        setLoading(false)
        return
      }
      proofUrl = data.path
    }

    const { error: insertError } = await supabase.from('workouts').insert({
      user_id: user.id,
      workout_type: workoutType,
      duration_minutes: duration,
      points,
      notes: notes || null,
      proof_url: proofUrl,
      proof_type: proofFile ? proofType : null,
      logged_at: new Date().toISOString(),
    })

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 pb-24">
      <div className="bg-gray-900 px-4 pt-12 pb-6 border-b border-gray-800">
        <div className="max-w-lg mx-auto">
          <h1 className="text-2xl font-bold text-white">Log Workout</h1>
          <p className="text-gray-400 text-sm mt-1">Every rep counts. Prove it.</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Points preview */}
          <div className="bg-green-900/20 border border-green-700/40 rounded-2xl p-4 text-center">
            <p className="text-gray-400 text-sm">You'll earn</p>
            <p className="text-4xl font-bold text-green-400">{points} pts</p>
            <p className="text-gray-500 text-xs mt-1">
              {multiplier}x duration multiplier
            </p>
          </div>

          {/* Workout Type */}
          <div>
            <label className="block text-sm text-gray-400 mb-3">Workout Type</label>
            <div className="grid grid-cols-3 gap-2">
              {WORKOUT_TYPES.map(type => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setWorkoutType(type.value as WorkoutType)}
                  className={`p-3 rounded-xl border-2 transition-colors text-center ${
                    workoutType === type.value
                      ? 'border-green-500 bg-green-500/10'
                      : 'border-gray-700 bg-gray-900'
                  }`}
                >
                  <div className="text-xl mb-1">{type.emoji}</div>
                  <div className="text-xs text-white leading-tight">{type.label}</div>
                  <div className="text-xs text-gray-500">{type.basePoints} base pts</div>
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Duration: <span className="text-white font-semibold">{duration} minutes</span>
            </label>
            <input
              type="range"
              min={15}
              max={180}
              step={5}
              value={duration}
              onChange={e => setDuration(Number(e.target.value))}
              className="w-full accent-green-500"
            />
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>15 min</span>
              <span>1 hour</span>
              <span>3 hours</span>
            </div>
            <div className="grid grid-cols-4 gap-2 mt-3">
              {[30, 45, 60, 90].map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(d)}
                  className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                    duration === d
                      ? 'bg-green-500 text-black'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {d}m
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="What did you crush today?"
              rows={3}
              maxLength={300}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-green-500 transition-colors resize-none"
            />
          </div>

          {/* Proof */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Proof (optional but encouraged)</label>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {PROOF_TYPES.map(pt => (
                <button
                  key={pt.value}
                  type="button"
                  onClick={() => setProofType(pt.value)}
                  className={`p-2 rounded-xl border-2 transition-colors text-center ${
                    proofType === pt.value
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-gray-700 bg-gray-900'
                  }`}
                >
                  <div className="text-lg">{pt.emoji}</div>
                  <div className="text-xs text-gray-400 leading-tight mt-1">{pt.label}</div>
                </button>
              ))}
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />

            {proofPreview ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={proofPreview}
                  alt="Proof preview"
                  className="w-full rounded-xl object-cover max-h-48"
                />
                <button
                  type="button"
                  onClick={() => { setProofFile(null); setProofPreview(null) }}
                  className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full bg-gray-900 border-2 border-dashed border-gray-700 hover:border-gray-500 rounded-xl py-6 text-center transition-colors"
              >
                <p className="text-gray-400 text-sm">Tap to upload proof</p>
                <p className="text-gray-600 text-xs mt-1">Photo, screenshot, tracker export</p>
              </button>
            )}
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-500 hover:bg-green-400 disabled:bg-green-900 disabled:text-green-700 text-black font-bold py-4 rounded-xl text-lg transition-colors"
          >
            {loading ? 'Logging...' : `Log Workout (+${points} pts)`}
          </button>
        </form>
      </div>

      <BottomNav />
    </div>
  )
}
