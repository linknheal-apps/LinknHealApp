-- Immutable tamper-evident audit ledger (T003b, R10)
-- Append-only audit trail in schema private. Direct writes denied to all application roles.
-- Single writer function enforces identity from auth.uid() and chains SHA-256 hashes with monotonic sequence numbers.

create schema if not exists private;
create extension if not exists pgcrypto with schema extensions;

-- ---------- table audit_events ----------
create table private.audit_events (
  id uuid primary key default gen_random_uuid(),
  seq bigint not null unique,
  at timestamptz not null default clock_timestamp(),
  actor_id uuid not null,
  action text not null check (action ~ '^[a-z][a-z0-9_.]{0,63}$'),
  subject_type text not null check (subject_type ~ '^[a-z][a-z0-9_.]{0,63}$'),
  subject_id uuid not null,
  prev_hash text not null,
  hash text not null,
  hash_version integer not null default 1 check (hash_version = 1)
);

create index audit_events_seq_idx on private.audit_events (seq asc);
create index audit_events_at_idx on private.audit_events (at asc, id asc);
create index audit_events_actor_idx on private.audit_events (actor_id);
create index audit_events_subject_idx on private.audit_events (subject_type, subject_id);

-- ---------- RLS enabled and FORCED ----------
alter table private.audit_events enable row level security;
alter table private.audit_events force row level security;

-- ---------- grants: nothing for public, anon, authenticated ----------
revoke all on table private.audit_events from public, anon, authenticated;

-- ---------- triggers: raise on update, delete, truncate even for table owner ----------
create or replace function private.audit_events_prevent_tamper()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if TG_OP = 'UPDATE' then
    raise exception 'audit_events is append-only: updates are prohibited';
  elsif TG_OP = 'DELETE' then
    raise exception 'audit_events is append-only: deletes are prohibited';
  elsif TG_OP = 'TRUNCATE' then
    raise exception 'audit_events is append-only: truncate is prohibited';
  end if;
  return null;
end;
$$;

revoke all on function private.audit_events_prevent_tamper() from public, anon, authenticated;

create trigger audit_events_no_update
  before update on private.audit_events
  for each row execute function private.audit_events_prevent_tamper();

create trigger audit_events_no_delete
  before delete on private.audit_events
  for each row execute function private.audit_events_prevent_tamper();

create trigger audit_events_no_truncate
  before truncate on private.audit_events
  for each statement execute function private.audit_events_prevent_tamper();

alter table private.audit_events enable always trigger audit_events_no_update;
alter table private.audit_events enable always trigger audit_events_no_delete;
alter table private.audit_events enable always trigger audit_events_no_truncate;

-- ---------- shared hash function (private schema) ----------
-- Canonical serialization format (hash_version = 1):
-- Fixed field order:
--   1. id (uuid)
--   2. at (timestamptz UTC ISO8601: YYYY-MM-DD"T"HH24:MI:SS.US"Z")
--   3. actor_id (uuid from auth.uid())
--   4. action (text)
--   5. subject_type (text)
--   6. subject_id (uuid)
--   7. prev_hash (text; genesis = 64 zeros: '0000000000000000000000000000000000000000000000000000000000000000')
--   8. hash_version (integer: 1)
--   9. seq (bigint)
-- Length-prefixed fields: format('%s:%s|%s:%s|...', length(val), val, ...)
create or replace function private.audit_event_hash(
  id uuid,
  at timestamptz,
  actor_id uuid,
  action text,
  subject_type text,
  subject_id uuid,
  prev_hash text,
  hash_version integer,
  seq bigint
)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_at_str text;
  v_canonical text;
