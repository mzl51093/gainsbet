CREATE TABLE draft_competitions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'recruiting',
  point_goal INTEGER NOT NULL DEFAULT 100,
  min_contribution_pct INTEGER NOT NULL DEFAULT 25,
  wager_description TEXT,
  start_date DATE,
  end_date DATE,
  captain_a_id UUID REFERENCES profiles(id),
  captain_b_id UUID REFERENCES profiles(id),
  winner_team TEXT,
  max_participants INTEGER NOT NULL DEFAULT 6,
  pick_number INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES profiles(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE draft_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  competition_id UUID REFERENCES draft_competitions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  team TEXT,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(competition_id, user_id)
);

CREATE TABLE draft_captain_votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  competition_id UUID REFERENCES draft_competitions(id) ON DELETE CASCADE NOT NULL,
  voter_id UUID REFERENCES profiles(id) NOT NULL,
  voted_for_id UUID REFERENCES profiles(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(competition_id, voter_id)
);

ALTER TABLE workouts
  ADD COLUMN IF NOT EXISTS draft_competition_id UUID REFERENCES draft_competitions(id),
  ADD COLUMN IF NOT EXISTS validation_status TEXT NOT NULL DEFAULT 'approved';

CREATE TABLE draft_workout_approvals (
  workout_id UUID REFERENCES workouts(id) ON DELETE CASCADE,
  validator_id UUID REFERENCES profiles(id),
  approved BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (workout_id, validator_id)
);

ALTER TABLE draft_competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_captain_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_workout_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view their competitions"
  ON draft_competitions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM draft_participants dp
    WHERE dp.competition_id = id AND dp.user_id = auth.uid()
  ) OR created_by = auth.uid());

CREATE POLICY "Anyone authenticated can view draft participants"
  ON draft_participants FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can view votes in their competitions"
  ON draft_captain_votes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert themselves as participants"
  ON draft_participants FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can vote once"
  ON draft_captain_votes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = voter_id);

CREATE POLICY "Validators can view approvals"
  ON draft_workout_approvals FOR SELECT TO authenticated USING (true);

CREATE POLICY "Validators can insert approvals"
  ON draft_workout_approvals FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = validator_id);
