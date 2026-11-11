-- Ownership transfer and relationship disclosure tests
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
  ('b0000000-0000-0000-0000-000000000002', 'bob@test.invalid'),
  ('c0000000-0000-0000-0000-000000000003', 'carol@test.invalid'),
  ('d0000000-0000-0000-0000-000000000005', 'stranger@test.invalid');

insert into public.users (id, role) values
  ('a0000000-0000-0000-0000-000000000001', 'client'),
  ('b0000000-0000-0000-0000-000000000002', 'client'),
  ('c0000000-0000-0000-0000-000000000003', 'therapist'),
  ('d0000000-0000-0000-0000-000000000005', 'client');

insert into public.partner_links (client_id, partner_id, status) values
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'active');

insert into public.therapist_client_links (therapist_id, client_id, status) values
  ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'active');

insert into public.entries (id, owner_id, entry_type, body) values
  ('e1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'mood', '{"mood": 7}');

-- (a) Client A cannot transfer entry ownership to B
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select throws_ok(
  $$update public.entries set owner_id = 'b0000000-0000-0000-0000-000000000002' where id = 'e1000000-0000-0000-0000-000000000001'$$,
  '42501',
  'new row violates row-level security policy for table "entries"',
  'owner cannot transfer entry ownership to another user'
);

select is(
  (select owner_id from public.entries where id = 'e1000000-0000-0000-0000-000000000001'),
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'entry owner_id remains client A after failed transfer'
);

-- (b) Stranger S cannot see partner or therapist links
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"d0000000-0000-0000-0000-000000000005","role":"authenticated"}';

select is(
  (select count(*)::int from public.partner_links where client_id = 'a0000000-0000-0000-0000-000000000001'),
  0,
  'stranger sees 0 partner links for user A'
);

select is(
  (select count(*)::int from public.therapist_client_links where client_id = 'a0000000-0000-0000-0000-000000000001'),
  0,
  'stranger sees 0 therapist client links for user A'
);

reset role;
select * from finish();
rollback;
