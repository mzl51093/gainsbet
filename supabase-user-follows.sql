-- User follows (follow a person, not just a challenge)
CREATE TABLE IF NOT EXISTS user_follows (
  follower_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (follower_id, following_id)
);

ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own follows"
  ON user_follows FOR ALL TO authenticated
  USING (auth.uid() = follower_id) WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Follows visible to authenticated users"
  ON user_follows FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');