begin
  v_at_str := pg_catalog.to_char(at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
  v_canonical := pg_catalog.format(
    '%s:%s|%s:%s|%s:%s|%s:%s|%s:%s|%s:%s|%s:%s|%s:%s|%s:%s',
    pg_catalog.length(id::text), id::text,
    pg_catalog.length(v_at_str), v_at_str,
    pg_catalog.length(actor_id::text), actor_id::text,
    pg_catalog.length(action), action,
    pg_catalog.length(subject_type), subject_type,
    pg_catalog.length(subject_id::text), subject_id::text,
    pg_catalog.length(prev_hash), prev_hash,
    pg_catalog.length(hash_version::text), hash_version::text,
    pg_catalog.length(seq::text), seq::text
  );

  return pg_catalog.encode(extensions.digest(v_canonical, 'sha256'), 'hex');
end;
$$;

revoke all on function private.audit_event_hash(uuid, timestamptz, uuid, text, text, uuid, text, integer, bigint) from public, anon, authenticated;

-- ---------- writer function (private schema) ----------
create or replace function private.write_audit_event(
  action text,
  subject_type text,
  subject_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_genesis_hash constant text := '0000000000000000000000000000000000000000000000000000000000000000';
  v_actor_id uuid;
  v_id uuid;
  v_seq bigint;
  v_prev_seq bigint;
  v_at timestamptz;
  v_prev_hash text;
  v_hash text;
begin
  -- Identity taken from auth.uid() only; null raises
  v_actor_id := auth.uid();
  if v_actor_id is null then
    raise exception 'audit event requires authenticated user (auth.uid() is null)';
  end if;

  -- Transaction-level advisory lock prevents forks on concurrent writes
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('private.audit_events'));

  -- Find prev_hash and seq from the latest event in the chain ordered by seq desc
  select ae.hash, ae.seq into v_prev_hash, v_prev_seq
  from private.audit_events ae
  order by ae.seq desc
  limit 1;

  if v_prev_hash is null then
    v_prev_hash := c_genesis_hash;
    v_seq := 1;
  else
    v_seq := v_prev_seq + 1;
  end if;

  v_id := pg_catalog.gen_random_uuid();
  v_at := pg_catalog.clock_timestamp();

  v_hash := private.audit_event_hash(
    v_id, v_at, v_actor_id, action, subject_type, subject_id, v_prev_hash, 1, v_seq
  );

  insert into private.audit_events (
    id, seq, at, actor_id, action, subject_type, subject_id, prev_hash, hash, hash_version
  ) values (
    v_id, v_seq, v_at, v_actor_id, action, subject_type, subject_id, v_prev_hash, v_hash, 1
  );

  return v_id;
end;
$$;

revoke all on function private.write_audit_event(text, text, uuid) from public, anon, authenticated;

-- ---------- verification function (private schema) ----------
create or replace function private.verify_audit_events()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_genesis_hash constant text := '0000000000000000000000000000000000000000000000000000000000000000';
  v_expected_prev_hash text := c_genesis_hash;
  v_expected_seq bigint := 1;
  v_rec record;
  v_recomputed_hash text;
begin
  for v_rec in
    select ae.id, ae.seq, ae.at, ae.actor_id, ae.action, ae.subject_type, ae.subject_id, ae.prev_hash, ae.hash, ae.hash_version
    from private.audit_events ae
    order by ae.seq asc
  loop
    -- Check sequence ordering: previous seq + 1 starting at 1
    if v_rec.seq <> v_expected_seq then
      return false;
    end if;

    -- Check link to previous hash
    if v_rec.prev_hash <> v_expected_prev_hash then
      return false;
    end if;

    -- Check hash version
    if v_rec.hash_version <> 1 then
      return false;
    end if;

    -- Recompute hash using shared function
    v_recomputed_hash := private.audit_event_hash(
      v_rec.id, v_rec.at, v_rec.actor_id, v_rec.action, v_rec.subject_type, v_rec.subject_id, v_rec.prev_hash, v_rec.hash_version, v_rec.seq
    );

    -- Check hash integrity
    if v_rec.hash <> v_recomputed_hash then
      return false;
    end if;

    v_expected_prev_hash := v_rec.hash;
    v_expected_seq := v_expected_seq + 1;
  end loop;

  return true;
end;
$$;

revoke all on function private.verify_audit_events() from public, anon, authenticated;
