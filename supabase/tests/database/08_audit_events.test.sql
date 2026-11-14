-- Audit events table, writer, verification and trigger security tests (R10)
-- Runs with `supabase test db` (pgTAP). Synthetic data only. Everything is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(45);

-- let the low-privilege roles write pgTAP's own temp bookkeeping tables
do $$
declare r record;
begin
  for r in select c.oid::regclass::text as rel, c.relkind
           from pg_class c
           where c.relnamespace = pg_my_temp_schema() and c.relkind in ('r', 'S')
  loop
    execute format('grant all on %s %s to authenticated, anon',
                   case r.relkind when 'S' then 'sequence' else 'table' end, r.rel);
  end loop;
end $$;

-- 1-6: Structure, columns, RLS, functions exist
select has_table('private', 'audit_events', 'table private.audit_events exists');

select columns_are('private', 'audit_events',
  array['action', 'actor_id', 'at', 'hash', 'hash_version', 'id', 'prev_hash', 'seq', 'subject_id', 'subject_type']::name[],
  'audit_events has exact columns: id, at, actor_id, action, subject_type, subject_id, prev_hash, hash, hash_version, seq');

select ok(
  coalesce((select relrowsecurity and relforcerowsecurity
            from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'private' and c.relname = 'audit_events'), false),
  'audit_events has RLS enabled and FORCED'
);

select has_function('private', 'write_audit_event', array['text', 'text', 'uuid'],
  'private.write_audit_event(text, text, uuid) function exists');

select has_function('private', 'verify_audit_events',
  'private.verify_audit_events() function exists');

-- (e) Shared hash function exists in schema private
select has_function('private', 'audit_event_hash',
  'private.audit_event_hash function exists');

-- (a) As authenticated and as anon: INSERT, UPDATE, DELETE, TRUNCATE on audit_events are denied
select ok(not has_table_privilege('anon', 'private.audit_events', 'insert,update,delete,truncate'),
  'anon has no write privileges on private.audit_events');

select ok(not has_table_privilege('authenticated', 'private.audit_events', 'insert,update,delete,truncate'),
  'authenticated has no write privileges on private.audit_events');

-- Anon direct statement attempts
reset role;
set local role anon;

select throws_ok(
  $$insert into private.audit_events (action, subject_type, subject_id, actor_id, prev_hash, hash)
    values ('entry.read', 'entry', 'e1000000-0000-0000-0000-000000000001'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, '0', '0')$$,
  '42501',
  null,
  'anon cannot insert into audit_events'
);

select throws_ok(
  $$update private.audit_events set action = 'tamper'$$,
  '42501',
  null,
  'anon cannot update audit_events'
);

select throws_ok(
  $$delete from private.audit_events$$,
  '42501',
  null,
  'anon cannot delete from audit_events'
);

select throws_ok(
  $$truncate private.audit_events$$,
  '42501',
  null,
  'anon cannot truncate audit_events'
);

-- Authenticated direct statement attempts
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select throws_ok(
  $$insert into private.audit_events (action, subject_type, subject_id, actor_id, prev_hash, hash)
    values ('entry.read', 'entry', 'e1000000-0000-0000-0000-000000000001'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, '0', '0')$$,
  '42501',
  null,
  'authenticated cannot insert into audit_events'
);

select throws_ok(
  $$update private.audit_events set action = 'tamper'$$,
  '42501',
  null,
  'authenticated cannot update audit_events'
);

select throws_ok(
  $$delete from private.audit_events$$,
  '42501',
  null,
  'authenticated cannot delete from audit_events'
);

select throws_ok(
  $$truncate private.audit_events$$,
  '42501',
  null,
  'authenticated cannot truncate audit_events'
);

-- (b) Writer function (private schema) is NOT executable by anon or authenticated
reset role;

select ok(not has_function_privilege('anon', 'private.write_audit_event(text,text,uuid)', 'execute'),
  'anon cannot execute writer function');

select ok(not has_function_privilege('authenticated', 'private.write_audit_event(text,text,uuid)', 'execute'),
  'authenticated cannot execute writer function');

