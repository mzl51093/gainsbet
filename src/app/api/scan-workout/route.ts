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
      max_tokens: 200,
      system: `You are a fitness tracking assistant. Analyze workout screenshots from apps like Whoop, Apple Watch, Peloton, Garmin, Strava, Nike Run Club, etc.

Workout types (pick the most specific match):
HIGH: hiit (circuit/intervals), running (jogging/sprints/treadmill run), strength (lifting/weights), swimming
MEDIUM: cycling (spin/peloton/bike), sports (basketball/tennis/soccer), cardio (elliptical/rowing/general)
LOW: walking (walks/hikes/strolls/treadmill walk), flexibility (yoga/pilates/stretching), other

Whoop strain → type: 0-7=walking, 8-12=cardio, 13-16=running or strength, 17-21=hiit
Peloton → cycling (unless it's a strength/yoga/walking class)
High avg HR (>150): bump intensity up. Low avg HR (<120): bump intensity down.

Extract duration in minutes. If you see hours, convert. If unclear, estimate from context.
Write a brief summary mentioning key stats (calories, distance, HR, output, strain, etc.) if visible.

Always respond with ONLY valid JSON:
{"workout_type":"running","duration_minutes":42,"summary":"42-min outdoor run, 3.8 miles, avg HR 158 bpm, 420 cal"}`,
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
            text: 'Analyze this workout screenshot and return JSON with workout_type, duration_minutes, and summary.',
          },
        ],
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const parsed = JSON.parse(cleaned)

    const rawType = (parsed.workout_type || '').toLowerCase()
    const VALID_TYPES_ARR = ['hiit', 'running', 'strength', 'swimming', 'cycling', 'sports', 'cardio', 'walking', 'flexibility', 'other'] as const
    const workoutType: WorkoutType = VALID_TYPES_ARR.includes(rawType as WorkoutType)
      ? rawType as WorkoutType
      : (TYPE_ALIASES[rawType] ?? 'other')

    const durationMinutes = Math.max(10, Math.min(300, Math.round(parsed.duration_minutes || 45)))
    const points = calculatePoints(workoutType, durationMinutes)

    return NextResponse.json({
      workout_type: workoutType,
      duration_minutes: durationMinutes,
      points,
      summary: parsed.summary || 'Workout logged via screenshot',
    })
  } catch (err) {
    console.error('Scan workout error:', err)
    return NextResponse.json({ error: 'Failed to analyze screenshot' }, { status: 500 })
  }
}
