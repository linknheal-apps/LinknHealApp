-- R3 (spec-addendum-001, R3/R4): a therapist has NO direct SELECT on client data.
-- Expected state BEFORE the policy fix: assertions 8 and 9 FAIL (red). Synthetic data only.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

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
  ('b0000000-0000-0000-0000-000000000002', 'bob@test.invalid'),
  ('c0000000-0000-0000-0000-000000000003', 'carol@test.invalid');
insert into public.users (id, role) values
  ('a0000000-0000-0000-0000-000000000001', 'client'),
  ('b0000000-0000-0000-0000-000000000002', 'client'),
  ('c0000000-0000-0000-0000-000000000003', 'therapist');
insert into public.partner_links (client_id, partner_id, status)
  values ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'active');
insert into public.therapist_client_links (therapist_id, client_id, status)
  values ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'active');
insert into public.entries (id, owner_id, entry_type, body) values
  ('e1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'mood', '{"mood": 7}'),
  ('e2000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'reflection', '{"text": "synthetic"}'),
  ('e3000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'mood', '{"mood": 3}');

select is((select count(*)::int from public.entries), 3, '1 fixture: 3 entries seeded (guards against vacuous passes)');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok($$select public.share_entry('e1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003')$$, '2 setup: owner shares entry 1 with the linked therapist');
select lives_ok($$select public.share_entry('e2000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002')$$, '3 setup: owner shares entry 2 with the linked partner');
select is((select count(*)::int from public.entries where id = 'e1000000-0000-0000-0000-000000000001'), 1, '4 control: owner reads entry 1');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"c0000000-0000-0000-0000-000000000003","role":"authenticated"}';
select is(current_user::text, 'authenticated', '5 runs as authenticated, never postgres');
select is((select count(*)::int from public.shares where shared_with_user_id = 'c0000000-0000-0000-0000-000000000003'), 1, '6 control: the therapist share row exists and is visible to the recipient');
select is((select count(*)::int from public.therapist_client_links where status = 'active'), 1, '7 control: the therapist link is active');
select is((select count(*)::int from public.entries where id = 'e1000000-0000-0000-0000-000000000001'), 0, '8 R3: therapist has no direct SELECT on a shared entry');
select is((select count(*)::int from public.entries), 0, '9 R3: therapist sees zero entries in a raw query');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-000000000002","role":"authenticated"}';
select is((select count(*)::int from public.entries where id = 'e2000000-0000-0000-0000-000000000002'), 1, '10 control: partner still reads the entry shared with them (R3 must not over-close)');
select is((select count(*)::int from public.entries where id = 'e1000000-0000-0000-0000-000000000001'), 0, '11 partner cannot read the entry shared only with the therapist');

select * from finish();
rollback;