set local role anon;
select throws_ok(
  $$select private.write_audit_event('entry.read', 'entry', 'e1000000-0000-0000-0000-000000000001'::uuid)$$,
  '42501',
  null,
  'anon execution of write_audit_event is denied'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok(
  $$select private.write_audit_event('entry.read', 'entry', 'e1000000-0000-0000-0000-000000000001'::uuid)$$,
  '42501',
  null,
  'authenticated execution of write_audit_event is denied'
);

-- (c) Called as owner role inside test, takes NO actor parameter; actor_id equals auth.uid(); with auth.uid() null it raises
reset role;
set local request.jwt.claims = '';

select throws_ok(
  $$select private.write_audit_event('entry.read', 'entry', 'e1000000-0000-0000-0000-000000000001'::uuid)$$,
  'P0001',
  null,
  'writer raises when auth.uid() is null'
);

-- Positive write as owner with auth.uid() claim set
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

do $$
declare
  v_id uuid;
begin
  select private.write_audit_event('entry.read', 'entry', 'e1000000-0000-0000-0000-000000000001'::uuid) into v_id;
end $$;

select is(
  (select actor_id from private.audit_events order by at desc limit 1),
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'actor_id matches auth.uid() from JWT claims without explicit actor parameter'
);

-- (d) After two events, second prev_hash equals first hash; first event uses fixed documented genesis value
select is(
  (select prev_hash from private.audit_events order by at asc limit 1),
  '0000000000000000000000000000000000000000000000000000000000000000',
  'first event uses fixed documented genesis value'
);

do $$
declare
  v_id uuid;
begin
  select private.write_audit_event('entry.update', 'entry', 'e1000000-0000-0000-0000-000000000001'::uuid) into v_id;
end $$;

select is(
  (select prev_hash from private.audit_events order by at desc limit 1),
  (select hash from private.audit_events order by at asc limit 1),
  'second event prev_hash equals first event hash'
);

-- Seed third event to test seq and tamper scenarios
do $$
declare
  v_id uuid;
begin
  select private.write_audit_event('entry.share', 'entry', 'e1000000-0000-0000-0000-000000000001'::uuid) into v_id;
end $$;

-- (a) After writing 3 events with the writer, seq values are exactly 1,2,3
select is(
  (select array_agg(seq order by seq asc) from private.audit_events),
  array[1::bigint, 2::bigint, 3::bigint],
  'after writing 3 events with the writer, seq values are exactly 1,2,3'
);

-- (e) Verification function returns true on an untouched chain
select is(
  private.verify_audit_events(),
  true,
  'verification returns true on untouched chain'
);

-- User addition: check constraints enforce machine-style regex ^[a-z][a-z0-9_.]{0,63}$
select throws_ok(
  $$select private.write_audit_event('invalid action with spaces', 'entry', 'e1000000-0000-0000-0000-000000000001'::uuid)$$,
  '23514',
  null,
  'action with spaces is rejected by check constraint'
);

select throws_ok(
  $$select private.write_audit_event('alice@test.invalid', 'entry', 'e1000000-0000-0000-0000-000000000001'::uuid)$$,
  '23514',
  null,
  'action with email-like characters is rejected by check constraint'
);

select throws_ok(
  $$select private.write_audit_event('entry.read', 'Client Entry', 'e1000000-0000-0000-0000-000000000001'::uuid)$$,
  '23514',
  null,
  'subject_type with spaces and capitals is rejected by check constraint'
);

-- (g) Triggers raise on UPDATE, DELETE and TRUNCATE even for the table owner
select throws_ok(
  $$update private.audit_events set action = 'tamper'$$,
  'P0001',
  null,
  'trigger raises on UPDATE even for table owner'
);

select throws_ok(
  $$delete from private.audit_events where id = (select id from private.audit_events limit 1)$$,
  'P0001',
  null,
  'trigger raises on DELETE even for table owner'
);

select throws_ok(
  $$truncate private.audit_events$$,
  'P0001',
  null,
  'trigger raises on TRUNCATE even for table owner'
);

-- (d) The three tamper triggers have tgenabled = 'A' in pg_trigger
select is(
  (select t.tgenabled
   from pg_trigger t
   join pg_class c on c.oid = t.tgrelid
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'private' and c.relname = 'audit_events' and t.tgname = 'audit_events_no_update'),
  'A',
  'audit_events_no_update trigger has tgenabled = A (ALWAYS)'
);

select is(
  (select t.tgenabled
   from pg_trigger t
   join pg_class c on c.oid = t.tgrelid
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'private' and c.relname = 'audit_events' and t.tgname = 'audit_events_no_delete'),
  'A',
  'audit_events_no_delete trigger has tgenabled = A (ALWAYS)'
);

select is(
  (select t.tgenabled
   from pg_trigger t
   join pg_class c on c.oid = t.tgrelid
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'private' and c.relname = 'audit_events' and t.tgname = 'audit_events_no_truncate'),
  'A',
  'audit_events_no_truncate trigger has tgenabled = A (ALWAYS)'
);

-- (e) Shared hash function is not executable by anon or authenticated
select ok(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname = 'audit_event_hash'
      and (has_function_privilege('anon', p.oid, 'execute')
           or has_function_privilege('authenticated', p.oid, 'execute')
           or has_function_privilege('public', p.oid, 'execute'))
  ),
  'shared hash function is not executable by public, anon, or authenticated'
);

