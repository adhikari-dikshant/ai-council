-- AI Council — Supabase schema
-- Run this once in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql/new

create table public.conversations (
  id         uuid        default gen_random_uuid() primary key,
  user_id    uuid        references auth.users(id) on delete cascade not null,
  title      text        not null,
  prompt     text        not null,
  data       jsonb       not null,   -- full council SessionState
  created_at timestamptz default now() not null
);

-- Fast queries for the sidebar list
create index conversations_user_created_idx
  on public.conversations (user_id, created_at desc);

-- Row Level Security — users can only touch their own rows
alter table public.conversations enable row level security;

create policy "Users own their conversations"
  on public.conversations
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
