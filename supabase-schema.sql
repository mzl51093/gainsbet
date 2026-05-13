-- ============================================================
-- WORKOUT COMPETITION PLATFORM - SUPABASE SCHEMA
-- Run this in your Supabase SQL editor
-- ============================================================

-- Profiles (extends auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  display_name text not null,
  username text unique not null,
  role text not null check (role in ('competitor', 'partner')),
  -- partners link to the competitor they support
  supporting_id uuid references public.profiles(id),
  avatar_url text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by all authenticated users"
  on public.profiles for select
  using (auth.role() = 'authenticated');

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Workouts
create table public.workouts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  workout_type text not null check (workout_type in ('strength', 'cardio', 'hiit', 'flexibility', 'sports', 'other')),
  duration_minutes integer not null check (duration_minutes > 0),
  points integer not null,
  notes text,
  proof_url text,
  proof_type text check (proof_type in ('photo', 'screenshot', 'whoop', 'other')),
  logged_at timestamptz not null default now(),
  created_at timestamptz default now()
);

alter table public.workouts enable row level security;

create policy "Workouts viewable by all authenticated users"
  on public.workouts for select
  using (auth.role() = 'authenticated');

create policy "Competitors can insert their own workouts"
  on public.workouts for insert
  with check (auth.uid() = user_id);

create policy "Competitors can update their own workouts"
  on public.workouts for update
  using (auth.uid() = user_id);

create policy "Competitors can delete their own workouts"
  on public.workouts for delete
  using (auth.uid() = user_id);

-- Wagers
create table public.wagers (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  proposed_by uuid references public.profiles(id) not null,
  condition_type text not null check (condition_type in ('both_fail', 'either_fails', 'one_fails', 'custom')),
  point_threshold integer not null default 50,
  week_start date not null,
  stake_if_partners_win text not null,
  stake_if_competitors_win text not null,
  status text not null default 'pending' check (status in ('pending', 'active', 'resolved', 'expired')),
  winner text check (winner in ('competitors', 'partners')),
  resolved_at timestamptz,
  created_at timestamptz default now()
);

alter table public.wagers enable row level security;

create policy "Wagers viewable by all authenticated users"
  on public.wagers for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can create wagers"
  on public.wagers for insert
  with check (auth.role() = 'authenticated');

create policy "Proposed-by user can update wager"
  on public.wagers for update
  using (auth.uid() = proposed_by);

-- Wager acceptances
create table public.wager_acceptances (
  wager_id uuid references public.wagers(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  accepted_at timestamptz default now(),
  primary key (wager_id, user_id)
);

alter table public.wager_acceptances enable row level security;

create policy "Acceptances viewable by all authenticated users"
  on public.wager_acceptances for select
  using (auth.role() = 'authenticated');

create policy "Users can accept wagers"
  on public.wager_acceptances for insert
  with check (auth.uid() = user_id);

-- Workout reactions
create table public.workout_reactions (
  id uuid default gen_random_uuid() primary key,
  workout_id uuid references public.workouts(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz default now(),
  unique(workout_id, user_id, emoji)
);

alter table public.workout_reactions enable row level security;

create policy "Reactions viewable by all authenticated users"
  on public.workout_reactions for select
  using (auth.role() = 'authenticated');

create policy "Users can add reactions"
  on public.workout_reactions for insert
  with check (auth.uid() = user_id);

create policy "Users can remove their own reactions"
  on public.workout_reactions for delete
  using (auth.uid() = user_id);

-- Workout comments
create table public.workout_comments (
  id uuid default gen_random_uuid() primary key,
  workout_id uuid references public.workouts(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz default now()
);

alter table public.workout_comments enable row level security;

create policy "Comments viewable by all authenticated users"
  on public.workout_comments for select
  using (auth.role() = 'authenticated');

create policy "Users can add comments"
  on public.workout_comments for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own comments"
  on public.workout_comments for delete
  using (auth.uid() = user_id);

-- Storage bucket for workout proofs
insert into storage.buckets (id, name, public)
values ('workout-proofs', 'workout-proofs', false)
on conflict do nothing;

create policy "Authenticated users can upload proofs"
  on storage.objects for insert
  with check (bucket_id = 'workout-proofs' and auth.role() = 'authenticated');

create policy "Authenticated users can view proofs"
  on storage.objects for select
  using (bucket_id = 'workout-proofs' and auth.role() = 'authenticated');

create policy "Users can delete their own proofs"
  on storage.objects for delete
  using (bucket_id = 'workout-proofs' and auth.uid()::text = (storage.foldername(name))[1]);

-- Function: auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, username, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'competitor')
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
