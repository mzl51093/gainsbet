CREATE TABLE wager_followers (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  wager_id UUID REFERENCES wagers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, wager_id)
);

CREATE TABLE draft_followers (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  competition_id UUID REFERENCES draft_competitions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, competition_id)
);

ALTER TABLE wager_followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_followers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own wager follows"
  ON wager_followers FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own draft follows"
  ON draft_followers FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
