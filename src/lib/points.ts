export const WORKOUT_TYPES = [
  { value: 'strength', label: 'Strength / Lifting', basePoints: 10, emoji: '🏋️' },
  { value: 'cardio', label: 'Cardio / Running', basePoints: 8, emoji: '🏃' },
  { value: 'hiit', label: 'HIIT', basePoints: 12, emoji: '⚡' },
  { value: 'flexibility', label: 'Flexibility / Recovery', basePoints: 5, emoji: '🧘' },
  { value: 'sports', label: 'Sports / Active', basePoints: 7, emoji: '⚽' },
  { value: 'other', label: 'Other', basePoints: 6, emoji: '💪' },
] as const

export type WorkoutType = typeof WORKOUT_TYPES[number]['value']

export function getDurationMultiplier(minutes: number): number {
  if (minutes < 30) return 0.75
  if (minutes < 60) return 1.0
  if (minutes < 90) return 1.25
  return 1.5
}

export function calculatePoints(workoutType: WorkoutType, durationMinutes: number): number {
  const type = WORKOUT_TYPES.find(t => t.value === workoutType)
  if (!type) return 0
  const multiplier = getDurationMultiplier(durationMinutes)
  return Math.round(type.basePoints * multiplier)
}

export const WEEKLY_GOAL = 50

export function getWeekStart(date: Date = new Date()): Date {
  const d = new Date(date)
  const day = d.getDay() // 0 = Sunday
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Monday
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function getWeekEnd(date: Date = new Date()): Date {
  const start = getWeekStart(date)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return end
}

export function formatWeekRange(weekStart: Date): string {
  const end = new Date(weekStart)
  end.setDate(weekStart.getDate() + 6)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${weekStart.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}`
}
