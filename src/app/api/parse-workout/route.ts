import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { WORKOUT_TYPES, isDistanceBased, calculateDistancePoints } from '@/lib/points'
import type { WorkoutType } from '@/lib/points'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const TYPE_ALIASES: Record<string, WorkoutType> = {
  // common descriptions → canonical slugs
  yoga: 'gentle-yoga', 'hot yoga': 'hiit', 'power yoga': 'hiit', 'vinyasa': 'gentle-yoga',
  stretch: 'stretching', 'foam roll': 'stretching', 'mobility': 'light-recovery',
  walk: 'brisk-walk', 'dog walk': 'easy-walk', 'easy walk': 'easy-walk',
  hike: 'hiking', hiking: 'hiking', 'easy hike': 'hiking', 'moderate hike': 'moderate-hiking', 'hard hike': 'moderate-hiking',
  jog: 'jogging', jogging: 'jogging',
  run: 'running', running: 'running',
  bike: 'cycling', biking: 'cycling',
  swim: 'swimming', swimming: 'swimming',
  'spin class': 'spin', spinning: 'spin',
  lifting: 'strength', weights: 'strength', 'weight training': 'strength',
  'heavy lifting': 'heavy-strength', 'heavy weights': 'heavy-strength',
  'leg day': 'strength', 'push day': 'strength', 'pull day': 'strength',
  circuit: 'circuit', 'circuit training': 'circuit',
  crossfit: 'crossfit', 'cross fit': 'crossfit',
  'orange theory': 'orangetheory', 'f45': 'orangetheory', 'barrys': 'orangetheory',
  basketball: 'basketball', soccer: 'soccer', hockey: 'soccer', lacrosse: 'soccer',
  tennis: 'tennis', pickleball: 'tennis',
  'tennis doubles': 'tennis-doubles', 'pickleball doubles': 'tennis-doubles',
  volleyball: 'volleyball',
  boxing: 'boxing', 'martial arts': 'boxing', karate: 'boxing', 'jiu-jitsu': 'boxing',
  sparring: 'boxing-sparring', mma: 'boxing-sparring',
  'rock climbing': 'rock-climbing', climbing: 'rock-climbing',
  rowing: 'rowing', 'row machine': 'rowing',
  stairmaster: 'stairmaster', stairs: 'stairmaster',
  pilates: 'pilates', barre: 'barre',
  dance: 'dance', zumba: 'dance',
  core: 'core-workout', abs: 'core-workout',
  kayak: 'kayaking', paddleboard: 'kayaking',
  hiit: 'hiit', 'jump rope': 'plyometrics', plyos: 'plyometrics',
  'assault bike': 'assault-bike', 'ski erg': 'assault-bike', 'battle ropes': 'assault-bike',
  metcon: 'metcon', wod: 'crossfit', 'track workout': 'sprint-intervals',
  hyrox: 'hyrox', spartan: 'spartan-race', 'tough mudder': 'spartan-race',
  golf: 'golf-walking', 'golf walking': 'golf-walking', 'golf cart': 'golf-cart',
  'driving range': 'driving-range', 'golf simulator': 'golf-simulator',
  elliptical: 'easy-elliptical', cardio: 'moderate-cardio',
  peloton: 'peloton', tonal: 'strength',
  // old slugs
  sports: 'basketball', flexibility: 'gentle-yoga', other: 'moderate-cardio',
  walking: 'brisk-walk',
}


// ─── AI prompt ────────────────────────────────────────────────────────────────
// AI assesses actual effort level and returns pts_per_hour directly.
// This lets it distinguish a jog from a sprint, yoga from hot yoga, etc.
// Points = pts_per_hour × (duration / 60) — computed by our code, not the AI.

