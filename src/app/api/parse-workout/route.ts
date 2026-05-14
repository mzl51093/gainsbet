import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { calculatePoints } from '@/lib/points'
import type { WorkoutType } from '@/lib/points'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const VALID_TYPES = ['hiit', 'running', 'strength', 'swimming', 'cycling', 'sports', 'cardio', 'walking', 'flexibility', 'other'] as const

export async function POST(request: Request) {
  try {
    const { description } = await request.json()
    if (!description?.trim()) {
      return NextResponse.json({ error: 'No description provided' }, { status: 400 })
    }

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      system: `You are a fitness tracking assistant. Parse workout descriptions and return structured JSON.

Workout types (pick the most specific match):
HIGH intensity: hiit (circuit/intervals), running (jogging/sprints), strength (lifting/weights), swimming
MEDIUM intensity: cycling (spin/peloton/bike), sports (basketball/tennis/soccer), cardio (elliptical/rowing/general)
LOW intensity: walking (walks/hikes/strolls), flexibility (yoga/pilates/stretching), other

Always respond with ONLY valid JSON, no explanation. Example:
{"workout_type":"running","duration_minutes":45,"summary":"45-min outdoor run"}`,
      messages: [{
        role: 'user',
        content: `Parse this workout: "${description}"`
      }]
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    // Strip markdown code blocks if Claude wrapped the JSON
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const parsed = JSON.parse(cleaned)

    const workoutType: WorkoutType = VALID_TYPES.includes(parsed.workout_type)
      ? parsed.workout_type
      : 'other'

    const durationMinutes = Math.max(10, Math.min(300, Math.round(parsed.duration_minutes || 45)))
    const points = calculatePoints(workoutType, durationMinutes)

    return NextResponse.json({
      workout_type: workoutType,
      duration_minutes: durationMinutes,
      points,
      summary: parsed.summary || description,
    })
  } catch (err) {
    console.error('Parse workout error:', err)
    return NextResponse.json({ error: 'Failed to parse workout' }, { status: 500 })
  }
}
