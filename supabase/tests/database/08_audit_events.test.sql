-- Audit events table, writer, verification and trigger security tests (R10)
-- Runs with `supabase test db` (pgTAP). Synthetic data only. Everything is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

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

-- 1-5: Structure, columns, RLS, functions exist
select has_table('private', 'audit_events', 'table private.audit_events exists');

select columns_are('private', 'audit_events',
  array['action', 'actor_id', 'at', 'hash', 'hash_version', 'id', 'prev_hash', 'subject_id', 'subject_type']::name[],
  'audit_events has exact columns: id, at, actor_id, action, subject_type, subject_id, prev_hash, hash, hash_version');

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
  'anon cannot insert into audit_events'
);

select throws_ok(
  $$update private.audit_events set action = 'tamper'$$,
  '42501',
  'anon cannot update audit_events'
);

select throws_ok(
  $$delete from private.audit_events$$,
  '42501',
  'anon cannot delete from audit_events'
);

select throws_ok(
  $$truncate private.audit_events$$,
  '42501',
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
  'authenticated cannot insert into audit_events'
);

select throws_ok(
  $$update private.audit_events set action = 'tamper'$$,
  '42501',
  'authenticated cannot update audit_events'
);

select throws_ok(
  $$delete from private.audit_events$$,
  '42501',
  'authenticated cannot delete from audit_events'
);

select throws_ok(
  $$truncate private.audit_events$$,
  '42501',
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
  'anon execution of write_audit_event is denied'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok(
  $$select private.write_audit_event('entry.read', 'entry', 'e1000000-0000-0000-0000-000000000001'::uuid)$$,
  '42501',
  'authenticated execution of write_audit_event is denied'
);

-- (c) Called as owner role inside test, takes NO actor parameter; actor_id equals auth.uid(); with auth.uid() null it raises
reset role;

select throws_ok(
  $$select private.write_audit_event('entry.read', 'entry', 'e1000000-0000-0000-0000-000000000001'::uuid)$$,
  'P0001',
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
  'action with spaces is rejected by check constraint'
);

select throws_ok(
  $$select private.write_audit_event('alice@test.invalid', 'entry', 'e1000000-0000-0000-0000-000000000001'::uuid)$$,
  '23514',
  'action with email-like characters is rejected by check constraint'
);

select throws_ok(
  $$select private.write_audit_event('entry.read', 'Client Entry', 'e1000000-0000-0000-0000-000000000001'::uuid)$$,
  '23514',
  'subject_type with spaces and capitals is rejected by check constraint'
);

-- (g) Triggers raise on UPDATE, DELETE and TRUNCATE even for the table owner
select throws_ok(
  $$update private.audit_events set action = 'tamper'$$,
  'P0001',
  'trigger raises on UPDATE even for table owner'
);

select throws_ok(
  $$delete from private.audit_events where id = (select id from private.audit_events limit 1)$$,
  'P0001',
  'trigger raises on DELETE even for table owner'
);

select throws_ok(
  $$truncate private.audit_events$$,
  'P0001',
  'trigger raises on TRUNCATE even for table owner'
);

-- (f) Tampering, reordering, and deleting a middle row causes verification to return false
-- Seed third event to have E1 -> E2 -> E3
do $$
declare
  v_id uuid;
begin
  select private.write_audit_event('entry.share', 'entry', 'e1000000-0000-0000-0000-000000000001'::uuid) into v_id;
end $$;

-- Tampering a row (as superuser bypassing triggers temporarily)
do $$
declare
  v_mid_id uuid;
begin
  select id into v_mid_id from private.audit_events order by at asc offset 1 limit 1;
  alter table private.audit_events disable trigger user;
  update private.audit_events set action = 'tampered.action' where id = v_mid_id;
  alter table private.audit_events enable trigger user;
end $$;

select is(
  private.verify_audit_events(),
  false,
  'verification returns false after tampering one row'
);

-- Reordering a pair (swap E1 and E2 timestamps)
do $$
declare
  v_id1 uuid;
  v_id2 uuid;
  v_at1 timestamptz;
  v_at2 timestamptz;
  v_mid_id uuid;
begin
  -- Restore tampered action on middle row first
  select id into v_mid_id from private.audit_events order by at asc offset 1 limit 1;
  alter table private.audit_events disable trigger user;
  update private.audit_events set action = 'entry.update' where id = v_mid_id;

  -- Swap timestamps of first and second event
  select id, at into v_id1, v_at1 from private.audit_events order by at asc limit 1;
  select id, at into v_id2, v_at2 from private.audit_events order by at asc offset 1 limit 1;
  update private.audit_events set at = v_at2 where id = v_id1;
  update private.audit_events set at = v_at1 where id = v_id2;
  alter table private.audit_events enable trigger user;
end $$;

select is(
  private.verify_audit_events(),
  false,
  'verification returns false after reordering a pair'
);

-- Delete middle row
do $$
declare
  v_id1 uuid;
  v_id2 uuid;
  v_at1 timestamptz;
  v_at2 timestamptz;
  v_mid_id uuid;
begin
  -- Restore order
  select id into v_id1 from private.audit_events order by at asc limit 1;
  select id into v_id2 from private.audit_events order by at desc limit 1;
  -- delete the middle row
  select id into v_mid_id from private.audit_events order by at asc offset 1 limit 1;
  alter table private.audit_events disable trigger user;
  delete from private.audit_events where id = v_mid_id;
  alter table private.audit_events enable trigger user;
end $$;

select is(
  private.verify_audit_events(),
  false,
  'verification returns false after deleting middle row'
);

reset role;
select * from finish();
rollback;