const SYSTEM_PROMPT = `You are a fitness effort assessor. Given a workout description, return ONLY valid JSON with no markdown, no explanation.

DISTANCE-BASED ACTIVITIES (1 pt per mile — use "miles" field, NOT pts_per_hour):
  Types: running, jogging, brisk-walk, easy-walk, hiking, moderate-hiking, golf-walking
  Always return "miles". Estimate from pace if not stated:
    easy-walk 2.5 mph | brisk-walk 3.5 mph | jogging 5 mph
    running: easy 5 mph, moderate 6.5 mph, fast 8+ mph
    hiking 2 mph | golf-walking ~4.5 miles per round (3–5 hr)
  Format: {"workout_type":"running","duration_minutes":30,"miles":3.2,"points":3.2,"summary":"30-min run, ~3.2 miles"}

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
Adjust ±1 based on effort cues. Format: {"workout_type":"strength","duration_minutes":45,"pts_per_hour":7,"summary":"45-min strength session"}

GOLF (strict):
  Cart → golf-cart, 0.5 pts/hr | Range → driving-range, 1 pts/hr | Walking course → golf-walking + miles

REP-BASED: ~1 min per 10 reps. 50 push-ups → 5 min bodyweight at 4 pts/hr.

CLARIFICATION — only when effort is genuinely ambiguous AND score diff > 10 pts:
{"needs_clarification":true,"question":"...","options":["Option A","Option B"]}
Never ask about duration — estimate it.`

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const { description, clarification } = await request.json()
    if (!description?.trim()) {
      return NextResponse.json({ error: 'No description provided' }, { status: 400 })
    }

    const combined = clarification
      ? `${description}. Additional context: ${clarification}`
      : description

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Assess this workout: "${combined}"` }]
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    let parsed: any
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      console.error('Parse workout — AI returned non-JSON:', cleaned)
      return NextResponse.json({ error: 'Failed to parse workout' }, { status: 500 })
    }

    // Clarification request — pass through as-is
    if (parsed.needs_clarification) {
      return NextResponse.json(parsed)
    }

    const rawType = (parsed.workout_type || '').toLowerCase().trim()
    const VALID_SLUGS = WORKOUT_TYPES.map(t => t.value)
    const workoutType: WorkoutType = (VALID_SLUGS.includes(rawType as WorkoutType) ? rawType : TYPE_ALIASES[rawType]) as WorkoutType ?? 'moderate-cardio'

    const durationMinutes = Math.max(1, Math.min(480, Math.round(parsed.duration_minutes || 30)))

    // Distance-based scoring: 1 pt/mile
    // Always go through this path for distance types — estimate pace if AI omitted miles
    if (isDistanceBased(workoutType)) {
      let miles: number
      if (parsed.miles != null && Number(parsed.miles) > 0) {
        miles = Math.max(0.1, Math.min(200, Number(parsed.miles)))
      } else {
        // AI didn't return miles — estimate from typical pace × duration
        const PACE_MPH: Partial<Record<WorkoutType, number>> = {
          'easy-walk': 2.5, 'brisk-walk': 3.5, 'walking': 2.5,
          'jogging': 5, 'running': 6.5,
          'hiking': 2, 'moderate-hiking': 2.5, 'golf-walking': 3,
        }
        const mph = PACE_MPH[workoutType] ?? 3
        miles = Math.round(mph * (durationMinutes / 60) * 10) / 10
      }
      const points = calculateDistancePoints(miles)
      return NextResponse.json({
        workout_type: workoutType,
        duration_minutes: durationMinutes,
        miles,
        points,
        summary: parsed.summary || description,
      })
    }

    const ptsPerHour = Math.max(1, Math.min(16, Number(parsed.pts_per_hour) || 7))
    const points = Math.max(1, Math.round(ptsPerHour * (durationMinutes / 60)))

    return NextResponse.json({
      workout_type: workoutType,
      duration_minutes: durationMinutes,
      pts_per_hour: ptsPerHour,
      points,
      summary: parsed.summary || description,
    })
  } catch (err) {
    console.error('Parse workout unexpected error:', err)
    return NextResponse.json({ error: 'Failed to parse workout' }, { status: 500 })
  }
}
