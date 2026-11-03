-- Meta: RLS enabled+forced everywhere, grants, definer-function hygiene (matrix 11, 16, 17)
-- Runs with `supabase test db` (pgTAP). Synthetic data only. Everything is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

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

select tables_are('public',
  array['entries','partner_links','shares','therapist_client_links','users']::name[],
  'public contains exactly the expected tables (a new table must be added here, with its tests)');

select is((select count(*)::int
           from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind in ('r','p')
             and not (c.relrowsecurity and c.relforcerowsecurity)),
          0, 'every public table has RLS enabled AND forced');

select ok(not has_table_privilege('anon', format('public.%I', t),
            'select,insert,update,delete,truncate,references,trigger'),
          'anon has no privileges on public.' || t)
from unnest(array['users','partner_links','therapist_client_links','entries','shares']) as t;

select ok(not has_table_privilege('authenticated', format('public.%I', t), 'insert,update,delete,truncate'),
          'authenticated cannot write public.' || t || ' directly')
from unnest(array['users','partner_links','therapist_client_links']) as t;

select ok(not has_table_privilege('authenticated', 'public.shares', 'insert,update,truncate'),
          'authenticated cannot insert or update shares directly (only share_entry() creates them)');

select is((select count(*)::int
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname in ('public','private') and p.prosecdef and p.proname <> 'rls_auto_enable'
             and not exists (select 1 from unnest(coalesce(p.proconfig, array[]::text[])) c
                             where c like 'search_path=%')),
          0, 'every SECURITY DEFINER function sets search_path');

select cmp_ok((select count(*)::int
               from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname in ('public','private') and p.prosecdef and p.proname <> 'rls_auto_enable'),
              '>=', 4, 'control: our SECURITY DEFINER functions exist (the check above is not vacuous)');

select views_are('public', array[]::name[], 'no views in public yet (any future view must be security_invoker)');

select ok(not has_function_privilege('anon', 'public.share_entry(uuid,uuid)', 'execute'),
          'anon cannot execute share_entry');
select ok(not has_function_privilege('anon', 'private.is_actively_linked_to(uuid)', 'execute'),
          'anon cannot execute the link helper');
select ok(has_function_privilege('authenticated', 'public.share_entry(uuid,uuid)', 'execute'),
          'control: authenticated can execute share_entry');
select ok(not has_schema_privilege('anon', 'private', 'usage'),
          'anon has no access to the private schema');

reset role;
select * from finish();
rollback;