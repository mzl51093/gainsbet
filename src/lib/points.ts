// Points are earned per hour of effort — longer and harder workouts scale linearly
export const WORKOUT_TYPES = [
  { value: 'strength', label: 'Strength / Lifting', ptsPerHour: 12, emoji: '🏋️' },
  { value: 'cardio', label: 'Cardio / Running', ptsPerHour: 10, emoji: '🏃' },
  { value: 'hiit', label: 'HIIT', ptsPerHour: 15, emoji: '⚡' },
  { value: 'flexibility', label: 'Flexibility / Recovery', ptsPerHour: 6, emoji: '🧘' },
  { value: 'sports', label: 'Sports / Active', ptsPerHour: 10, emoji: '⚽' },
  { value: 'other', label: 'Other', ptsPerHour: 8, emoji: '💪' },
] as const

export type WorkoutType = typeof WORKOUT_TYPES[number]['value']

export function calculatePoints(workoutType: WorkoutType, durationMinutes: number, multiplier = 1): number {
  const type = WORKOUT_TYPES.find(t => t.value === workoutType)
  if (!type) return 0
  return Math.max(1, Math.round(type.ptsPerHour * (durationMinutes / 60) * multiplier))
}

// Returns 1.5 between 6-9 AM local time, else 1
export function getEarlyBirdMultiplier(): number {
  const hour = new Date().getHours()
  return hour >= 6 && hour < 9 ? 1.5 : 1
}

// Keep for display purposes — shows pts/hr rate instead of multiplier
export function getPtsPerHour(workoutType: WorkoutType): number {
  return WORKOUT_TYPES.find(t => t.value === workoutType)?.ptsPerHour ?? 8
}

export const WEEKLY_GOAL = 50

export function getWeekStart(date: Date = new Date()): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
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
