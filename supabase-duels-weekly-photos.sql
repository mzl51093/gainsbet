-- Weekly body check-in photos (front + side)
-- Run in Supabase SQL editor

create table public.duel_weekly_photos (
  id uuid default gen_random_uuid() primary key,
  duel_id uuid references public.duel_challenges(id) on delete cascade not null,
  user_id uuid references public.profiles(id) not null,
  check_in_week date not null,        -- Monday of the submission week
  front_photo_url text,
  side_photo_url text,
  notes text,
  submitted_at timestamptz default now(),
  unique(duel_id, user_id, check_in_week)
);

alter table public.duel_weekly_photos enable row level security;

create policy "Weekly photos viewable by all authenticated users"
  on public.duel_weekly_photos for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert weekly photos"
  on public.duel_weekly_photos for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own weekly photos"
  on public.duel_weekly_photos for update
  using (auth.uid() = user_id);
