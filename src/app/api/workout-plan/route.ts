import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: Request) {
  try {
    const { pointsNeeded, hoursLeft, daysLeft } = await request.json()

    const timeDesc = hoursLeft < 24
      ? `${Math.round(hoursLeft)} hours`
      : `${daysLeft} day${daysLeft === 1 ? '' : 's'}`

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: `You are a fitness coach. Give specific, realistic workout recommendations.

Point rates (pts earned per hour of exercise):
- strength: 12 pts/hr (weight training, lifting)
- hiit: 15 pts/hr (circuits, intervals)
- cardio: 10 pts/hr (running, cycling, swimming)
- sports: 10 pts/hr (basketball, tennis, etc)
- flexibility: 6 pts/hr (yoga, stretching)

Points are calculated as: round(ptsPerHour * durationMinutes / 60).

Return ONLY valid JSON, no markdown:
{"plans":[{"type":"strength","duration_minutes":55,"points":11,"title":"Full Body Lift","description":"3 sets: squats, bench, rows, shoulder press, planks"}]}`,
      messages: [{
        role: 'user',
        content: `I need ${pointsNeeded} more points in ${timeDesc}. Give me 3 different workout options that earn roughly ${pointsNeeded} pts. Keep descriptions to one line.`
      }]
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const { plans } = JSON.parse(cleaned)

    return NextResponse.json({ plans })
  } catch (err) {
    console.error('Workout plan error:', err)
    return NextResponse.json({ error: 'Failed to generate plan' }, { status: 500 })
  }
}
