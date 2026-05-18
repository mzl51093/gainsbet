-- Run in Supabase SQL Editor to enable in-app draft invites

CREATE TABLE IF NOT EXISTS draft_invites (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id   UUID NOT NULL,
  invited_user_id  UUID NOT NULL,
  invited_by_id    UUID NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT draft_invites_competition_id_fkey
    FOREIGN KEY (competition_id) REFERENCES draft_competitions(id) ON DELETE CASCADE,
  CONSTRAINT draft_invites_invited_user_id_fkey
    FOREIGN KEY (invited_user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT draft_invites_invited_by_id_fkey
    FOREIGN KEY (invited_by_id) REFERENCES profiles(id) ON DELETE CASCADE,

  UNIQUE (competition_id, invited_user_id)
);

ALTER TABLE draft_invites ENABLE ROW LEVEL SECURITY;

-- Any participant can see who's been invited
CREATE POLICY "participants can view invites"
  ON draft_invites FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM draft_participants
      WHERE competition_id = draft_invites.competition_id
        AND user_id = auth.uid()
    )
  );

-- Participants can invite others
CREATE POLICY "participants can create invites"
  ON draft_invites FOR INSERT
  WITH CHECK (
    invited_by_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM draft_participants
      WHERE competition_id = draft_invites.competition_id
        AND user_id = auth.uid()
    )
  );
