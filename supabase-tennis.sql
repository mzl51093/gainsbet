-- ============================================================
-- TENNIS CHALLENGE FEATURE
-- Run in Supabase SQL editor
-- ============================================================

create table public.tennis_challenges (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  created_by uuid references public.profiles(id) not null,
  participant_ids uuid[] not null default '{}',
  wager text,
  start_date date not null,
  end_date date,
  status text not null default 'active' check (status in ('active', 'completed')),
  created_at timestamptz default now()
);

alter table public.tennis_challenges enable row level security;

create policy "Tennis challenges viewable by authenticated users"
  on public.tennis_challenges for select using (auth.role() = 'authenticated');

create policy "Authenticated users can create tennis challenges"
  on public.tennis_challenges for insert with check (auth.role() = 'authenticated');

create policy "Participants can update tennis challenges"
  on public.tennis_challenges for update
  using (auth.uid() = any(participant_ids) or auth.uid() = created_by);

-- Matches
create table public.tennis_matches (
  id uuid default gen_random_uuid() primary key,
  challenge_id uuid references public.tennis_challenges(id) on delete cascade not null,
  player1_id uuid references public.profiles(id) not null,
  player2_id uuid references public.profiles(id) not null,
  winner_id uuid references public.profiles(id),
  set_scores jsonb not null default '[]',   -- [{p1:6,p2:4},{p1:7,p2:5}]
  aces_p1 int not null default 0,
  aces_p2 int not null default 0,
  double_faults_p1 int not null default 0,
  double_faults_p2 int not null default 0,
  notes text,
  played_at timestamptz not null default now(),
  created_at timestamptz default now()
);

alter table public.tennis_matches enable row level security;

create policy "Tennis matches viewable by authenticated users"
  on public.tennis_matches for select using (auth.role() = 'authenticated');

create policy "Authenticated users can log tennis matches"
  on public.tennis_matches for insert with check (auth.role() = 'authenticated');

-- Practice sessions
create table public.tennis_sessions (
  id uuid default gen_random_uuid() primary key,
  challenge_id uuid references public.tennis_challenges(id) on delete cascade not null,
  user_id uuid references public.profiles(id) not null,
  duration_minutes int not null,
  drill_focus text,
  notes text,
  session_date date not null default current_date,
  points int not null default 0,
  created_at timestamptz default now()
);

alter table public.tennis_sessions enable row level security;

create policy "Tennis sessions viewable by authenticated users"
  on public.tennis_sessions for select using (auth.role() = 'authenticated');

create policy "Authenticated users can log tennis sessions"
  on public.tennis_sessions for insert with check (auth.uid() = user_id);

-- Comments / trash talk
create table public.tennis_comments (
  id uuid default gen_random_uuid() primary key,
  challenge_id uuid references public.tennis_challenges(id) on delete cascade not null,
  user_id uuid references public.profiles(id) not null,
  body text not null,
  created_at timestamptz default now()
);

alter table public.tennis_comments enable row level security;

create policy "Tennis comments viewable by authenticated users"
  on public.tennis_comments for select using (auth.role() = 'authenticated');

create policy "Authenticated users can post tennis comments"
  on public.tennis_comments for insert with check (auth.uid() = user_id);

create policy "Users can delete their own tennis comments"
  on public.tennis_comments for delete using (auth.uid() = user_id);