select ok(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname = 'audit_event_hash'
      and has_function_privilege('authenticated', p.oid, 'execute')
  ),
  'control: authenticated cannot execute shared hash function'
);

-- (f) Tampering, reordering, and deleting a middle row causes verification to return false
-- 1. Modify one row
select is(
  private.verify_audit_events(),
  true,
  'chain is valid before modifying one row'
);

savepoint tamper_modify;

do $$
declare
  v_mid_id uuid;
begin
  select id into v_mid_id from private.audit_events where action = 'entry.update';
  alter table private.audit_events disable trigger user;
  update private.audit_events set action = 'tampered.action' where id = v_mid_id;
  alter table private.audit_events enable trigger user;
end $$;

select is(
  private.verify_audit_events(),
  false,
  'verification returns false after tampering one row'
);

rollback to savepoint tamper_modify;

-- 2. Reorder a pair
select is(
  private.verify_audit_events(),
  true,
  'chain is valid before reordering a pair'
);

savepoint tamper_reorder;

do $$
declare
  v_id1 uuid;
  v_id2 uuid;
  v_at1 timestamptz;
  v_at2 timestamptz;
begin
  select id, at into v_id1, v_at1 from private.audit_events order by at asc limit 1;
  select id, at into v_id2, v_at2 from private.audit_events order by at asc offset 1 limit 1;
  alter table private.audit_events disable trigger user;
  update private.audit_events set at = v_at2 where id = v_id1;
  update private.audit_events set at = v_at1 where id = v_id2;
  alter table private.audit_events enable trigger user;
end $$;

select is(
  private.verify_audit_events(),
  false,
  'verification returns false after reordering a pair'
);

rollback to savepoint tamper_reorder;

-- 3. Delete middle row
select is(
  private.verify_audit_events(),
  true,
  'chain is valid before deleting middle row'
);

savepoint tamper_delete;

do $$
declare
  v_mid_id uuid;
begin
  select id into v_mid_id from private.audit_events where action = 'entry.update';
  alter table private.audit_events disable trigger user;
  delete from private.audit_events where id = v_mid_id;
  alter table private.audit_events enable trigger user;
end $$;

select is(
  private.verify_audit_events(),
  false,
  'verification returns false after deleting middle row'
);

rollback to savepoint tamper_delete;

-- (b) Clock independence: as superuser, build valid chain with DEcreasing at timestamps (seq 1,2,3)
savepoint test_clock_independence;

alter table private.audit_events disable trigger user;
delete from private.audit_events;
alter table private.audit_events enable trigger user;

