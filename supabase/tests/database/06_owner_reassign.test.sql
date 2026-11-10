-- Owner-reassign mutation killer (M7: WITH CHECK on entries_update_own)
-- Runs with `supabase test db` (pgTAP). Synthetic data only. Everything is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

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

-- fixtures (seeded as privileged role)
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'alice@test.invalid'),
  ('b0000000-0000-0000-0000-000000000002', 'bob@test.invalid');

insert into public.users (id, role) values
  ('a0000000-0000-0000-0000-000000000001', 'client'),
  ('b0000000-0000-0000-0000-000000000002', 'client');

insert into public.entries (id, owner_id, entry_type, body) values
  ('e7000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'mood', '{"mood": 5}');

-- (1) As A: positive control – A can see their own entry
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  (select count(*)::int from public.entries where id = 'e7000000-0000-0000-0000-000000000007'),
  1,
  'M7-1 owner A can read their own entry (positive control)'
);

-- (2) As A: update owner_id to B must raise RLS violation
select throws_ok(
  $$update public.entries set owner_id = 'b0000000-0000-0000-0000-000000000002' where id = 'e7000000-0000-0000-0000-000000000007'$$,
  '42501',
  'new row violates row-level security policy for table "entries"',
  'M7-2 owner cannot reassign owner_id to another user (WITH CHECK blocks it)'
);

-- (3) As postgres: owner_id is still A (state check)
reset role;

select is(
  (select owner_id from public.entries where id = 'e7000000-0000-0000-0000-000000000007'),
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'M7-3 owner_id unchanged after rejected reassign attempt'
);

-- (4) As B: cannot see the entry at all (no shares exist)
set local role authenticated;
set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-000000000002","role":"authenticated"}';

select is(
  (select count(*)::int from public.entries where id = 'e7000000-0000-0000-0000-000000000007'),
  0,
  'M7-4 user B cannot see the entry (no share, not owner)'
);

reset role;
select * from finish();
rollback;
