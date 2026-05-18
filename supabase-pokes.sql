CREATE TABLE pokes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  from_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  to_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL DEFAULT 'fun',
  exercise TEXT,
  reps INTEGER,
  points INTEGER DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  video_url TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE pokes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view pokes involving them"
  ON pokes FOR SELECT TO authenticated
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "Users can create pokes"
  ON pokes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Service role can update pokes"
  ON pokes FOR UPDATE TO service_role
  WITH CHECK (true);
