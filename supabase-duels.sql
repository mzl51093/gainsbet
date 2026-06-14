-- ============================================================
-- DUEL CHALLENGE FEATURE - SUPABASE SCHEMA
-- Run this in your Supabase SQL editor
-- ============================================================

-- Duel challenges (head-to-head competitions)
create table public.duel_challenges (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  created_by uuid references public.profiles(id) not null,
  competitor_a_id uuid references public.profiles(id) not null,
  competitor_b_id uuid references public.profiles(id) not null,
  watcher_ids uuid[] default '{}',
  wager text,
  rules text,
  start_date date not null,
  end_date date not null,
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  winner_id uuid references public.profiles(id),
  completed_at timestamptz,
  -- Starting and lowest verified weights (updated as weigh-ins come in)
  starting_weight_a numeric(6,2),
  starting_weight_b numeric(6,2),
  lowest_weight_a numeric(6,2),
  lowest_weight_b numeric(6,2),
  created_at timestamptz default now()
);

alter table public.duel_challenges enable row level security;

create policy "Duel challenges viewable by all authenticated users"
  on public.duel_challenges for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can create duel challenges"
  on public.duel_challenges for insert
  with check (auth.role() = 'authenticated');

create policy "Participants can update duel challenges"
  on public.duel_challenges for update
  using (
    auth.uid() = created_by or
    auth.uid() = competitor_a_id or
    auth.uid() = competitor_b_id
  );

-- Duel weigh-ins
create table public.duel_weigh_ins (
  id uuid default gen_random_uuid() primary key,
  duel_id uuid references public.duel_challenges(id) on delete cascade not null,
  user_id uuid references public.profiles(id) not null,
  weight numeric(6,2) not null,
  photo_url text,
  submitted_by uuid references public.profiles(id) not null,
  is_starting_weight boolean not null default false,
  verified boolean not null default true,
  verified_by uuid references public.profiles(id),
  verified_at timestamptz,
  notes text,
  weighed_at timestamptz not null default now(),
  created_at timestamptz default now()
);

alter table public.duel_weigh_ins enable row level security;

create policy "Weigh-ins viewable by all authenticated users"
  on public.duel_weigh_ins for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert weigh-ins"
  on public.duel_weigh_ins for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update weigh-ins"
  on public.duel_weigh_ins for update
  using (auth.role() = 'authenticated');

-- Duel comments
create table public.duel_comments (
  id uuid default gen_random_uuid() primary key,
  duel_id uuid references public.duel_challenges(id) on delete cascade not null,
  user_id uuid references public.profiles(id) not null,
  body text not null,
  created_at timestamptz default now()
);

alter table public.duel_comments enable row level security;

create policy "Duel comments viewable by all authenticated users"
  on public.duel_comments for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can post duel comments"
  on public.duel_comments for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own duel comments"
  on public.duel_comments for delete
  using (auth.uid() = user_id);

-- Duel reactions (on comments)
create table public.duel_reactions (
  id uuid default gen_random_uuid() primary key,
  duel_id uuid references public.duel_challenges(id) on delete cascade not null,
  user_id uuid references public.profiles(id) not null,
  comment_id uuid references public.duel_comments(id) on delete cascade,
  emoji text not null,
  created_at timestamptz default now(),
  unique(duel_id, user_id, comment_id, emoji)
);

alter table public.duel_reactions enable row level security;

create policy "Duel reactions viewable by all authenticated users"
  on public.duel_reactions for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can add duel reactions"
  on public.duel_reactions for insert
  with check (auth.uid() = user_id);

create policy "Users can remove their own duel reactions"
  on public.duel_reactions for delete
  using (auth.uid() = user_id);

-- Storage bucket for duel weigh-in photos
insert into storage.buckets (id, name, public)
values ('duel-proofs', 'duel-proofs', false)
on conflict do nothing;

create policy "Authenticated users can upload duel proofs"
  on storage.objects for insert
  with check (bucket_id = 'duel-proofs' and auth.role() = 'authenticated');

create policy "Authenticated users can view duel proofs"
  on storage.objects for select
  using (bucket_id = 'duel-proofs' and auth.role() = 'authenticated');
