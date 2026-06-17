// Points are earned per hour of effort — intensity tiers reflect actual caloric/cardiovascular load
export const WORKOUT_TYPES = [
  // High intensity (12–16 pts/hr)
  { value: 'hiit', label: 'HIIT / Circuit', ptsPerHour: 16, emoji: '⚡', intensity: 'high' },
  { value: 'running', label: 'Running', ptsPerHour: 12, emoji: '🏃', intensity: 'high' },
  { value: 'strength', label: 'Lifting / Weights', ptsPerHour: 12, emoji: '🏋️', intensity: 'high' },
  { value: 'swimming', label: 'Swimming', ptsPerHour: 11, emoji: '🏊', intensity: 'high' },
  // Medium intensity (9–10 pts/hr)
  { value: 'cycling', label: 'Cycling / Spin', ptsPerHour: 10, emoji: '🚴', intensity: 'medium' },
  { value: 'sports', label: 'Sports / Active', ptsPerHour: 10, emoji: '⚽', intensity: 'medium' },
  { value: 'cardio', label: 'Cardio (other)', ptsPerHour: 9, emoji: '💓', intensity: 'medium' },
  // Low intensity (5–7 pts/hr)
  { value: 'walking', label: 'Walking / Hike', ptsPerHour: 5, emoji: '🚶', intensity: 'low' },
  { value: 'flexibility', label: 'Yoga / Stretch', ptsPerHour: 5, emoji: '🧘', intensity: 'low' },
  { value: 'other', label: 'Other', ptsPerHour: 7, emoji: '💪', intensity: 'low' },
] as const

export type WorkoutType = typeof WORKOUT_TYPES[number]['value']

export function calculatePoints(workoutType: WorkoutType, durationMinutes: number): number {
  const type = WORKOUT_TYPES.find(t => t.value === workoutType)
  if (!type) return 0
  return Math.max(1, Math.round(type.ptsPerHour * (durationMinutes / 60)))
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
