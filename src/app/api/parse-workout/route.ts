import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
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
  walking: 'walking',
  hike: 'walking',
  hiking: 'walking',
  swim: 'swimming',
  basketball: 'sports',
  tennis: 'sports',
  pickleball: 'sports',
  soccer: 'sports',
  volleyball: 'sports',
}


// ─── AI prompt ────────────────────────────────────────────────────────────────
// AI assesses actual effort level and returns pts_per_hour directly.
// This lets it distinguish a jog from a sprint, yoga from hot yoga, etc.
// Points = pts_per_hour × (duration / 60) — computed by our code, not the AI.

const SYSTEM_PROMPT = `You are a fitness effort assessor. Given a workout description, determine the effort level and return ONLY valid JSON with no markdown, no explanation, no extra text.

EFFORT SCALE — pts_per_hour based on actual cardiovascular and physical exertion:
16: Absolute max — Murph, death circuit, all-out sprint intervals
14: Very hard — intense HIIT, CrossFit WODs, race pace
12: Hard — tempo run, heavy lifting session, competitive swim
10: Moderate-high — jogging, moderate cycling, vigorous sports, bootcamp
8:  Moderate — brisk walk, casual sports, light jogging, reformer pilates
6:  Light-moderate — easy hike, active yoga, leisurely cycling, shooting hoops
4:  Light — slow walk, casual swim, easy stretching, recreational ping pong
2:  Very light — golf cart, slow stroll, light stretching

ACTIVITY CALIBRATION (use these as anchors — adjust up/down based on context clues):
Running:
  easy jog → 8 | regular run → 10 | tempo/race pace → 12 | sprint intervals → 14

Lifting / strength:
  light machine work → 8 | moderate lifting → 10 | heavy compound lifts → 12 | max effort (squat/deadlift day) → 14

HIIT / circuits:
  moderate bootcamp → 10 | hard intervals → 12 | Murph / max effort → 14-16

Cycling:
  casual bike ride → 6 | moderate road cycling → 8 | hard Peloton/spin → 11

Swimming:
  recreational splashing → 4 | easy laps → 8 | swim workout → 11

Hiking:
  flat easy trail → 5 | moderate hills → 8 | strenuous mountain (significant elevation) → 11

Basketball:
  shooting around → 4 | casual pickup game → 7 | competitive full-court → 10

Soccer / tennis / pickleball:
  recreational → 7 | competitive match → 10

Volleyball:
  casual backyard → 4 | competitive → 8

Softball / baseball:
  → 5 (lots of standing between plays regardless of pace)

Yoga:
  restorative / gentle → 3 | vinyasa → 5 | hot yoga / power yoga → 8

Pilates:
  mat pilates → 5 | reformer → 7

Golf:
  riding a cart, 18 holes → pts_per_hour: 1, duration: 240 (total ~4 pts)
  walking the course, 18 holes → pts_per_hour: 3, duration: 270 (total ~14 pts)
  riding a cart, 9 holes → pts_per_hour: 1, duration: 120 (total ~2 pts)
  walking the course, 9 holes → pts_per_hour: 3, duration: 135 (total ~6 pts)
  driving range only → pts_per_hour: 2, duration: 60 (total ~2 pts)

Ping pong / table tennis:
  casual → 3 | competitive → 6

Elliptical / rowing / stairmaster → 9
Jump rope → 11
Boxing / martial arts → 10-12
Dancing → 5-8 depending on intensity

REP-BASED EXERCISES — when the description is rep counts with no duration, estimate a realistic time:
  50 sit-ups → duration: 5, strength, pts_per_hour: 8
  100 push-ups → duration: 10, strength, pts_per_hour: 10
  50 push-ups → duration: 5, strength, pts_per_hour: 10
  100 squats → duration: 10, strength, pts_per_hour: 10
  100 burpees → duration: 15, hiit, pts_per_hour: 12
  General rule: ~1 minute per 10 reps for most bodyweight exercises. Scale pts_per_hour by intensity.

RETURN FORMAT (single JSON object, NO markdown fences, no extra text — just the raw JSON):
{"workout_type":"running","duration_minutes":45,"pts_per_hour":10,"summary":"Easy 45-min jog, moderate pace"}

workout_type must be one of: hiit, running, strength, swimming, cycling, sports, cardio, walking, flexibility, other
  - Use the closest match for display/emoji purposes (e.g. pickleball → sports, hiking → walking, pilates → flexibility)
  - The pts_per_hour you set overrides the type's default rate, so pick what fits best

CLARIFICATION — only ask when BOTH are true:
  1. The effort level is genuinely unclear from the description
  2. The score difference between interpretations is large (>6 pts)

When needed, return:
{"needs_clarification":true,"question":"Your question here","options":["Option A","Option B"]}

Examples of when to ask: "played golf" (walk vs ride = 2 vs 14 pts)
Examples of when NOT to ask: "played basketball" (assume pickup game), "went for a hike" (assume moderate), "did yoga" (assume vinyasa), "50 sit-ups" (estimate duration, no need to ask)`

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

    const rawType = (parsed.workout_type || '').toLowerCase()
    const VALID_TYPES_ARR = ['hiit', 'running', 'strength', 'swimming', 'cycling', 'sports', 'cardio', 'walking', 'flexibility', 'other'] as const
    const workoutType: WorkoutType = VALID_TYPES_ARR.includes(rawType as WorkoutType)
      ? rawType as WorkoutType
      : (TYPE_ALIASES[rawType] ?? 'other')

    const durationMinutes = Math.max(10, Math.min(480, Math.round(parsed.duration_minutes || 45)))
    const ptsPerHour = Math.max(1, Math.min(16, Number(parsed.pts_per_hour) || 7))

    // Points from rate — our code computes this, AI only provides the rate
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
