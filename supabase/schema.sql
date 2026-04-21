-- AI Council — Supabase schema
-- Run this once in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql/new

-- ─── Profiles (one row per auth user) ─────────────────────────────────────────

create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  full_name  text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Conversations (chat history) ────────────────────────────────────────────

create table if not exists public.conversations (
  id         uuid        default gen_random_uuid() primary key,
  user_id    uuid        references auth.users(id) on delete cascade not null,
  title      text        not null,
  prompt     text        not null,
  data       jsonb       not null,
  created_at timestamptz default now() not null
);

create index if not exists conversations_user_created_idx
  on public.conversations (user_id, created_at desc);

-- ─── Proposals ────────────────────────────────────────────────────────────────

create table if not exists public.proposals (
  id           uuid primary key default gen_random_uuid(),
  author_id    uuid not null references auth.users(id) on delete cascade,
  title        text not null,
  project_type text,
  description  text not null,
  status       text not null default 'submitted',  -- submitted | approved | rejected | revision_required
  ai_review    jsonb,           -- full SessionState after council runs
  ai_decision  text,            -- approved | rejected | revision_required
  risk_level   text,            -- low | medium | high
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists proposals_author_idx  on public.proposals (author_id, created_at desc);
create index if not exists proposals_status_idx  on public.proposals (status, created_at desc);
create index if not exists proposals_created_idx on public.proposals (created_at desc);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists proposals_updated_at on public.proposals;
create trigger proposals_updated_at
  before update on public.proposals
  for each row execute function public.touch_updated_at();

-- ─── Comments ─────────────────────────────────────────────────────────────────

create table if not exists public.comments (
  id          uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  author_id   uuid not null references auth.users(id) on delete cascade,
  body        text not null,
  created_at  timestamptz not null default now()
);

create index if not exists comments_proposal_idx on public.comments (proposal_id, created_at asc);

-- ─── Notifications ────────────────────────────────────────────────────────────

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null,   -- status_changed | comment_added | assigned
  title       text not null,
  body        text,
  proposal_id uuid references public.proposals(id) on delete cascade,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, read, created_at desc);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

alter table public.profiles      enable row level security;
alter table public.conversations enable row level security;
alter table public.proposals     enable row level security;
alter table public.comments      enable row level security;
alter table public.notifications enable row level security;

-- profiles
drop policy if exists "profiles readable"       on public.profiles;
drop policy if exists "profiles self update"    on public.profiles;
create policy "profiles readable"    on public.profiles for select using (auth.uid() is not null);
create policy "profiles self update" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- conversations
drop policy if exists "Users own their conversations" on public.conversations;
create policy "Users own their conversations"
  on public.conversations for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- proposals: all authenticated users can read; authors manage their own
drop policy if exists "proposals read"   on public.proposals;
drop policy if exists "proposals insert" on public.proposals;
drop policy if exists "proposals update" on public.proposals;
drop policy if exists "proposals delete" on public.proposals;
create policy "proposals read"   on public.proposals for select using (auth.uid() is not null);
create policy "proposals insert" on public.proposals for insert with check (auth.uid() = author_id);
create policy "proposals update" on public.proposals for update using (auth.uid() = author_id) with check (auth.uid() = author_id);
create policy "proposals delete" on public.proposals for delete using (auth.uid() = author_id);

-- comments: all authenticated users can read; authors manage their own
drop policy if exists "comments read"   on public.comments;
drop policy if exists "comments insert" on public.comments;
drop policy if exists "comments delete" on public.comments;
create policy "comments read"   on public.comments for select using (auth.uid() is not null);
create policy "comments insert" on public.comments for insert with check (auth.uid() = author_id);
create policy "comments delete" on public.comments for delete using (auth.uid() = author_id);

-- notifications: owner only
drop policy if exists "notifications owner read"   on public.notifications;
drop policy if exists "notifications owner update" on public.notifications;
drop policy if exists "notifications owner insert" on public.notifications;
drop policy if exists "notifications owner delete" on public.notifications;
create policy "notifications owner read"   on public.notifications for select using (auth.uid() = user_id);
create policy "notifications owner update" on public.notifications for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "notifications owner insert" on public.notifications for insert with check (auth.uid() is not null);
create policy "notifications owner delete" on public.notifications for delete using (auth.uid() = user_id);
