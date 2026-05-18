-- Run this in your Supabase SQL editor to enable draft competition chat

CREATE TABLE IF NOT EXISTS draft_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id  UUID NOT NULL,
  user_id         UUID NOT NULL,
  channel         TEXT NOT NULL CHECK (channel IN ('group', 'team_a', 'team_b')),
  content         TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  created_at      TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT draft_messages_competition_id_fkey
    FOREIGN KEY (competition_id) REFERENCES draft_competitions(id) ON DELETE CASCADE,
  CONSTRAINT draft_messages_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS draft_messages_comp_channel_time
  ON draft_messages (competition_id, channel, created_at);

ALTER TABLE draft_messages ENABLE ROW LEVEL SECURITY;

-- Group channel: any participant can read/write
CREATE POLICY "participants can read group messages"
  ON draft_messages FOR SELECT
  USING (
    channel = 'group'
    AND EXISTS (
      SELECT 1 FROM draft_participants
      WHERE competition_id = draft_messages.competition_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "participants can send group messages"
  ON draft_messages FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND channel = 'group'
    AND EXISTS (
      SELECT 1 FROM draft_participants
      WHERE competition_id = draft_messages.competition_id
        AND user_id = auth.uid()
    )
  );

-- Team A channel: only team a members
CREATE POLICY "team a can read team_a messages"
  ON draft_messages FOR SELECT
  USING (
    channel = 'team_a'
    AND EXISTS (
      SELECT 1 FROM draft_participants
      WHERE competition_id = draft_messages.competition_id
        AND user_id = auth.uid()
        AND team = 'a'
    )
  );

CREATE POLICY "team a can send team_a messages"
  ON draft_messages FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND channel = 'team_a'
    AND EXISTS (
      SELECT 1 FROM draft_participants
      WHERE competition_id = draft_messages.competition_id
        AND user_id = auth.uid()
        AND team = 'a'
    )
  );

-- Team B channel: only team b members
CREATE POLICY "team b can read team_b messages"
  ON draft_messages FOR SELECT
  USING (
    channel = 'team_b'
    AND EXISTS (
      SELECT 1 FROM draft_participants
      WHERE competition_id = draft_messages.competition_id
        AND user_id = auth.uid()
        AND team = 'b'
    )
  );

CREATE POLICY "team b can send team_b messages"
  ON draft_messages FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND channel = 'team_b'
    AND EXISTS (
      SELECT 1 FROM draft_participants
      WHERE competition_id = draft_messages.competition_id
        AND user_id = auth.uid()
        AND team = 'b'
    )
  );

-- Enable realtime events for this table
ALTER PUBLICATION supabase_realtime ADD TABLE draft_messages;
