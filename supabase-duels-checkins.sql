-- ============================================================
-- DUEL HEALTHY DAY CHECK-IN - SCHEMA ADDITION
-- Run this in your Supabase SQL editor
-- ============================================================

create table public.duel_daily_checkins (
  id uuid default gen_random_uuid() primary key,
  duel_id uuid references public.duel_challenges(id) on delete cascade not null,
  user_id uuid references public.profiles(id) not null,
  check_in_date date not null,
  -- Optional free text
  meal_description text,
  -- Positive habits
  ate_protein boolean not null default false,
  ate_vegetables boolean not null default false,
  drank_water boolean not null default false,
  within_goals boolean not null default false,
  -- Negative habits
  drank_alcohol boolean not null default false,
  ate_fried_food boolean not null default false,
  ate_fast_food boolean not null default false,
  ate_dessert boolean not null default false,
  had_binge_meal boolean not null default false,
  -- Computed results
  health_score integer not null,
  earned_bonus boolean not null default false,
  challenge_points integer not null default 0,
  created_at timestamptz default now(),
  unique(duel_id, user_id, check_in_date)
);

alter table public.duel_daily_checkins enable row level security;

create policy "Duel check-ins viewable by all authenticated users"
  on public.duel_daily_checkins for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert check-ins"
  on public.duel_daily_checkins for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own check-ins"
  on public.duel_daily_checkins for update
  using (auth.uid() = user_id);
