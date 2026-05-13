export interface Profile {
  id: string
  display_name: string
  username: string
  role: 'competitor' | 'partner'
  supporting_id: string | null
  avatar_url: string | null
  created_at: string
}

export interface Workout {
  id: string
  user_id: string
  workout_type: string
  duration_minutes: number
  points: number
  notes: string | null
  proof_url: string | null
  proof_type: string | null
  logged_at: string
  created_at: string
  profiles?: Profile
  workout_reactions?: WorkoutReaction[]
  workout_comments?: WorkoutComment[]
}

export interface Wager {
  id: string
  title: string
  description: string | null
  proposed_by: string
  condition_type: 'both_fail' | 'either_fails' | 'one_fails' | 'custom'
  point_threshold: number
  week_start: string
  stake_if_partners_win: string
  stake_if_competitors_win: string
  status: 'pending' | 'active' | 'resolved' | 'expired'
  winner: 'competitors' | 'partners' | null
  resolved_at: string | null
  created_at: string
  profiles?: Profile
  wager_acceptances?: WagerAcceptance[]
}

export interface WagerAcceptance {
  wager_id: string
  user_id: string
  accepted_at: string
  profiles?: Profile
}

export interface WorkoutReaction {
  id: string
  workout_id: string
  user_id: string
  emoji: string
  created_at: string
  profiles?: Profile
}

export interface WorkoutComment {
  id: string
  workout_id: string
  user_id: string
  body: string
  created_at: string
  profiles?: Profile
}
