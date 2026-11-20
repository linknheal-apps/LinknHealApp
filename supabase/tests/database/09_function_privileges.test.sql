-- Function privilege and hardening catalog tests (T003c, R9)
-- Asserts:
--   a1) schema private: NO function is executable by PUBLIC or anon
--   a2) schema private: authenticated may execute ONLY the allowlisted function
--   b) schema public: NO function is executable by PUBLIC or anon
--   c) schema public: authenticated may execute ONLY functions in an allowlist
--   d) every SECURITY DEFINER function in schemas public and private has search_path="" in proconfig
--   e) functions in public/private referencing write_audit_event (excluding real write_audit_event by oid) match empty allowlist

begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

-- Diagnostic dump: list every function in public and private with its privileges
do $$
declare
  r record;
begin
  for r in
    select
      n.nspname,
      format('%I(%s)', p.proname, oidvectortypes(p.proargtypes)) as sig,
      p.prosecdef,
      coalesce(p.proconfig::text, '<null>') as proconfig,
      coalesce(p.proacl::text, '<null>') as proacl,
      (p.proacl is null or exists (select 1 from aclexplode(p.proacl) a where a.grantee = 0 and a.privilege_type = 'EXECUTE')) as public_exec,
      has_function_privilege('anon', p.oid, 'EXECUTE') as anon_exec,
      has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_exec
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
    order by n.nspname, p.proname
  loop
    perform diag(format('CATALOG: %I.%s prosecdef=%s proconfig=%s proacl=%s public=%s anon=%s auth=%s',
      r.nspname, r.sig, r.prosecdef, r.proconfig, r.proacl, r.public_exec, r.anon_exec, r.auth_exec));
    raise notice '%', format('CATALOG: %I.%s prosecdef=%s proconfig=%s proacl=%s public=%s anon=%s auth=%s',
      r.nspname, r.sig, r.prosecdef, r.proconfig, r.proacl, r.public_exec, r.anon_exec, r.auth_exec);
  end loop;
end $$;

-- a1) schema private: NO function is executable by PUBLIC or anon
select is_empty(
  $$
    select format('%I.%I(%s)', n.nspname, p.proname, oidvectortypes(p.proargtypes)) as offending_function
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and (
        p.proacl is null
        or exists (
          select 1 from aclexplode(p.proacl) a
          where a.privilege_type = 'EXECUTE'
            and (a.grantee = 0 or a.grantee = 'anon'::regrole::oid)
        )
        or has_function_privilege('anon', p.oid, 'EXECUTE')
      )
    order by offending_function
  $$,
  'schema private: NO function is executable by PUBLIC or anon'
);

-- a2) schema private: authenticated may execute ONLY the allowlisted function
select set_eq(
  $$
    select format('%I.%I(%s)', n.nspname, p.proname, oidvectortypes(p.proargtypes)) as func_sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and (
        p.proacl is null
        or exists (
          select 1 from aclexplode(p.proacl) a
          where a.privilege_type = 'EXECUTE'
            and (a.grantee = 0 or a.grantee = 'authenticated'::regrole::oid)
        )
        or has_function_privilege('authenticated', p.oid, 'EXECUTE')
      )
  $$,
  $$
    select unnest(array[
      'private.is_actively_linked_to(uuid)'
    ]::text[])
  $$,
  'schema private: authenticated may execute ONLY the allowlisted function'
);

-- b) schema public: NO function is executable by PUBLIC or anon
select is_empty(
  $$
    select format('%I.%I(%s)', n.nspname, p.proname, oidvectortypes(p.proargtypes)) as offending_function
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (
        p.proacl is null
        or exists (
          select 1 from aclexplode(p.proacl) a
          where a.privilege_type = 'EXECUTE'
            and (a.grantee = 0 or a.grantee = 'anon'::regrole::oid)
        )
        or has_function_privilege('anon', p.oid, 'EXECUTE')
      )
    order by offending_function
  $$,
  'schema public: NO function is executable by PUBLIC or anon'
);

-- c) schema public: authenticated may execute ONLY functions in an allowlist
-- Allowlist built from current catalog
select set_eq(
  $$
    select format('%I(%s)', p.proname, oidvectortypes(p.proargtypes)) as func_sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (
        p.proacl is null
        or exists (
          select 1 from aclexplode(p.proacl) a
          where a.privilege_type = 'EXECUTE'
            and (a.grantee = 0 or a.grantee = 'authenticated'::regrole::oid)
        )
        or has_function_privilege('authenticated', p.oid, 'EXECUTE')
      )
  $$,
  $$
    select unnest(array[
      'share_entry(uuid, uuid)'
    ]::text[])
  $$,
  'schema public: authenticated may execute ONLY functions in allowlist'
);

-- d) every SECURITY DEFINER function in schemas public and private has a fixed search_path in proconfig
select is_empty(
  $$
    select format('%I.%I(%s)', n.nspname, p.proname, oidvectortypes(p.proargtypes)) as offending_function
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and p.prosecdef
      and not exists (
        select 1 from unnest(coalesce(p.proconfig, array[]::text[])) c
        where c = 'search_path=""'
      )
    order by offending_function
  $$,
  'every SECURITY DEFINER function in schemas public and private has a fixed search_path in proconfig'
);

-- Note: Static inspection via pg_get_functiondef cannot detect dynamic SQL or indirect function calls.
-- e) functions in public/private referencing write_audit_event (excluding real write_audit_event by oid) match empty allowlist
select set_eq(
  $$
    select format('%I.%I(%s)', n.nspname, p.proname, oidvectortypes(p.proargtypes)) as func_sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and p.prokind in ('f', 'p')
      and p.oid <> to_regprocedure('private.write_audit_event(text, text, uuid)')::oid
      and pg_get_functiondef(p.oid) ~* '\ywrite_audit_event\y'
  $$,
  $$
    select unnest(array[]::text[])
  $$,
  'functions in public/private referencing write_audit_event match allowlist (empty)'
);

select * from finish();
rollback;