do $$
declare
  v_actor uuid := 'a0000000-0000-0000-0000-000000000001'::uuid;
  v_subj uuid := 'e0000000-0000-0000-0000-000000000001'::uuid;
  v_t timestamptz := '2026-11-14 12:00:00+00'::timestamptz;
  v_id1 uuid := '10000000-0000-0000-0000-000000000001'::uuid;
  v_id2 uuid := '20000000-0000-0000-0000-000000000002'::uuid;
  v_id3 uuid := '30000000-0000-0000-0000-000000000003'::uuid;
  v_genesis text := '0000000000000000000000000000000000000000000000000000000000000000';
  v_h1 text;
  v_h2 text;
  v_h3 text;
begin
  -- Row 1: at = T, seq = 1
  v_h1 := private.audit_event_hash(v_id1, v_t, v_actor, 'entry.read', 'entry', v_subj, v_genesis, 1, 1::bigint);
  insert into private.audit_events (id, at, actor_id, action, subject_type, subject_id, prev_hash, hash, hash_version, seq)
  values (v_id1, v_t, v_actor, 'entry.read', 'entry', v_subj, v_genesis, v_h1, 1, 1);

  -- Row 2: at = T - 1 hour (decreasing at), seq = 2
  v_h2 := private.audit_event_hash(v_id2, v_t - interval '1 hour', v_actor, 'entry.update', 'entry', v_subj, v_h1, 1, 2::bigint);
  insert into private.audit_events (id, at, actor_id, action, subject_type, subject_id, prev_hash, hash, hash_version, seq)
  values (v_id2, v_t - interval '1 hour', v_actor, 'entry.update', 'entry', v_subj, v_h1, v_h2, 1, 2);

  -- Row 3: at = T - 2 hours (decreasing at), seq = 3
  v_h3 := private.audit_event_hash(v_id3, v_t - interval '2 hours', v_actor, 'entry.share', 'entry', v_subj, v_h2, 1, 3::bigint);
  insert into private.audit_events (id, at, actor_id, action, subject_type, subject_id, prev_hash, hash, hash_version, seq)
  values (v_id3, v_t - interval '2 hours', v_actor, 'entry.share', 'entry', v_subj, v_h2, v_h3, 1, 3);
end $$;

select is(
  private.verify_audit_events(),
  true,
  'chain with decreasing at timestamps (clock independence) verifies true'
);

rollback to savepoint test_clock_independence;

-- (c) Tie independence: two valid rows with same at and larger id first by seq
savepoint test_tie_independence;

alter table private.audit_events disable trigger user;
delete from private.audit_events;
alter table private.audit_events enable trigger user;

do $$
declare
  v_actor uuid := 'a0000000-0000-0000-0000-000000000001'::uuid;
  v_subj uuid := 'e0000000-0000-0000-0000-000000000001'::uuid;
  v_t timestamptz := '2026-11-14 12:00:00+00'::timestamptz;
  v_id1 uuid := 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid;
  v_id2 uuid := '00000000-0000-0000-0000-000000000000'::uuid;
  v_genesis text := '0000000000000000000000000000000000000000000000000000000000000000';
  v_h1 text;
  v_h2 text;
begin
  -- Row 1: larger UUID, seq = 1
  v_h1 := private.audit_event_hash(v_id1, v_t, v_actor, 'entry.read', 'entry', v_subj, v_genesis, 1, 1::bigint);
  insert into private.audit_events (id, at, actor_id, action, subject_type, subject_id, prev_hash, hash, hash_version, seq)
  values (v_id1, v_t, v_actor, 'entry.read', 'entry', v_subj, v_genesis, v_h1, 1, 1);

  -- Row 2: smaller UUID, same at timestamp, seq = 2
  v_h2 := private.audit_event_hash(v_id2, v_t, v_actor, 'entry.update', 'entry', v_subj, v_h1, 1, 2::bigint);
  insert into private.audit_events (id, at, actor_id, action, subject_type, subject_id, prev_hash, hash, hash_version, seq)
  values (v_id2, v_t, v_actor, 'entry.update', 'entry', v_subj, v_h1, v_h2, 1, 2);
end $$;

select is(
  private.verify_audit_events(),
  true,
  'chain with identical at and inverted id order (tie independence) verifies true'
);

rollback to savepoint test_tie_independence;

reset role;
select * from finish();
rollback;
