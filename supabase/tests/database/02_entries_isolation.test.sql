-- Entries isolation (matrix 1, 2, 4, 7, 11, 13, 14)
-- Runs with `supabase test db` (pgTAP). Synthetic data only. Everything is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

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

-- fixtures (seeded as the privileged role; assertions run as low-privilege roles)
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'alice@test.invalid'),
  ('b0000000-0000-0000-0000-000000000002', 'bob@test.invalid'),
  ('c0000000-0000-0000-0000-000000000003', 'carol@test.invalid'),
  ('d0000000-0000-0000-0000-000000000004', 'mallory@test.invalid');
insert into public.users (id, role) values
  ('a0000000-0000-0000-0000-000000000001', 'client'), ('b0000000-0000-0000-0000-000000000002', 'client'), ('c0000000-0000-0000-0000-000000000003', 'therapist'), ('d0000000-0000-0000-0000-000000000004', 'client');
insert into public.partner_links (client_id, partner_id, status) values ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'active');
insert into public.therapist_client_links (therapist_id, client_id, status) values ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'active');
insert into public.entries (id, owner_id, entry_type, body) values
  ('e1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'mood', '{"mood": 7}'),
  ('e2000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'reflection', '{"text": "private thought"}'),
  ('e3000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000002', 'mood', '{"mood": 4}');

select is((select count(*)::int from public.entries), 3, 'fixture: 3 entries seeded (guards against vacuous passes)');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';
select is(current_user::text, 'authenticated', 'tests run as authenticated, never postgres');
select is((select count(*)::int from public.entries where id = 'e1000000-0000-0000-0000-000000000001'), 1, 'T1 owner reads own entry');
select is((select count(*)::int from public.entries), 2, 'owner sees exactly their own two entries');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-000000000002","role":"authenticated"}';
select is((select count(*)::int from public.entries where id = 'e3000000-0000-0000-0000-000000000003'), 1, 'control: partner reads their own entry');
select is((select count(*)::int from public.entries where id = 'e1000000-0000-0000-0000-000000000001'), 0, 'T2 partner cannot read an unshared entry although linked');
select is((select count(*)::int from public.entries), 1, 'T7 raw query as authenticated returns only the caller own rows');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"c0000000-0000-0000-0000-000000000003","role":"authenticated"}';
select is((select count(*)::int from public.entries), 0, 'T4 therapist cannot read any unshared entry although linked');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"d0000000-0000-0000-0000-000000000004","role":"authenticated"}';
select is((select count(*)::int from public.entries), 0, 'stranger sees no entries');
select lives_ok($sql$
  do $do$
  declare n int;
  begin
    update public.entries set body = '{"hacked": true}' where id = 'e1000000-0000-0000-0000-000000000001';
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'affected % rows, expected 0', n; end if;
  end $do$
$sql$, 'T13 cross-user update affects 0 rows');
select lives_ok($sql$
  do $do$
  declare n int;
  begin
    delete from public.entries where id = 'e1000000-0000-0000-0000-000000000001';
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'affected % rows, expected 0', n; end if;
  end $do$
$sql$, 'T13 cross-user delete affects 0 rows');
select throws_ok($$insert into public.entries (owner_id, entry_type, body) values ('a0000000-0000-0000-0000-000000000001', 'mood', '{}')$$,
  '42501', 'new row violates row-level security policy for table "entries"',
  'T14 cannot insert an entry owned by another user');
select lives_ok($$insert into public.entries (entry_type, body) values ('mood', '{"mood": 1}')$$,
  'control: stranger can insert an entry for themselves (owner defaults to caller)');
select is((select count(*)::int from public.entries where owner_id = 'd0000000-0000-0000-0000-000000000004'), 1, 'the new entry is owned by the caller');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';
select is((select body->>'mood' from public.entries where id = 'e1000000-0000-0000-0000-000000000001'), '7', 'entry unchanged after cross-user attempts');
select is((select count(*)::int from public.entries), 2, 'owner still sees exactly two entries (stranger entry invisible)');
reset role;
set local role anon;
select throws_ok('select count(*) from public.users', '42501', 'permission denied for table users', 'T11 anon cannot read users');
select throws_ok('select count(*) from public.partner_links', '42501', 'permission denied for table partner_links', 'T11 anon cannot read partner_links');
select throws_ok('select count(*) from public.therapist_client_links', '42501', 'permission denied for table therapist_client_links', 'T11 anon cannot read therapist_client_links');
select throws_ok('select count(*) from public.entries', '42501', 'permission denied for table entries', 'T11 anon cannot read entries');
select throws_ok('select count(*) from public.shares', '42501', 'permission denied for table shares', 'T11 anon cannot read shares');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated"}';
select is((select (select count(*) from public.users) + (select count(*) from public.partner_links)
                + (select count(*) from public.therapist_client_links) + (select count(*) from public.entries)
                + (select count(*) from public.shares))::int,
          0, 'T11 authenticated role without a user identity gets zero rows from every table');

reset role;
select * from finish();
rollback;