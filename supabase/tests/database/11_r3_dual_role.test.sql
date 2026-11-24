-- R3 dual-role characterization: one person is BOTH therapist and partner of the SAME client.
-- Assertion 7 documents CURRENT behavior (decision pending). Flip 1 -> 0 if dual-role direct read is to be forbidden.
-- Synthetic data only.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

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

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'alice@test.invalid'),
  ('c0000000-0000-0000-0000-000000000003', 'carol@test.invalid');
insert into public.users (id, role) values
  ('a0000000-0000-0000-0000-000000000001', 'client'),
  ('c0000000-0000-0000-0000-000000000003', 'therapist');
insert into public.partner_links (client_id, partner_id, status)
  values ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'active');
insert into public.therapist_client_links (therapist_id, client_id, status)
  values ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'active');
insert into public.entries (id, owner_id, entry_type, body) values
  ('e1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'mood', '{"mood": 7}'),
  ('e2000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'reflection', '{"text": "synthetic"}');

select is((select count(*)::int from public.entries), 2, '1 fixture: 2 entries seeded');
select is((select count(*)::int from public.partner_links where partner_id = 'c0000000-0000-0000-0000-000000000003' and status = 'active'), 1, '2 control: dual-role user has an active partner link');
select is((select count(*)::int from public.therapist_client_links where therapist_id = 'c0000000-0000-0000-0000-000000000003' and status = 'active'), 1, '3 control: same user has an active therapist link');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok($$select public.share_entry('e1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003')$$, '4 setup: owner shares entry 1 only with the dual-role user');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"c0000000-0000-0000-0000-000000000003","role":"authenticated"}';
select is(current_user::text, 'authenticated', '5 runs as authenticated, never postgres');
select is((select count(*)::int from public.shares where shared_with_user_id = 'c0000000-0000-0000-0000-000000000003'), 1, '6 control: the share row exists and is visible to the recipient');
select is((select count(*)::int from public.entries where id = 'e1000000-0000-0000-0000-000000000001'), 1, '7 CHARACTERIZATION (decision pending): dual-role user reads the entry shared with them via the partner path');
select is((select count(*)::int from public.entries where id = 'e2000000-0000-0000-0000-000000000002'), 0, '8 dual-role user cannot read the entry never shared with them');

select * from finish();
rollback;
