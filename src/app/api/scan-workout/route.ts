import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { calculatePoints } from '@/lib/points'
import type { WorkoutType } from '@/lib/points'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const TYPE_ALIASES: Record<string, WorkoutType> = {
  yoga: 'flexibility',
  pilates: 'flexibility',
  stretching: 'flexibility',
  stretch: 'flexibility',
  jog: 'running',
  jogging: 'running',
  run: 'running',
  bike: 'cycling',
  biking: 'cycling',
  spin: 'cycling',
  lifting: 'strength',
  weights: 'strength',
  crossfit: 'hiit',
  circuit: 'hiit',
  walk: 'walking',
  hike: 'walking',
  hiking: 'walking',
  swim: 'swimming',
  basketball: 'sports',
  tennis: 'sports',
  pickleball: 'sports',
  soccer: 'sports',
  volleyball: 'sports',
}

export async function POST(request: Request) {
  try {
    const { imageBase64, mediaType } = await request.json()
    if (!imageBase64) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    }

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: `You are a fitness effort assessor. Analyze workout screenshots from apps like Whoop, Apple Watch, Peloton, Garmin, Strava, Nike Run Club, etc.

Your job is to assess the ACTUAL effort level and return pts_per_hour accordingly. Use ALL available signals: heart rate, HR zones, strain score, calories, pace, power output, activity type.

EFFORT → pts_per_hour scale:
16: Absolute max — Murph, all-out sprint intervals, max HR sustained
14: Very hard — intense HIIT, CrossFit WODs, race pace
12: Hard — tempo run, heavy lifting, competitive swim, avg HR 160+
10: Moderate-high — jogging, moderate cycling, vigorous sports, avg HR 140-160
8:  Moderate — brisk walk, casual sports, light jogging, avg HR 120-140
6:  Light-moderate — easy hike, gentle yoga, leisurely cycling, avg HR 105-120
4:  Light — slow walk, easy stretching, avg HR 100-115
2:  Very light — golf (walking), slow stroll, avg HR <105, mostly Zone 0

WHOOP STRAIN calibration (strain number is the primary signal):
  0–4  → pts_per_hour: 1–2  (barely moving)
  5–7  → pts_per_hour: 2–3  (light, e.g. golf, slow walk)
  8–10 → pts_per_hour: 4–5  (light-moderate, casual walk)
  11–13 → pts_per_hour: 6–8  (moderate)
  14–16 → pts_per_hour: 9–11 (hard)
  17–21 → pts_per_hour: 12–16 (very hard)
  Adjust based on avg HR and zone distribution if visible.

HR ZONE override rules:
  97%+ Zone 0 (below ~105 bpm) → cap pts_per_hour at 3, regardless of activity name
  Mostly Zone 1 (<120 bpm avg) → cap pts_per_hour at 5
  High Zone 2+ (avg HR 140+) → floor pts_per_hour at 8

GOLF specific:
  Walking 18 holes → pts_per_hour: 2, duration: ~240 min
  Walking 9 holes  → pts_per_hour: 2, duration: ~120 min
  Riding cart 18   → pts_per_hour: 1, duration: ~240 min
  Golf detected from Whoop with low strain (≤7) → always pts_per_hour: 2

Workout types: hiit, running, strength, swimming, cycling, sports, cardio, walking, flexibility, other
  - Whoop strain 0-7 with no clear activity = walking
  - Golf = other

Extract duration in minutes. Write a brief summary with key stats visible (strain, avg HR, distance, calories, etc.).

Return ONLY valid JSON, no markdown:
{"workout_type":"running","duration_minutes":42,"pts_per_hour":10,"summary":"42-min outdoor run, avg HR 158 bpm, 3.8 miles"}`,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: (mediaType || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: 'Analyze this workout screenshot and return JSON with workout_type, duration_minutes, pts_per_hour, and summary.',
          },
        ],
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    let parsed: any
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      console.error('Scan workout — AI returned non-JSON:', cleaned)
      return NextResponse.json({ error: 'Failed to analyze screenshot' }, { status: 500 })
    }

    const rawType = (parsed.workout_type || '').toLowerCase()
    const VALID_TYPES_ARR = ['hiit', 'running', 'strength', 'swimming', 'cycling', 'sports', 'cardio', 'walking', 'flexibility', 'other'] as const
    const workoutType: WorkoutType = VALID_TYPES_ARR.includes(rawType as WorkoutType)
      ? rawType as WorkoutType
      : (TYPE_ALIASES[rawType] ?? 'other')

    const durationMinutes = Math.max(10, Math.min(480, Math.round(parsed.duration_minutes || 45)))
    const ptsPerHour = Math.max(1, Math.min(16, Number(parsed.pts_per_hour) || calculatePoints(workoutType, 60)))
    const points = Math.max(1, Math.round(ptsPerHour * (durationMinutes / 60)))

    return NextResponse.json({
      workout_type: workoutType,
      duration_minutes: durationMinutes,
      pts_per_hour: ptsPerHour,
      points,
      summary: parsed.summary || 'Workout logged via screenshot',
    })
  } catch (err) {
    console.error('Scan workout unexpected error:', err)
    return NextResponse.json({ error: 'Failed to analyze screenshot' }, { status: 500 })
  }
}
