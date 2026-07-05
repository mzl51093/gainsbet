import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { WORKOUT_TYPES } from '@/lib/points'
import type { WorkoutType } from '@/lib/points'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const TYPE_ALIASES: Record<string, WorkoutType> = {
  yoga: 'gentle-yoga', stretch: 'stretching', walk: 'brisk-walk', hike: 'hiking',
  jog: 'jogging', jogging: 'jogging', run: 'running', running: 'running',
  bike: 'cycling', biking: 'cycling', spin: 'spin',
  lifting: 'strength', weights: 'strength', 'weight training': 'strength',
  circuit: 'circuit', crossfit: 'crossfit',
  basketball: 'basketball', soccer: 'soccer', tennis: 'tennis', pickleball: 'tennis',
  volleyball: 'volleyball', hockey: 'soccer',
  golf: 'golf-walking', 'golf cart': 'golf-cart', 'driving range': 'driving-range',
  rowing: 'rowing', stairmaster: 'stairmaster', swimming: 'swimming',
  hiit: 'hiit', bootcamp: 'bootcamp', elliptical: 'easy-elliptical',
  // old slugs
  sports: 'basketball', cardio: 'moderate-cardio', flexibility: 'gentle-yoga',
  walking: 'brisk-walk', other: 'moderate-cardio',
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

Pick the most accurate workout_type slug AND set pts_per_hour based on actual effort signals (HR, zones, strain, pace, power).

WORKOUT TYPE SLUGS AND DEFAULT RATES (pts/hr):
0:    meditation, sauna, cold-plunge, breathwork
0.5:  golf-cart, golf-simulator, golf-putting, stretching, light-recovery
1:    driving-range, easy-walk, gentle-yoga, recovery-ride, physical-therapy
2:    golf-walking, brisk-walk, hiking, incline-walk, pilates, barre, core-workout, dance, kayaking, easy-elliptical
4:    jogging, stairmaster, rowing, swimming, bodyweight, moderate-cardio
6:    strength, cycling, peloton, tennis-doubles, swimming-moderate, moderate-rowing
8:    running, heavy-strength, spin, tennis, basketball, soccer, boxing, circuit, rock-climbing, volleyball
10:   hiit, crossfit, orangetheory, bootcamp, sprint-intervals, plyometrics, assault-bike, boxing-sparring, metcon
12:   hyrox, spartan-race, crossfit-comp, max-effort

WHOOP STRAIN → pts_per_hour:
  0–4 → 0.5–1  |  5–7 → 2–3  |  8–10 → 4–5  |  11–13 → 6–8  |  14–16 → 9–11  |  17–21 → 12

HR ZONE overrides (apply after strain):
  97%+ Zone 0 (HR < 105 bpm) → hard cap: pts_per_hour ≤ 2
  Mostly Zone 1 (avg HR < 120) → cap: pts_per_hour ≤ 5
  Avg HR ≥ 150 → floor: pts_per_hour ≥ 8

GOLF (strict):
  Cart → golf-cart, 0.5 pts/hr  |  Walking → golf-walking, 2 pts/hr  |  Range → driving-range, 1 pt/hr

Extract duration in minutes from the screenshot. Write a short summary with visible stats (strain, avg HR, distance, calories, etc.).

Return ONLY valid JSON, no markdown:
{"workout_type":"running","duration_minutes":42,"pts_per_hour":8,"summary":"42-min run, avg HR 158 bpm, 3.8 miles"}`,
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

    const rawType = (parsed.workout_type || '').toLowerCase().trim()
    const VALID_SLUGS = WORKOUT_TYPES.map(t => t.value)
    const workoutType: WorkoutType = (VALID_SLUGS.includes(rawType as WorkoutType) ? rawType : TYPE_ALIASES[rawType]) as WorkoutType ?? 'moderate-cardio'

    const durationMinutes = Math.max(1, Math.min(480, Math.round(parsed.duration_minutes || 30)))
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
