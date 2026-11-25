-- R3 follow-up: nested/embedded queries must preserve entries RLS.
-- Synthetic data only.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

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
  ('e2000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'reflection', '{"text": "synthetic"}');

select is((select count(*)::int from public.users), 3, '1 fixture: Alice, Bob, and Carol are seeded before switching role');
select is((select count(*)::int from public.partner_links where client_id = 'a0000000-0000-0000-0000-000000000001' and partner_id = 'b0000000-0000-0000-0000-000000000002' and status = 'active'), 1, '2 fixture: Alice and Bob have an active partner link');
select is((select count(*)::int from public.therapist_client_links where therapist_id = 'c0000000-0000-0000-0000-000000000003' and client_id = 'a0000000-0000-0000-0000-000000000001' and status = 'active'), 1, '3 fixture: Carol has an active therapist link with Alice');
select is((select count(*)::int from public.entries where owner_id = 'a0000000-0000-0000-0000-000000000001'), 2, '4 fixture: Alice owns entries E and F before switching role');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok($$select public.share_entry('e1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003')$$, '5 setup: Alice shares entry E with Carol');
select lives_ok($$select public.share_entry('e2000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002')$$, '6 setup: Alice shares entry F with Bob');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"c0000000-0000-0000-0000-000000000003","role":"authenticated"}';
select is(current_user::text, 'authenticated', '7 runs as authenticated, never postgres');
select is((select count(*)::int
           from public.shares s
           join public.entries e on e.id = s.entry_id
           where s.shared_with_user_id = 'c0000000-0000-0000-0000-000000000003'),
          0, '8 R3: joining Carol shares to entries returns no entry rows');
select is((
  select count(*) = 1 and bool_and(embedded_entry is null)
  from (
    select s.id,
           (select to_jsonb(e) from public.entries e where e.id = s.entry_id) as embedded_entry
    from public.shares s
    where s.shared_with_user_id = 'c0000000-0000-0000-0000-000000000003'
  ) embedded_shares
), true, '9 R3: Carol share row remains visible while its embedded entry is NULL');
select is((select count(*)::int
           from (
             select e.id,
                    (select jsonb_agg(s) from public.shares s where s.entry_id = e.id) as embedded_shares
             from public.entries e
           ) embedded_entries),
          0, '10 R3: reverse embedded query returns no entry rows for Carol');
select is((
  select count(*) = 1 and bool_and(embedded_entries is null or embedded_entries = '[]'::jsonb)
  from (
    select l.id,
           (select jsonb_agg(e) from public.entries e where e.owner_id = l.client_id) as embedded_entries
    from public.therapist_client_links l
  ) embedded_links
), true, '11 R3: Carol link row has no embedded Alice entries');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-000000000002","role":"authenticated"}';
select is((select count(*)::int
           from public.shares s
           join public.entries e on e.id = s.entry_id
           where s.shared_with_user_id = 'b0000000-0000-0000-0000-000000000002'),
          1, '12 control: Bob reads entry F through the share join');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';
select is((select count(*)::int from public.entries), 2, '13 control: Alice reads her own entries');

select * from finish();
rollback;
