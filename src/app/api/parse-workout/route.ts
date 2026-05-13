import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { calculatePoints } from '@/lib/points'
import type { WorkoutType } from '@/lib/points'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const VALID_TYPES = ['strength', 'cardio', 'hiit', 'flexibility', 'sports', 'other'] as const

export async function POST(request: Request) {
  try {
    const { description } = await request.json()
    if (!description?.trim()) {
      return NextResponse.json({ error: 'No description provided' }, { status: 400 })
    }

    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 512,
      system: `You are a fitness tracking assistant. Parse workout descriptions and return structured JSON.

Workout types and their base points:
- strength: weight training, lifting, resistance (10 pts)
- cardio: running, cycling, swimming, walking (8 pts)
- hiit: high intensity interval training, circuit training (12 pts)
- flexibility: yoga, stretching, pilates, recovery (5 pts)
- sports: basketball, tennis, golf, soccer, etc (7 pts)
- other: anything else (6 pts)

Duration multipliers: <30min=0.75x, 30-60min=1x, 60-90min=1.25x, 90+min=1.5x

Always respond with ONLY valid JSON, no explanation. Example:
{"workout_type":"strength","duration_minutes":45,"summary":"45-min strength training session with cardio intervals"}`,
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
