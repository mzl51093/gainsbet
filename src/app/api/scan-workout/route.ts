import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { WORKOUT_TYPES, calculatePoints, isDistanceBased, calculateDistancePoints } from '@/lib/points'
import type { WorkoutType } from '@/lib/points'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const TYPE_ALIASES: Record<string, WorkoutType> = {
  yoga: 'gentle-yoga', stretch: 'stretching', walk: 'brisk-walk',
  hike: 'hiking', hiking: 'hiking', 'easy hike': 'hiking', 'moderate hike': 'moderate-hiking',
  jog: 'jogging', jogging: 'jogging', run: 'running', running: 'running',
  bike: 'cycling', biking: 'cycling', spin: 'spin',
  lifting: 'strength', weights: 'strength', 'weight training': 'strength',
  circuit: 'circuit', crossfit: 'crossfit',
  basketball: 'basketball', soccer: 'soccer', tennis: 'tennis', pickleball: 'tennis',
  volleyball: 'volleyball', hockey: 'soccer',
  golf: 'golf-walking', 'golf cart': 'golf-cart', 'driving range': 'driving-range',
  rowing: 'rowing', stairmaster: 'stairmaster', swimming: 'swimming',
  hiit: 'hiit', bootcamp: 'bootcamp', elliptical: 'easy-elliptical',
  // legacy slugs
  sports: 'basketball', cardio: 'moderate-cardio', flexibility: 'gentle-yoga',
  walking: 'brisk-walk', other: 'moderate-cardio',
  'swimming-moderate': 'swimming', 'moderate-rowing': 'rowing',
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
      system: `You are a fitness effort assessor. Analyze workout screenshots from apps like Whoop, Apple Watch, Peloton, Garmin, Strava, Nike Run Club, etc. Return ONLY valid JSON, no markdown.

⚠️ WHOOP STRAIN IS NOT DISTANCE: The large number on Whoop (0–21 scale) is STRAIN, never miles.
  Only set "miles" if the screenshot shows an explicit distance label (e.g. "5.1 mi", "8.2 km").
  If no distance label is visible, do NOT include "miles" — use pts_per_hour from the strain table below instead.

DISTANCE-BASED ACTIVITIES (1 pt/mile — only when screenshot shows explicit distance):
  Types: running, jogging, brisk-walk, easy-walk, hiking, moderate-hiking, golf-walking
  Miles must come from a labeled distance field in the screenshot, NOT from strain or HR numbers.
  Format: {"workout_type":"running","duration_minutes":42,"miles":5.2,"points":5.2,"summary":"42-min run, 5.2 miles, avg HR 158"}
  Golf walking → golf-walking + miles from labeled distance field. If no distance shown, use pts_per_hour instead.

ALL OTHER SLUGS (pts/hr × duration):
0:    meditation, sauna, cold-plunge, breathwork
0.5:  golf-cart, golf-simulator, golf-putting, stretching, light-recovery
1:    driving-range, gentle-yoga, recovery-ride, physical-therapy
4:    pilates, barre, core-workout, incline-walk, bodyweight
6:    stairmaster, rowing, swimming, moderate-cardio
7:    strength, cycling, peloton, tennis-doubles
8:    heavy-strength, spin, tennis, basketball, soccer, boxing, circuit, rock-climbing, volleyball
10:   hiit, crossfit, orangetheory, bootcamp, sprint-intervals, plyometrics, assault-bike, boxing-sparring, metcon
12:   hyrox, spartan-race, crossfit-comp, max-effort

WHOOP STRAIN → pts_per_hour (applies to ALL activity types when no explicit distance label is visible):
  0–4 → 0.5–1  |  5–7 → 2–4  |  8–10 → 5–6  |  11–13 → 6–8  |  14–16 → 9–11  |  17–21 → 12

HR ZONE overrides: avg HR < 120 → cap ≤ 5 | avg HR ≥ 150 → floor ≥ 8

Non-distance format: {"workout_type":"strength","duration_minutes":45,"pts_per_hour":7,"summary":"45-min strength, avg HR 140"}`,
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

    // Distance-based scoring: 1 pt/mile
    if (parsed.miles != null && isDistanceBased(workoutType)) {
      const miles = Math.max(0.1, Math.min(200, Number(parsed.miles)))
      const points = calculateDistancePoints(miles)
      return NextResponse.json({
        workout_type: workoutType,
        duration_minutes: durationMinutes,
        miles,
        points,
        summary: parsed.summary || 'Workout logged via screenshot',
      })
    }

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
