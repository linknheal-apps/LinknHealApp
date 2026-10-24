-- Links: ended link grants nothing and revokes shares (matrix 6, 10, read-time recheck)
-- Runs with `supabase test db` (pgTAP). Synthetic data only. Everything is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

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

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok($$select public.share_entry('e1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002')$$, 'setup: owner shares entry 1 with partner');
reset role;
select is((select count(*)::int from public.shares where shared_with_user_id = 'b0000000-0000-0000-0000-000000000002'), 1, 'control: share row exists before the link ends');
update public.partner_links set status = 'ended' where client_id = 'a0000000-0000-0000-0000-000000000001' and partner_id = 'b0000000-0000-0000-0000-000000000002';
select is((select count(*)::int from public.shares where shared_with_user_id = 'b0000000-0000-0000-0000-000000000002'), 0, 'T10 ending the link deleted the existing share');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-000000000002","role":"authenticated"}';
select is((select count(*)::int from public.entries where id = 'e1000000-0000-0000-0000-000000000001'), 0, 'T6 partner cannot read after the link ended');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok($$select public.share_entry('e2000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002')$$, 'P0001', 'share_not_allowed', 'T6 cannot share with a partner whose link ended');
reset role;
update public.partner_links set status = 'active' where client_id = 'a0000000-0000-0000-0000-000000000001' and partner_id = 'b0000000-0000-0000-0000-000000000002';
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-000000000002","role":"authenticated"}';
select is((select count(*)::int from public.entries where id = 'e1000000-0000-0000-0000-000000000001'), 0, 'T10 re-linking does not resurrect the old share');
select is((select count(*)::int from public.entries where id = 'e2000000-0000-0000-0000-000000000002'), 0, 'T6 re-linking alone grants nothing');
reset role;
update public.partner_links set status = 'ended' where client_id = 'a0000000-0000-0000-0000-000000000001' and partner_id = 'b0000000-0000-0000-0000-000000000002';
insert into public.shares (entry_id, owner_id, shared_with_user_id) values ('e1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002');
select is((select count(*)::int from public.shares where shared_with_user_id = 'b0000000-0000-0000-0000-000000000002'), 1, 'control: a stale share row exists while the link is ended');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-000000000002","role":"authenticated"}';
select is((select count(*)::int from public.entries where id = 'e1000000-0000-0000-0000-000000000001'), 0, 'read policy re-checks the link at read time (stale share grants nothing)');
reset role;
update public.partner_links set status = 'active' where client_id = 'a0000000-0000-0000-0000-000000000001' and partner_id = 'b0000000-0000-0000-0000-000000000002';
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-000000000002","role":"authenticated"}';
select is((select count(*)::int from public.entries where id = 'e1000000-0000-0000-0000-000000000001'), 1, 'control: the same share row is readable once the link is active again');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok($$select public.share_entry('e1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003')$$, 'setup: owner shares entry 1 with therapist');
reset role;
select is((select count(*)::int from public.shares where shared_with_user_id = 'c0000000-0000-0000-0000-000000000003'), 1, 'control: therapist share exists');
update public.therapist_client_links set status = 'ended' where therapist_id = 'c0000000-0000-0000-0000-000000000003' and client_id = 'a0000000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.shares where shared_with_user_id = 'c0000000-0000-0000-0000-000000000003'), 0, 'ending the therapist link deletes the therapist share');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"c0000000-0000-0000-0000-000000000003","role":"authenticated"}';
select is((select count(*)::int from public.entries where id = 'e1000000-0000-0000-0000-000000000001'), 0, 'therapist cannot read after the link ended');

reset role;
select * from finish();
rollback;