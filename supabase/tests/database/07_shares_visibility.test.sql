-- Shares visibility guard: a user must only see share rows where they are the owner or the recipient.
-- Positive controls: owner and recipient can each read their share row.
-- Negative controls: stranger and linked non-recipient third-party see 0 rows.
-- Direct lookup by id as stranger returns 0 rows, not an error.
-- Post-deletion check: recipient sees 0 rows after owner deletes the share.
-- Runs with `supabase test db` (pgTAP). Synthetic data only. Everything is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

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
  ('70000000-0000-0000-0000-000000000001', 'alice7@test.invalid'),
  ('70000000-0000-0000-0000-000000000002', 'bob7@test.invalid'),
  ('70000000-0000-0000-0000-000000000003', 'carol7@test.invalid'),
  ('70000000-0000-0000-0000-000000000004', 'stranger7@test.invalid');

insert into public.users (id, role) values
  ('70000000-0000-0000-0000-000000000001', 'client'),
  ('70000000-0000-0000-0000-000000000002', 'client'),
  ('70000000-0000-0000-0000-000000000003', 'therapist'),
  ('70000000-0000-0000-0000-000000000004', 'client');

insert into public.partner_links (client_id, partner_id, status) values
  ('70000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000002', 'active');

insert into public.therapist_client_links (therapist_id, client_id, status) values
  ('70000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000001', 'active');

insert into public.entries (id, owner_id, entry_type, body) values
  ('7e000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'mood', '{"mood": 8}');

-- Seed share via share_entry() as owner A
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"70000000-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok(
  $$select public.share_entry('7e000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000002')$$,
  'owner A shares entry with partner B via share_entry()'
);

-- (a) POSITIVE CONTROLS
-- 1. Owner A sees exactly 1 row in public.shares
select is(
  (select count(*)::int from public.shares where entry_id = '7e000000-0000-0000-0000-000000000001'),
  1,
  'positive control: owner A sees exactly 1 share row for the entry'
);

-- 2. Recipient B sees exactly 1 row in public.shares
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"70000000-0000-0000-0000-000000000002","role":"authenticated"}';
select is(
  (select count(*)::int from public.shares where entry_id = '7e000000-0000-0000-0000-000000000001'),
  1,
  'positive control: recipient B sees exactly 1 share row for the entry'
);

-- (b) NEGATIVE: stranger C (no link, no share) sees 0 rows from select count(*) from public.shares
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"70000000-0000-0000-0000-000000000004","role":"authenticated"}';
select is(
  (select count(*)::int from public.shares),
  0,
  'negative: stranger C sees 0 rows from public.shares'
);

-- (c) NEGATIVE: user T (linked therapist, but not recipient of this share) sees 0 rows of it
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"70000000-0000-0000-0000-000000000003","role":"authenticated"}';
select is(
  (select count(*)::int from public.shares where entry_id = '7e000000-0000-0000-0000-000000000001'),
  0,
  'negative: linked therapist T (non-recipient) sees 0 share rows for entry'
);

-- (d) NEGATIVE: direct lookup by id as stranger C returns 0, not an error
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"70000000-0000-0000-0000-000000000004","role":"authenticated"}';
select is(
  (select count(*)::int from public.shares where entry_id = '7e000000-0000-0000-0000-000000000001'),
  0,
  'negative: direct lookup by entry_id as stranger C returns 0 rows without error'
);

-- (e) Share deleted by owner -> recipient B sees 0 rows
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"70000000-0000-0000-0000-000000000001","role":"authenticated"}';
delete from public.shares where entry_id = '7e000000-0000-0000-0000-000000000001';

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"70000000-0000-0000-0000-000000000002","role":"authenticated"}';
select is(
  (select count(*)::int from public.shares where entry_id = '7e000000-0000-0000-0000-000000000001'),
  0,
  'post-deletion: recipient B sees 0 share rows after owner deletes the share'
);

reset role;
select * from finish();
rollback;
