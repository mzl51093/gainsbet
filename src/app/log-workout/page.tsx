'use client'

import { useState, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { WORKOUT_TYPES, calculatePoints, getPtsPerHour } from '@/lib/points'
import type { WorkoutType } from '@/lib/points'

const PROOF_TYPES = [
  { value: 'photo', label: 'Gym Photo', emoji: '📸' },
  { value: 'screenshot', label: 'App Screenshot', emoji: '📱' },
  { value: 'whoop', label: 'Whoop / Tracker', emoji: '⌚' },
  { value: 'other', label: 'Other', emoji: '📎' },
]

const TIER_GROUPS = [
  { label: '💀 12 pts/hr', tier: 12 },
  { label: '🔥 10 pts/hr', tier: 10 },
  { label: '⚡ 8 pts/hr',  tier: 8 },
  { label: '🏋️ 7 pts/hr',  tier: 7 },
  { label: '🚣 6 pts/hr',  tier: 6 },
  { label: '💪 4 pts/hr',  tier: 4 },
  { label: '🚶 2 pts/hr',  tier: 2 },
  { label: '🐕 1 pt/hr',   tier: 1 },
  { label: '⛳ 0.5 pts/hr', tier: 0.5 },
  { label: '🧘 0 pts',     tier: 0 },
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
  const draftId = params.get('draftId') || null
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
  const [proofFiles, setProofFiles] = useState<File[]>([])
  const [proofPreviews, setProofPreviews] = useState<string[]>([])
  const [userNotes, setUserNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const detailedPoints = calculatePoints(workoutType, duration)
  const ptsPerHour = getPtsPerHour(workoutType)

  function handleProofFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newFiles = Array.from(e.target.files || []).slice(0, 5)
    if (newFiles.length === 0) return
    // Reset input so the same file can be re-selected if removed
    e.target.value = ''
    setProofFiles(prev => [...prev, ...newFiles].slice(0, 5))
    newFiles.forEach(file => {
      const reader = new FileReader()
      reader.onloadend = () => setProofPreviews(prev => [...prev, reader.result as string].slice(0, 5))
      reader.readAsDataURL(file)
    })
  }

  function removeProofFile(index: number) {
    setProofFiles(prev => prev.filter((_, i) => i !== index))
    setProofPreviews(prev => prev.filter((_, i) => i !== index))
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
      const pph = data.pts_per_hour || getPtsPerHour(data.workout_type)
      const pts = Math.max(1, Math.round(pph * (data.duration_minutes / 60)))
      setParsed({ ...data, pts_per_hour: pph, points: pts })

      // Auto-set proof to the scanned image (replace any existing proof)
      setProofFiles([scanFile])
      setProofPreviews([scanPreview])
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
      const pph = data.pts_per_hour || 7
      const basePoints = Math.max(1, Math.round(pph * (data.duration_minutes / 60)))
      setParsed({ ...data, pts_per_hour: pph, points: basePoints })
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
    if (proofFiles.length > 0) {
      const uploadedPaths: string[] = []
      for (const file of proofFiles) {
        const ext = file.name.split('.').pop()
        const filePath = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error: uploadError, data } = await supabase.storage
          .from('workout-proofs')
          .upload(filePath, file, { cacheControl: '3600', upsert: false })
        if (uploadError) {
          setError('Failed to upload proof: ' + uploadError.message)
          setLoading(false)
          return
        }
        uploadedPaths.push(data.path)
      }
      proofUrl = uploadedPaths.length === 1 ? uploadedPaths[0] : JSON.stringify(uploadedPaths)
    }

    const finalType = overrideData?.workout_type ?? workoutType
    const finalDuration = overrideData?.duration_minutes ?? duration
    const finalPoints = overrideData?.points ?? detailedPoints
    const aiSummary = overrideData?.summary ?? null
    const personalNote = userNotes.trim() || notes.trim() || null
    const finalNotes = aiSummary && personalNote
      ? `${aiSummary}\n\n${personalNote}`
      : aiSummary || personalNote || null

    const validationStatus = draftId
      ? (proofUrl ? 'approved' : 'pending')
      : 'approved'

    const { error: insertError } = await supabase.from('workouts').insert({
      user_id: user.id,
      workout_type: finalType,
      duration_minutes: finalDuration,
      points: finalPoints,
      notes: finalNotes,
      proof_url: proofUrl,
      proof_type: proofFiles.length > 0 ? proofType : null,
      logged_at: new Date().toISOString(),
      ...(draftId ? { draft_competition_id: draftId, validation_status: validationStatus } : {}),
    })

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
    } else {
      fetch('/api/push/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'workout_logged',
          payload: { points: finalPoints, workoutType: finalType },
        }),
      }).catch(() => null)
      router.push(draftId ? `/draft/${draftId}` : '/dashboard')
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
        {/* Draft competition banner */}
        {draftId && (
          <div className="bg-purple-900/30 border border-purple-700/50 rounded-2xl p-3 flex items-center gap-3">
            <span className="text-2xl">🏆</span>
            <div>
              <p className="text-purple-300 font-bold text-sm">Draft Competition Workout</p>
              <p className="text-purple-600 text-xs">Upload proof for auto-approval, or submit for team vote</p>
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
                        {parsed.pts_per_hour} pts/hr
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-gray-600 mb-2">Adjust if needed:</p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Type</label>
                      <select
                        value={parsed.workout_type}
                        onChange={e => {
                          const newType = e.target.value as WorkoutType
                          setParsed({ ...parsed, workout_type: newType, points: Math.round(parsed.pts_per_hour * (parsed.duration_minutes / 60)) })
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
                          const raw = e.target.value
                          const d = parseInt(raw, 10)
                          if (!raw || isNaN(d) || d < 1) return
                          setParsed({ ...parsed, duration_minutes: Math.min(480, d), points: Math.round(parsed.pts_per_hour * (Math.min(480, d) / 60)) })
                        }}
                        onBlur={() => {
                          const d = Math.max(1, Math.min(480, parsed.duration_minutes))
                          setParsed({ ...parsed, duration_minutes: d, points: Math.round(parsed.pts_per_hour * (d / 60)) })
                        }}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
                      />
                      <div className="flex gap-1.5 mt-2">
                        {[20, 30, 45, 60, 90].map(d => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setParsed({ ...parsed, duration_minutes: d, points: Math.round(parsed.pts_per_hour * (d / 60)) })}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              parsed.duration_minutes === d
                                ? 'bg-green-500 text-black'
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                          >
                            {d}m
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Personal commentary */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Your commentary <span className="text-gray-700">(optional)</span></label>
                  <textarea
                    value={userNotes}
                    onChange={e => setUserNotes(e.target.value)}
                    placeholder="How'd it feel? Any PRs? Trash talk for the feed?"
                    rows={2}
                    maxLength={300}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-green-500 transition-colors resize-none"
                  />
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

            {/* Workout Type by pts/hr tier */}
            <div>
              <label className="block text-sm text-gray-400 mb-3">Workout Type</label>
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                {TIER_GROUPS.map(group => {
                  const groupTypes = WORKOUT_TYPES.filter(t => t.tier === group.tier && !('hidden' in t && t.hidden))
                  if (groupTypes.length === 0) return null
                  return (
                    <div key={group.tier}>
                      <p className="text-xs text-gray-500 font-semibold mb-1.5 sticky top-0 bg-gray-950 py-0.5">{group.label}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {groupTypes.map(type => (
                          <button
                            key={type.value}
                            type="button"
                            onClick={() => setWorkoutType(type.value as WorkoutType)}
                            className={`px-3 py-2 rounded-xl border text-xs transition-colors flex items-center gap-1.5 ${
                              workoutType === type.value
                                ? 'border-green-500 bg-green-500/15 text-white'
                                : 'border-gray-700 bg-gray-900 text-gray-300 hover:border-gray-500'
                            }`}
                          >
                            <span>{type.emoji}</span>
                            <span className="leading-tight">{type.label}</span>
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
                min={5}
                max={240}
                step={5}
                value={duration}
                onChange={e => setDuration(Number(e.target.value))}
                className="w-full accent-green-500"
              />
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>5 min</span>
                <span>1 hour</span>
                <span>4 hours</span>
              </div>
              <div className="grid grid-cols-5 gap-2 mt-3">
                {[15, 30, 45, 60, 90].map(d => (
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
              <label className="block text-sm text-gray-400 mb-2">Your commentary <span className="text-gray-600 text-xs">(optional)</span></label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="What did you crush? Any PRs? Trash talk for the feed?"
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

    </div>
  )

  function renderProofSection() {
    const MAX_PHOTOS = 5
    const canAddMore = proofFiles.length < MAX_PHOTOS

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
          multiple
          onChange={handleProofFileChange}
          className="hidden"
        />

        {proofPreviews.length > 0 ? (
          <div>
            <div className="grid grid-cols-3 gap-2">
              {proofPreviews.map((preview, i) => (
                <div key={i} className="relative aspect-square">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={preview}
                    alt={`Proof ${i + 1}`}
                    className="w-full h-full rounded-xl object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeProofFile(i)}
                    className="absolute top-1 right-1 bg-black/70 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs leading-none"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {canAddMore && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="aspect-square rounded-xl border-2 border-dashed border-gray-600 hover:border-gray-400 flex flex-col items-center justify-center text-gray-500 hover:text-gray-300 transition-colors"
                >
                  <span className="text-2xl leading-none">+</span>
                  <span className="text-xs mt-1">Add more</span>
                </button>
              )}
            </div>
            <p className="text-gray-600 text-xs mt-2">{proofFiles.length} / {MAX_PHOTOS} photos</p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full bg-gray-900 border-2 border-dashed border-gray-700 hover:border-gray-500 rounded-xl py-6 text-center transition-colors"
          >
            <p className="text-gray-400 text-sm">Tap to upload proof</p>
            <p className="text-gray-600 text-xs mt-1">Photo, screenshot, tracker — up to 5</p>
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
