import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { WORKOUT_TYPES } from '@/lib/points'
import type { WorkoutType } from '@/lib/points'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const TYPE_ALIASES: Record<string, WorkoutType> = {
  // common descriptions → canonical slugs
  yoga: 'gentle-yoga', 'hot yoga': 'hiit', 'power yoga': 'hiit', 'vinyasa': 'gentle-yoga',
  stretch: 'stretching', 'foam roll': 'stretching', 'mobility': 'light-recovery',
  walk: 'brisk-walk', 'dog walk': 'easy-walk', 'easy walk': 'easy-walk',
  hike: 'hiking', hiking: 'hiking',
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

const SYSTEM_PROMPT = `You are a fitness effort assessor. Given a workout description, pick the most accurate workout_type from the list below and set pts_per_hour to match the actual effort. Return ONLY valid JSON with no markdown, no explanation.

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

Pick the closest slug. The pts_per_hour SHOULD match the slug's default rate above, but you may adjust ±1 tier based on context clues (e.g. "easy jog" = jogging at 4, not running at 8).

REP-BASED EXERCISES — estimate duration when none is given:
  ~1 min per 10 reps. 50 sit-ups → 5 min, core-workout, 2 pts/hr.
  50 push-ups → 5 min, bodyweight, 4. 100 burpees → 15 min, hiit, 10.

GOLF RULES (strict):
  Golf with cart → golf-cart, 0.5 pts/hr
  Driving range → driving-range, 1 pts/hr
  Golf walking the course → golf-walking, 2 pts/hr

RETURN FORMAT (raw JSON only):
{"workout_type":"running","duration_minutes":45,"pts_per_hour":8,"summary":"45-min run at moderate pace"}

CLARIFICATION — only ask when BOTH are true:
  1. Effort level is genuinely ambiguous (not just missing duration)
  2. Score difference between interpretations exceeds 10 pts total

When needed:
{"needs_clarification":true,"question":"...","options":["Option A","Option B"]}

Never ask about duration — estimate it. Never ask for activities with obvious effort levels.`

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
