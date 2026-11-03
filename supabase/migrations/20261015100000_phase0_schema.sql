-- Phase 0 schema (T004, T005). RLS, grants, RPC and triggers are in the next migration.
-- Decision D2: one generic `entries` supertype table; `shares.entry_id` is a hard FK to it.
-- Spec FR2 therefore loses `entry_type` on `shares` (it lives on `entries`).

create schema if not exists private;

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('client', 'therapist')),
  created_at timestamptz not null default now()
);

create table public.partner_links (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.users (id) on delete cascade,
  partner_id uuid not null references public.users (id) on delete cascade,
  status text not null check (status in ('pending', 'active', 'ended')),
  created_at timestamptz not null default now(),
  check (client_id <> partner_id)
);
-- one link per unordered pair, so (A,B) and (B,A) cannot both exist
create unique index partner_links_pair_uniq
  on public.partner_links (least(client_id, partner_id), greatest(client_id, partner_id));
create index partner_links_client_idx on public.partner_links (client_id);
create index partner_links_partner_idx on public.partner_links (partner_id);

create table public.therapist_client_links (
  id uuid primary key default gen_random_uuid(),
  therapist_id uuid not null references public.users (id) on delete cascade,
  client_id uuid not null references public.users (id) on delete cascade,
  status text not null check (status in ('pending', 'active', 'ended')),
  created_at timestamptz not null default now(),
  check (therapist_id <> client_id),
  unique (therapist_id, client_id)
);
create index tc_links_client_idx on public.therapist_client_links (client_id);

create table public.entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.users (id) on delete cascade,
  entry_type text not null,
  body jsonb not null,
  created_at timestamptz not null default now(),
  unique (id, owner_id)
);
create index entries_owner_created_idx on public.entries (owner_id, created_at desc);

create table public.shares (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null,
  owner_id uuid not null,
  shared_with_user_id uuid not null references public.users (id) on delete cascade,
  shared_at timestamptz not null default now(),
  -- composite FK: a share's owner can only ever be the entry's real owner
  foreign key (entry_id, owner_id) references public.entries (id, owner_id) on delete cascade,
  unique (entry_id, shared_with_user_id),
  check (owner_id <> shared_with_user_id)
);
create index shares_shared_with_idx on public.shares (shared_with_user_id, entry_id);
create index shares_owner_idx on public.shares (owner_id);
