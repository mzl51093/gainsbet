'use client'

import { useState, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { WORKOUT_TYPES, calculatePoints, getPtsPerHour, getEarlyBirdMultiplier } from '@/lib/points'
import BottomNav from '@/components/BottomNav'
import type { WorkoutType } from '@/lib/points'

const PROOF_TYPES = [
  { value: 'photo', label: 'Gym Photo', emoji: '📸' },
  { value: 'screenshot', label: 'App Screenshot', emoji: '📱' },
  { value: 'whoop', label: 'Whoop / Tracker', emoji: '⌚' },
  { value: 'other', label: 'Other', emoji: '📎' },
]

const INTENSITY_GROUPS = [
  { label: '🔴 High Intensity', key: 'high', sublabel: '11–16 pts/hr' },
  { label: '🟡 Medium Intensity', key: 'medium', sublabel: '9–10 pts/hr' },
  { label: '🟢 Light Activity', key: 'low', sublabel: '5–7 pts/hr' },
]

interface ParsedWorkout {
  workout_type: WorkoutType
  duration_minutes: number
  pts_per_hour: number  // AI-assessed effort rate
  points: number
  summary: string
}

interface ClarificationNeeded {
  needs_clarification: true
  question: string
  options: string[]
}

function LogWorkoutInner() {
  const router = useRouter()
  const params = useSearchParams()
  const fileRef = useRef<HTMLInputElement>(null)
  const scanRef = useRef<HTMLInputElement>(null)

  // Pre-fill from URL params (e.g. from workout plan recommendations)
  const paramType = (params.get('type') || 'strength') as WorkoutType
  const paramDuration = Number(params.get('duration') || 45)
  const paramNotes = params.get('notes') || ''
  const hasParams = params.has('type')

  const [tab, setTab] = useState<'quick' | 'detailed'>(hasParams ? 'detailed' : 'quick')
  const [quickMode, setQuickMode] = useState<'text' | 'scan'>('text')

  // Quick log state
  const [quickText, setQuickText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parsed, setParsed] = useState<ParsedWorkout | null>(null)
  const [clarification, setClarification] = useState<ClarificationNeeded | null>(null)
  const [parseError, setParseError] = useState('')

  // Scan state
  const [scanFile, setScanFile] = useState<File | null>(null)
  const [scanPreview, setScanPreview] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)

  // Detailed log state
  const [workoutType, setWorkoutType] = useState<WorkoutType>(paramType)
  const [duration, setDuration] = useState(paramDuration)
  const [notes, setNotes] = useState(paramNotes)

  // Shared state
  const [proofType, setProofType] = useState('photo')
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [proofPreview, setProofPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const earlyBird = getEarlyBirdMultiplier()
  const isEarlyBird = earlyBird > 1
  const detailedPoints = calculatePoints(workoutType, duration, earlyBird)
  const ptsPerHour = getPtsPerHour(workoutType)

  function handleProofFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setProofFile(file)
    const reader = new FileReader()
    reader.onloadend = () => setProofPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  function handleScanFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setScanFile(file)
    setParsed(null)
    setParseError('')
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      setScanPreview(result)
    }
    reader.readAsDataURL(file)
  }

  async function handleScan() {
    if (!scanFile || !scanPreview) return
    setScanning(true)
    setParseError('')
    setParsed(null)

    try {
      // Extract base64 data (strip the data:image/...;base64, prefix)
      const [header, base64Data] = scanPreview.split(',')
      const mediaType = header.match(/data:([^;]+)/)?.[1] || 'image/jpeg'

      const res = await fetch('/api/scan-workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64Data, mediaType }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to analyze')
      setParsed({ ...data, points: calculatePoints(data.workout_type, data.duration_minutes, earlyBird) })

      // Auto-set proof to the scanned image
      setProofFile(scanFile)
      setProofPreview(scanPreview)
      setProofType('screenshot')
    } catch (err: any) {
      setParseError(err.message || 'Could not read screenshot. Try again or use text description.')
    } finally {
      setScanning(false)
    }
  }

  async function handleParse(clarificationAnswer?: string) {
    if (!quickText.trim()) return
    setParsing(true)
    setParseError('')
    setParsed(null)

    try {
      const res = await fetch('/api/parse-workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: quickText, clarification: clarificationAnswer }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to parse')

      if (data.needs_clarification) {
        setClarification(data)
        return
      }

      setClarification(null)
      // Use AI's pts_per_hour × duration, then apply early bird on top
      const pph = data.pts_per_hour || 7
      const basePoints = Math.max(1, Math.round(pph * (data.duration_minutes / 60)))
      const finalPoints = Math.round(basePoints * earlyBird)
      setParsed({ ...data, pts_per_hour: pph, points: finalPoints })
    } catch (err: any) {
      setParseError(err.message || 'Could not parse workout. Try again or use Detailed log.')
    } finally {
      setParsing(false)
    }
  }

  async function handleSave(overrideData?: ParsedWorkout) {
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }

    let proofUrl: string | null = null
    const fileToUpload = proofFile
    if (fileToUpload) {
      const ext = fileToUpload.name.split('.').pop()
      const filePath = `${user.id}/${Date.now()}.${ext}`
      const { error: uploadError, data } = await supabase.storage
        .from('workout-proofs')
        .upload(filePath, fileToUpload, { cacheControl: '3600', upsert: false })
      if (uploadError) {
        setError('Failed to upload proof: ' + uploadError.message)
        setLoading(false)
        return
      }
      proofUrl = data.path
    }

    const finalType = overrideData?.workout_type ?? workoutType
    const finalDuration = overrideData?.duration_minutes ?? duration
    const finalPoints = overrideData?.points ?? detailedPoints
    const finalNotes = overrideData?.summary ?? (notes || null)

    const { error: insertError } = await supabase.from('workouts').insert({
      user_id: user.id,
      workout_type: finalType,
      duration_minutes: finalDuration,
      points: finalPoints,
      notes: finalNotes,
      proof_url: proofUrl,
      proof_type: fileToUpload ? proofType : null,
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

      <div className="max-w-lg mx-auto px-4 pt-6 space-y-6">
        {/* Early Bird Banner */}
        {isEarlyBird && (
          <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-2xl p-3 flex items-center gap-3">
            <span className="text-2xl">🌅</span>
            <div>
              <p className="text-yellow-300 font-bold text-sm">Early Bird Special!</p>
              <p className="text-yellow-600 text-xs">Log now for 1.5x points — expires at 9 AM</p>
            </div>
          </div>
        )}

        {/* Tab toggle */}
        <div className="flex bg-gray-900 rounded-xl p-1">
          <button
            onClick={() => { setTab('quick'); setParsed(null); setClarification(null); setParseError('') }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              tab === 'quick' ? 'bg-green-500 text-black' : 'text-gray-400 hover:text-white'
            }`}
          >
            ✨ Quick Log
          </button>
          <button
            onClick={() => setTab('detailed')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              tab === 'detailed' ? 'bg-green-500 text-black' : 'text-gray-400 hover:text-white'
            }`}
          >
            📋 Detailed
          </button>
        </div>

        {/* QUICK LOG TAB */}
        {tab === 'quick' && (
          <div className="space-y-4">
            {/* Mode toggle */}
            <div className="flex bg-gray-900 rounded-xl p-1">
              <button
                onClick={() => { setQuickMode('text'); setParsed(null); setClarification(null); setParseError('') }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  quickMode === 'text' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                ✍️ Describe it
              </button>
              <button
                onClick={() => { setQuickMode('scan'); setParsed(null); setClarification(null); setParseError('') }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  quickMode === 'scan' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                📸 Scan Tracker
              </button>
            </div>

            {/* TEXT MODE */}
            {quickMode === 'text' && !parsed && !clarification && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Describe your workout in plain English
                  </label>
                  <textarea
                    value={quickText}
                    onChange={e => { setQuickText(e.target.value); setParsed(null) }}
                    placeholder={`e.g. "45 min run outside, maybe 4 miles" or "leg day at the gym, squats and deadlifts"`}
                    rows={4}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-green-500 transition-colors resize-none"
                  />
                </div>
                {parseError && <p className="text-red-400 text-sm">{parseError}</p>}
                <button
                  onClick={() => handleParse()}
                  disabled={parsing || !quickText.trim()}
                  className="w-full bg-green-500 hover:bg-green-400 disabled:bg-green-900 disabled:text-green-700 text-black font-bold py-3 rounded-xl transition-colors"
                >
                  {parsing ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin">⚙️</span> Analyzing...
                    </span>
                  ) : 'Analyze with AI'}
                </button>
              </div>
            )}

            {/* CLARIFICATION STEP */}
            {quickMode === 'text' && clarification && !parsed && (
              <div className="space-y-4">
                <div className="bg-gray-900 border border-yellow-700/50 rounded-2xl p-4">
                  <p className="text-xs text-yellow-400 font-medium mb-2 uppercase tracking-wide">One quick question</p>
                  <p className="text-white text-sm font-medium mb-4">{clarification.question}</p>
                  <div className="space-y-2">
                    {clarification.options.map(option => (
                      <button
                        key={option}
                        onClick={() => handleParse(option)}
                        disabled={parsing}
                        className="w-full bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white text-sm py-3 px-4 rounded-xl text-left transition-colors border border-gray-700 hover:border-green-600"
                      >
                        {parsing ? <span className="flex items-center gap-2"><span className="animate-spin">⚙️</span> Calculating...</span> : option}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => setClarification(null)}
                  className="w-full text-gray-500 text-sm py-2"
                >
                  ← Edit description
                </button>
              </div>
            )}

            {/* SCAN MODE */}
            {quickMode === 'scan' && !parsed && !clarification && (
              <div className="space-y-4">
                <p className="text-sm text-gray-400">
                  Upload a screenshot from Whoop, Apple Watch, Peloton, Strava, Garmin — AI will read your stats automatically.
                </p>
                <input
                  ref={scanRef}
                  type="file"
                  accept="image/*"
                  onChange={handleScanFileChange}
                  className="hidden"
                />
                {scanPreview ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={scanPreview} alt="Tracker screenshot" className="w-full rounded-xl object-cover max-h-64" />
                    <button
                      type="button"
                      onClick={() => { setScanFile(null); setScanPreview(null); setParsed(null) }}
                      className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => scanRef.current?.click()}
                    className="w-full bg-gray-900 border-2 border-dashed border-gray-600 hover:border-green-500 rounded-xl py-10 text-center transition-colors"
                  >
                    <p className="text-3xl mb-2">📱</p>
                    <p className="text-white text-sm font-medium">Tap to upload screenshot</p>
                    <p className="text-gray-600 text-xs mt-1">Whoop · Apple Watch · Peloton · Strava · Garmin</p>
                  </button>
                )}

                {parseError && <p className="text-red-400 text-sm">{parseError}</p>}

                {scanFile && (
                  <button
                    onClick={handleScan}
                    disabled={scanning}
                    className="w-full bg-green-500 hover:bg-green-400 disabled:bg-green-900 disabled:text-green-700 text-black font-bold py-3 rounded-xl transition-colors"
                  >
                    {scanning ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="animate-spin">⚙️</span> Reading your stats...
                      </span>
                    ) : 'Analyze Screenshot with AI'}
                  </button>
                )}
              </div>
            )}

            {/* PARSED RESULT (shared for both modes) */}
            {parsed && (
              <div className="space-y-4">
                <div className="bg-gray-900 border border-green-700/50 rounded-2xl p-5">
                  <p className="text-xs text-green-400 font-medium mb-3 uppercase tracking-wide">AI Analysis</p>
                  <p className="text-white text-sm mb-4">{parsed.summary}</p>

                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-gray-800 rounded-xl p-3 text-center">
                      <p className="text-lg">
                        {WORKOUT_TYPES.find(t => t.value === parsed.workout_type)?.emoji || '💪'}
                      </p>
                      <p className="text-xs text-gray-400 mt-1 capitalize">
                        {WORKOUT_TYPES.find(t => t.value === parsed.workout_type)?.label || parsed.workout_type}
                      </p>
                    </div>
                    <div className="bg-gray-800 rounded-xl p-3 text-center">
                      <p className="text-lg font-bold text-white">{parsed.duration_minutes}m</p>
                      <p className="text-xs text-gray-400 mt-1">Duration</p>
                    </div>
                    <div className="bg-gray-800 rounded-xl p-3 text-center">
                      <p className="text-lg font-bold text-green-400">{parsed.points}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {parsed.pts_per_hour} pts/hr{isEarlyBird ? ' 🌅' : ''}
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-gray-600 mb-2">Adjust if needed:</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Type</label>
                      <select
                        value={parsed.workout_type}
                        onChange={e => {
                          const newType = e.target.value as WorkoutType
                          setParsed({ ...parsed, workout_type: newType, points: Math.round(parsed.pts_per_hour * (parsed.duration_minutes / 60) * earlyBird) })
                        }}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none"
                      >
                        {WORKOUT_TYPES.map(t => (
                          <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Duration (min)</label>
                      <input
                        type="number"
                        value={parsed.duration_minutes}
                        onChange={e => {
                          const d = Math.max(10, Math.min(480, Number(e.target.value)))
                          setParsed({ ...parsed, duration_minutes: d, points: Math.max(1, Math.round(parsed.pts_per_hour * (d / 60) * earlyBird)) })
                        }}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Proof section */}
                {renderProofSection()}

                {error && <p className="text-red-400 text-sm">{error}</p>}

                <button
                  onClick={() => handleSave(parsed)}
                  disabled={loading}
                  className="w-full bg-green-500 hover:bg-green-400 disabled:bg-green-900 disabled:text-green-700 text-black font-bold py-4 rounded-xl text-lg transition-colors"
                >
                  {loading ? 'Saving...' : `Log Workout (+${parsed.points} pts)`}
                </button>

                <button
                  onClick={() => { setParsed(null); setClarification(null); setScanFile(null); setScanPreview(null) }}
                  className="w-full text-gray-500 text-sm py-2"
                >
                  Re-analyze
                </button>
              </div>
            )}
          </div>
        )}

        {/* DETAILED LOG TAB */}
        {tab === 'detailed' && (
          <div className="space-y-6">
            {/* Points preview */}
            <div className="bg-green-900/20 border border-green-700/40 rounded-2xl p-4 text-center">
              <p className="text-gray-400 text-sm">You'll earn</p>
              <p className="text-4xl font-bold text-green-400">{detailedPoints} pts</p>
              <p className="text-gray-500 text-xs mt-1">{ptsPerHour} pts/hour · scales with duration</p>
            </div>

            {/* Workout Type by intensity group */}
            <div>
              <label className="block text-sm text-gray-400 mb-3">Workout Type</label>
              <div className="space-y-3">
                {INTENSITY_GROUPS.map(group => {
                  const groupTypes = WORKOUT_TYPES.filter(t => t.intensity === group.key)
                  return (
                    <div key={group.key}>
                      <p className="text-xs text-gray-600 mb-1.5">
                        {group.label} <span className="text-gray-700">· {group.sublabel}</span>
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {groupTypes.map(type => (
                          <button
                            key={type.value}
                            type="button"
                            onClick={() => setWorkoutType(type.value as WorkoutType)}
                            className={`p-3 rounded-xl border-2 transition-colors text-left flex items-center gap-2 ${
                              workoutType === type.value
                                ? 'border-green-500 bg-green-500/10'
                                : 'border-gray-700 bg-gray-900'
                            }`}
                          >
                            <span className="text-xl">{type.emoji}</span>
                            <div>
                              <div className="text-xs text-white leading-tight">{type.label}</div>
                              <div className="text-xs text-gray-600">{type.ptsPerHour} pts/hr</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
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
            {renderProofSection()}

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              onClick={() => handleSave()}
              disabled={loading}
              className="w-full bg-green-500 hover:bg-green-400 disabled:bg-green-900 disabled:text-green-700 text-black font-bold py-4 rounded-xl text-lg transition-colors"
            >
              {loading ? 'Logging...' : `Log Workout (+${detailedPoints} pts)`}
            </button>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )

  function renderProofSection() {
    return (
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
          onChange={handleProofFileChange}
          className="hidden"
        />

        {proofPreview ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={proofPreview} alt="Proof preview" className="w-full rounded-xl object-cover max-h-48" />
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
    )
  }
}

export default function LogWorkoutPage() {
  return (
    <Suspense fallback={null}>
      <LogWorkoutInner />
    </Suspense>
  )
}
