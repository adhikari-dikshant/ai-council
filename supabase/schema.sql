-- AI Council — Supabase schema
-- Run this once in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql/new

-- ─── Enums ────────────────────────────────────────────────────────────────────

do $$ begin
  create type public.user_role as enum ('admin', 'council_member', 'reviewer', 'proposer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.proposal_status as enum (
    'draft', 'submitted', 'under_review', 'approved', 'rejected', 'revision_required'
  );
exception when duplicate_object then null; end $$;

-- ─── Profiles (one row per auth user) ─────────────────────────────────────────

create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  full_name  text,
  avatar_url text,
  role       public.user_role not null default 'proposer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- First signup becomes admin, everyone else defaults to proposer.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_count  bigint;
  v_role   public.user_role;
begin
  select count(*) into v_count from public.profiles;
  v_role := case when v_count = 0 then 'admin'::public.user_role else 'proposer'::public.user_role end;
  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    v_role
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Conversations (the original chat history table) ─────────────────────────

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
  id              uuid primary key default gen_random_uuid(),
  author_id       uuid not null references auth.users(id) on delete cascade,
  title           text not null,
  project_type    text,
  description     text not null,
  status          public.proposal_status not null default 'submitted',
  ai_review       jsonb,              -- full SessionState once the council runs
  ai_decision     text,               -- approved | rejected | revision_required
  risk_level      text,               -- low | medium | high
  final_decision  text,               -- human override (same vocabulary)
  decided_by      uuid references auth.users(id) on delete set null,
  decided_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
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
  vote        text,  -- approve | reject | revise | null
  created_at  timestamptz not null default now()
);

create index if not exists comments_proposal_idx on public.comments (proposal_id, created_at asc);

-- ─── Notifications (in-app) ───────────────────────────────────────────────────

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null,        -- status_changed | comment_added | role_changed | assigned
  title       text not null,
  body        text,
  proposal_id uuid references public.proposals(id) on delete cascade,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, read, created_at desc);

-- ─── Helper: current user's role ──────────────────────────────────────────────

create or replace function public.current_role()
returns public.user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ─── RLS ──────────────────────────────────────────────────────────────────────

alter table public.profiles      enable row level security;
alter table public.conversations enable row level security;
alter table public.proposals     enable row level security;
alter table public.comments      enable row level security;
alter table public.notifications enable row level security;

-- profiles ---------------------------------------------------------------------
drop policy if exists "profiles readable by everyone authenticated" on public.profiles;
create policy "profiles readable by everyone authenticated"
  on public.profiles for select
  using (auth.uid() is not null);

drop policy if exists "users update their own profile" on public.profiles;
create policy "users update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id and role = (select role from public.profiles where id = auth.uid()));

drop policy if exists "admins manage all profiles" on public.profiles;
create policy "admins manage all profiles"
  on public.profiles for all
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- conversations ----------------------------------------------------------------
drop policy if exists "Users own their conversations" on public.conversations;
create policy "Users own their conversations"
  on public.conversations for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- proposals --------------------------------------------------------------------
drop policy if exists "proposals read" on public.proposals;
create policy "proposals read"
  on public.proposals for select
  using (
    auth.uid() = author_id
    or public.current_role() in ('admin', 'council_member', 'reviewer')
  );

drop policy if exists "proposals insert" on public.proposals;
create policy "proposals insert"
  on public.proposals for insert
  with check (auth.uid() = author_id);

drop policy if exists "proposals update" on public.proposals;
create policy "proposals update"
  on public.proposals for update
  using (
    (auth.uid() = author_id and status in ('draft', 'submitted', 'revision_required'))
    or public.current_role() in ('admin', 'council_member', 'reviewer')
  )
  with check (
    (auth.uid() = author_id)
    or public.current_role() in ('admin', 'council_member', 'reviewer')
  );

drop policy if exists "proposals delete" on public.proposals;
create policy "proposals delete"
  on public.proposals for delete
  using (auth.uid() = author_id or public.current_role() = 'admin');

-- comments ---------------------------------------------------------------------
drop policy if exists "comments read" on public.comments;
create policy "comments read"
  on public.comments for select
  using (
    exists (
      select 1 from public.proposals p
      where p.id = comments.proposal_id
        and (p.author_id = auth.uid() or public.current_role() in ('admin', 'council_member', 'reviewer'))
    )
  );

drop policy if exists "comments insert" on public.comments;
create policy "comments insert"
  on public.comments for insert
  with check (
    auth.uid() = author_id
    and exists (
      select 1 from public.proposals p
      where p.id = proposal_id
        and (p.author_id = auth.uid() or public.current_role() in ('admin', 'council_member', 'reviewer'))
    )
  );

drop policy if exists "comments delete" on public.comments;
create policy "comments delete"
  on public.comments for delete
  using (auth.uid() = author_id or public.current_role() = 'admin');

-- notifications ----------------------------------------------------------------
drop policy if exists "notifications owner read" on public.notifications;
create policy "notifications owner read"
  on public.notifications for select
  using (auth.uid() = user_id);

drop policy if exists "notifications owner update" on public.notifications;
create policy "notifications owner update"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "notifications authenticated insert" on public.notifications;
create policy "notifications authenticated insert"
  on public.notifications for insert
  with check (auth.uid() is not null);

drop policy if exists "notifications owner delete" on public.notifications;
create policy "notifications owner delete"
  on public.notifications for delete
  using (auth.uid() = user_id);
