export const WORKOUT_TYPES = [
  // ── 0 pts/hr — tracked but no competition points ─────────────────────────
  { value: 'meditation',       label: 'Meditation',                       ptsPerHour: 0,    emoji: '🧘', tier: 0 },
  { value: 'sauna',            label: 'Sauna',                            ptsPerHour: 0,    emoji: '🧖', tier: 0 },
  { value: 'cold-plunge',      label: 'Cold Plunge',                      ptsPerHour: 0,    emoji: '🧊', tier: 0 },
  { value: 'breathwork',       label: 'Breathwork',                       ptsPerHour: 0,    emoji: '💨', tier: 0 },

  // ── 0.5 pts/hr ────────────────────────────────────────────────────────────
  { value: 'golf-cart',        label: 'Golf (Cart)',                      ptsPerHour: 0.5,  emoji: '⛳', tier: 0.5 },
  { value: 'golf-simulator',   label: 'Golf Simulator',                   ptsPerHour: 0.5,  emoji: '⛳', tier: 0.5 },
  { value: 'golf-putting',     label: 'Golf Putting / Chipping',          ptsPerHour: 0.5,  emoji: '⛳', tier: 0.5 },
  { value: 'stretching',       label: 'Stretching / Foam Rolling',        ptsPerHour: 0.5,  emoji: '🤸', tier: 0.5 },
  { value: 'light-recovery',   label: 'Light Recovery / Mobility',        ptsPerHour: 0.5,  emoji: '💆', tier: 0.5 },

  // ── 1 pt/hr ───────────────────────────────────────────────────────────────
  { value: 'driving-range',    label: 'Driving Range',                    ptsPerHour: 1,    emoji: '⛳', tier: 1 },
  { value: 'easy-walk',        label: 'Easy Walk / Dog Walk',             ptsPerHour: 1,    emoji: '🐕', tier: 1 },
  { value: 'gentle-yoga',      label: 'Gentle Yoga',                      ptsPerHour: 1,    emoji: '🧘', tier: 1 },
  { value: 'recovery-ride',    label: 'Recovery Ride / Swim',             ptsPerHour: 1,    emoji: '🔄', tier: 1 },
  { value: 'physical-therapy', label: 'Physical Therapy / Rehab',         ptsPerHour: 1,    emoji: '🏥', tier: 1 },

  // ── 2 pts/hr ──────────────────────────────────────────────────────────────
  { value: 'golf-walking',     label: 'Golf (Walking)',                   ptsPerHour: 2,    emoji: '⛳', tier: 2 },
  { value: 'brisk-walk',       label: 'Brisk Walk',                       ptsPerHour: 2,    emoji: '🚶', tier: 2 },
  { value: 'hiking',           label: 'Hiking',                           ptsPerHour: 2,    emoji: '🥾', tier: 2 },
  { value: 'incline-walk',     label: 'Incline Treadmill Walk',           ptsPerHour: 2,    emoji: '⛰️', tier: 2 },
  { value: 'pilates',          label: 'Pilates',                          ptsPerHour: 2,    emoji: '🩰', tier: 2 },
  { value: 'barre',            label: 'Barre',                            ptsPerHour: 2,    emoji: '🩰', tier: 2 },
  { value: 'core-workout',     label: 'Core / Ab Workout',                ptsPerHour: 2,    emoji: '🎯', tier: 2 },
  { value: 'dance',            label: 'Dance',                            ptsPerHour: 2,    emoji: '💃', tier: 2 },
  { value: 'kayaking',         label: 'Kayaking / Paddle Boarding',       ptsPerHour: 2,    emoji: '🛶', tier: 2 },
  { value: 'easy-elliptical',  label: 'Easy Elliptical',                  ptsPerHour: 2,    emoji: '〇', tier: 2 },

  // ── 4 pts/hr ──────────────────────────────────────────────────────────────
  { value: 'jogging',          label: 'Jogging',                          ptsPerHour: 4,    emoji: '🏃', tier: 4 },
  { value: 'stairmaster',      label: 'StairMaster / Stairs',             ptsPerHour: 4,    emoji: '🪜', tier: 4 },
  { value: 'rowing',           label: 'Rowing',                           ptsPerHour: 4,    emoji: '🚣', tier: 4 },
  { value: 'swimming',         label: 'Swimming Laps',                    ptsPerHour: 4,    emoji: '🏊', tier: 4 },
  { value: 'bodyweight',       label: 'Bodyweight / TRX / Resistance',    ptsPerHour: 4,    emoji: '💪', tier: 4 },
  { value: 'moderate-cardio',  label: 'Moderate Cardio',                  ptsPerHour: 4,    emoji: '❤️', tier: 4 },

  // ── 6 pts/hr ──────────────────────────────────────────────────────────────
  { value: 'strength',         label: 'Strength Training',                ptsPerHour: 6,    emoji: '🏋️', tier: 6 },
  { value: 'cycling',          label: 'Cycling (Outdoor/Indoor)',          ptsPerHour: 6,    emoji: '🚴', tier: 6 },
  { value: 'peloton',          label: 'Peloton / Tonal Ride',             ptsPerHour: 6,    emoji: '🚴', tier: 6 },
  { value: 'tennis-doubles',   label: 'Tennis / Pickleball (Doubles)',    ptsPerHour: 6,    emoji: '🎾', tier: 6 },
  { value: 'swimming-moderate',label: 'Moderate Swimming',                ptsPerHour: 6,    emoji: '🏊', tier: 6 },
  { value: 'moderate-rowing',  label: 'Moderate Rowing',                  ptsPerHour: 6,    emoji: '🚣', tier: 6 },

  // ── 8 pts/hr ──────────────────────────────────────────────────────────────
  { value: 'running',          label: 'Running',                          ptsPerHour: 8,    emoji: '🏃', tier: 8 },
  { value: 'heavy-strength',   label: 'Heavy Strength Training',          ptsPerHour: 8,    emoji: '🏋️', tier: 8 },
  { value: 'spin',             label: 'Spin Class',                       ptsPerHour: 8,    emoji: '🔥', tier: 8 },
  { value: 'tennis',           label: 'Tennis / Pickleball (Singles)',    ptsPerHour: 8,    emoji: '🎾', tier: 8 },
  { value: 'basketball',       label: 'Basketball',                       ptsPerHour: 8,    emoji: '🏀', tier: 8 },
  { value: 'soccer',           label: 'Soccer / Hockey / Lacrosse',       ptsPerHour: 8,    emoji: '⚽', tier: 8 },
  { value: 'boxing',           label: 'Boxing / Martial Arts',            ptsPerHour: 8,    emoji: '🥊', tier: 8 },
  { value: 'circuit',          label: 'Circuit Training',                 ptsPerHour: 8,    emoji: '⚡', tier: 8 },
  { value: 'rock-climbing',    label: 'Rock Climbing',                    ptsPerHour: 8,    emoji: '🧗', tier: 8 },
  { value: 'volleyball',       label: 'Volleyball',                       ptsPerHour: 8,    emoji: '🏐', tier: 8 },

  // ── 10 pts/hr ─────────────────────────────────────────────────────────────
  { value: 'hiit',             label: 'HIIT',                             ptsPerHour: 10,   emoji: '⚡', tier: 10 },
  { value: 'crossfit',         label: 'CrossFit',                         ptsPerHour: 10,   emoji: '🔥', tier: 10 },
  { value: 'orangetheory',     label: "OrangeTheory / F45 / Barry's",     ptsPerHour: 10,   emoji: '🍊', tier: 10 },
  { value: 'bootcamp',         label: 'Bootcamp',                         ptsPerHour: 10,   emoji: '💥', tier: 10 },
  { value: 'sprint-intervals', label: 'Sprint Intervals / Track',         ptsPerHour: 10,   emoji: '💨', tier: 10 },
  { value: 'plyometrics',      label: 'Plyometrics / Jump Rope',          ptsPerHour: 10,   emoji: '🦘', tier: 10 },
  { value: 'assault-bike',     label: 'Assault Bike / Ski Erg / Battle Ropes', ptsPerHour: 10, emoji: '💀', tier: 10 },
  { value: 'boxing-sparring',  label: 'Boxing Sparring / MMA',            ptsPerHour: 10,   emoji: '🥊', tier: 10 },
  { value: 'metcon',           label: 'MetCon / Conditioning',            ptsPerHour: 10,   emoji: '🔥', tier: 10 },

  // ── 12 pts/hr ─────────────────────────────────────────────────────────────
  { value: 'hyrox',            label: 'Hyrox Training',                   ptsPerHour: 12,   emoji: '🏅', tier: 12 },
  { value: 'spartan-race',     label: 'Spartan / Tough Mudder',           ptsPerHour: 12,   emoji: '🏆', tier: 12 },
  { value: 'crossfit-comp',    label: 'CrossFit Competition WOD',         ptsPerHour: 12,   emoji: '🏆', tier: 12 },
  { value: 'max-effort',       label: 'Max Effort Conditioning',          ptsPerHour: 12,   emoji: '💀', tier: 12 },

  // ── Legacy slugs (hidden from picker, kept for backwards-compat display) ──
  { value: 'sports',           label: 'Sports / Active',                  ptsPerHour: 8,    emoji: '⚽', tier: 8,  hidden: true },
  { value: 'cardio',           label: 'Cardio',                           ptsPerHour: 4,    emoji: '❤️', tier: 4,  hidden: true },
  { value: 'walking',          label: 'Walking',                          ptsPerHour: 2,    emoji: '🚶', tier: 2,  hidden: true },
  { value: 'flexibility',      label: 'Yoga / Stretch',                   ptsPerHour: 0.5,  emoji: '🧘', tier: 0.5, hidden: true },
  { value: 'other',            label: 'Other',                            ptsPerHour: 4,    emoji: '💪', tier: 4,  hidden: true },
] as const

export type WorkoutType = typeof WORKOUT_TYPES[number]['value']

export function calculatePoints(workoutType: WorkoutType, durationMinutes: number): number {
  const type = WORKOUT_TYPES.find(t => t.value === workoutType)
  if (!type) return 0
  if (type.ptsPerHour === 0) return 0
  return Math.round(type.ptsPerHour * (durationMinutes / 60))
}

export function getPtsPerHour(workoutType: WorkoutType): number {
  return WORKOUT_TYPES.find(t => t.value === workoutType)?.ptsPerHour ?? 4
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
