# Implementation Plan: Phase 0 — Privacy & Auth Foundation

## Technical Context
- **Database**: PostgreSQL (hosting decision open — self-hosted vs. managed
  such as Supabase; Supabase gives RLS tooling + auth out of the box and is
  worth defaulting to unless the client has a hosting preference).
- **Auth**: role claim on the JWT/session (`client` | `partner` | `therapist`)
  used by RLS policies via `auth.uid()`-equivalent.
- **Language/runtime**: whatever the API layer is written in (Node/TS is the
  natural fit given the rest of the stack is TypeScript).

## Data Model (Phase 0 slice)

```sql
create table users (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('client','therapist')),
  email text unique not null,
  created_at timestamptz default now()
);

create table partner_links (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references users(id),
  partner_id uuid references users(id),
  status text not null check (status in ('pending','active','ended')),
  created_at timestamptz default now()
);

create table therapist_client_links (
  id uuid primary key default gen_random_uuid(),
  therapist_id uuid references users(id),
  client_id uuid references users(id),
  status text not null check (status in ('pending','active','ended')),
  created_at timestamptz default now()
);

-- Phase 0 uses one generic placeholder entry table to prove the pattern;
-- real entry tables (mood_checkins, reflections, ...) reuse the same shape
-- in later phases.
create table entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references users(id) not null,
  entry_type text not null,
  body jsonb not null,
  created_at timestamptz default now()
);

create table shares (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid references entries(id) not null,
  owner_id uuid references users(id) not null,
  shared_with_user_id uuid references users(id) not null,
  shared_at timestamptz default now(),
  unique (entry_id, shared_with_user_id)
);
```

## RLS Policies (Phase 0 slice)

```sql
alter table entries enable row level security;

-- Owner can always read/write their own entries
create policy entries_owner_all on entries
  for all
  using (owner_id = current_setting('app.current_user_id')::uuid);

-- Others can read only if an explicit share exists
create policy entries_shared_read on entries
  for select
  using (
    exists (
      select 1 from shares
      where shares.entry_id = entries.id
        and shares.shared_with_user_id = current_setting('app.current_user_id')::uuid
    )
  );

alter table shares enable row level security;

-- Only the entry owner can create/delete shares for their own entries
create policy shares_owner_manage on shares
  for all
  using (owner_id = current_setting('app.current_user_id')::uuid);

-- A user can read a share row if they're the owner or the recipient
create policy shares_visible_to_parties on shares
  for select
  using (
    owner_id = current_setting('app.current_user_id')::uuid
    or shared_with_user_id = current_setting('app.current_user_id')::uuid
  );
```

*(Exact session-variable mechanism depends on whether Supabase auth or a
custom JWT-based approach is used — `current_setting('app.current_user_id')`
is illustrative; Supabase would use `auth.uid()` directly.)*

## Adversarial Test Plan
Each test connects to the database (or calls the API) **as** a specific
user role and asserts what they can and cannot see — not just what the
application UI happens to show.

1. `test_owner_reads_own_entry` — baseline, must pass.
2. `test_partner_cannot_read_unshared_entry` — US2.
3. `test_sharing_one_entry_does_not_leak_others` — US3.
4. `test_therapist_cannot_read_unshared_entry` — US4.
5. `test_revoked_share_removes_access` — US5.
6. `test_ended_partner_link_does_not_grant_access` — a partner link with
   status `ended` must not itself grant read access (access only ever comes
   from `shares`, never from link status).
7. `test_direct_db_query_respects_rls` — run at least one test with a raw
   SQL connection under the partner/therapist role, not through the API, to
   confirm RLS is the real boundary and not just an application-layer check.

## Verification Gate
Phase 0 is not "done" until: all 7 tests above pass, and Claude has
independently re-run them (not just accepted Gemini's report) against the
actual database.
