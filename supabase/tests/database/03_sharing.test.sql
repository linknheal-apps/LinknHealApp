-- Sharing flow and share attacks (matrix 3, 5, 8, 9, 12, 15)
-- Runs with `supabase test db` (pgTAP). Synthetic data only. Everything is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

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
select lives_ok($$select public.share_entry('e1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002')$$, 'owner shares entry 1 with linked partner via share_entry()');
select is((select count(*)::int from public.shares where entry_id = 'e1000000-0000-0000-0000-000000000001' and shared_with_user_id = 'b0000000-0000-0000-0000-000000000002'), 1, 'owner can see the share row');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-000000000002","role":"authenticated"}';
select is((select count(*)::int from public.entries where id = 'e1000000-0000-0000-0000-000000000001'), 1, 'T3 recipient reads the shared entry');
select is((select count(*)::int from public.entries where id = 'e2000000-0000-0000-0000-000000000002'), 0, 'T3 recipient still cannot read the other, unshared entry');
select lives_ok($sql$
  do $do$
  declare n int;
  begin
    update public.entries set body = '{"hacked": true}' where id = 'e1000000-0000-0000-0000-000000000001';
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'affected % rows, expected 0', n; end if;
  end $do$
$sql$, 'recipient cannot edit a shared entry (0 rows)');
select lives_ok($sql$
  do $do$
  declare n int;
  begin
    delete from public.entries where id = 'e1000000-0000-0000-0000-000000000001';
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'affected % rows, expected 0', n; end if;
  end $do$
$sql$, 'recipient cannot delete a shared entry (0 rows)');
select lives_ok($sql$
  do $do$
  declare n int;
  begin
    delete from public.shares where entry_id = 'e1000000-0000-0000-0000-000000000001';
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'affected % rows, expected 0', n; end if;
  end $do$
$sql$, 'T15 recipient cannot delete the share (0 rows)');
select throws_ok($$update public.shares set shared_with_user_id = 'd0000000-0000-0000-0000-000000000004' where entry_id = 'e1000000-0000-0000-0000-000000000001'$$,
  '42501', 'permission denied for table shares', 'T15 recipient cannot edit a share');
select throws_ok($$insert into public.shares (entry_id, owner_id, shared_with_user_id) values ('e3000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001')$$,
  '42501', 'permission denied for table shares', 'direct insert into shares is denied, even for own entry');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok($$select public.share_entry('e2000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003')$$, 'owner shares entry 2 with linked therapist');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"c0000000-0000-0000-0000-000000000003","role":"authenticated"}';
select is((select count(*)::int from public.entries where id = 'e2000000-0000-0000-0000-000000000002'), 1, 'therapist reads the entry shared with them');
select is((select count(*)::int from public.entries where id = 'e1000000-0000-0000-0000-000000000001'), 0, 'therapist cannot read the entry not shared with them');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok($sql$
  do $do$
  declare n int;
  begin
    delete from public.shares where entry_id = 'e1000000-0000-0000-0000-000000000001' and shared_with_user_id = 'b0000000-0000-0000-0000-000000000002';
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'affected % rows, expected 1', n; end if;
  end $do$
$sql$, 'T5 owner revokes the share (1 row)');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-000000000002","role":"authenticated"}';
select is((select count(*)::int from public.entries where id = 'e1000000-0000-0000-0000-000000000001'), 0, 'T5 revoked share removes access on the very next read');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"d0000000-0000-0000-0000-000000000004","role":"authenticated"}';
select throws_ok($$insert into public.shares (entry_id, owner_id, shared_with_user_id) values ('e1000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000004')$$,
  '42501', 'permission denied for table shares', 'T8 forged share by direct insert is denied');
select throws_ok($$select public.share_entry('e1000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004')$$, 'P0001', 'share_not_allowed', 'T8 forged share to self via RPC is rejected');
select throws_ok($$select public.share_entry('e1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002')$$, 'P0001', 'share_not_allowed', 'T8 sharing someone else entry via RPC is rejected');
select is((select count(*)::int from public.entries where id = 'e1000000-0000-0000-0000-000000000001'), 0, 'T8 attacker still cannot read the victim entry');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok($$select public.share_entry('e1000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004')$$, 'P0001', 'share_not_allowed', 'T9 sharing with an unlinked user is rejected');
select throws_ok($$select public.share_entry('ffffffff-ffff-ffff-ffff-ffffffffffff', 'b0000000-0000-0000-0000-000000000002')$$, 'P0001', 'share_not_allowed', 'T12 nonexistent entry gives the same error as the cases above');
select lives_ok($$select public.share_entry('e2000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003')$$, 'sharing the same entry twice is idempotent and reveals nothing');

reset role;
select * from finish();
rollback;