-- Phase 0 security layer (T007, T008, T009): RLS, grants, share RPC, link-end triggers.
-- Default deny. Access comes only from a `shares` row AND an active link, never from a link alone.

-- ---------- helper (private schema, not exposed through the API) ----------
create or replace function private.is_actively_linked_to(p_other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.partner_links l
    where l.status = 'active'
      and ((l.client_id = (select auth.uid()) and l.partner_id = p_other)
        or (l.partner_id = (select auth.uid()) and l.client_id = p_other))
  ) or exists (
    select 1 from public.therapist_client_links l
    where l.status = 'active'
      and ((l.client_id = (select auth.uid()) and l.therapist_id = p_other)
        or (l.therapist_id = (select auth.uid()) and l.client_id = p_other))
  );
$$;

revoke all on function private.is_actively_linked_to(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_actively_linked_to(uuid) to authenticated;

-- ---------- RLS on, forced ----------
alter table public.users enable row level security;
alter table public.users force row level security;
alter table public.partner_links enable row level security;
alter table public.partner_links force row level security;
alter table public.therapist_client_links enable row level security;
alter table public.therapist_client_links force row level security;
alter table public.entries enable row level security;
alter table public.entries force row level security;
alter table public.shares enable row level security;
alter table public.shares force row level security;

-- ---------- grants: nothing for anon; minimal for authenticated ----------
revoke all on table public.users, public.partner_links, public.therapist_client_links,
  public.entries, public.shares from public, anon, authenticated;

grant select on public.users, public.partner_links, public.therapist_client_links to authenticated;
grant select, insert, update, delete on public.entries to authenticated;
grant select, delete on public.shares to authenticated; -- shares are created only through share_entry()

-- ---------- policies ----------
create policy users_select_self on public.users
  for select to authenticated
  using (id = (select auth.uid()));

create policy partner_links_select_parties on public.partner_links
  for select to authenticated
  using (client_id = (select auth.uid()) or partner_id = (select auth.uid()));

create policy tc_links_select_parties on public.therapist_client_links
  for select to authenticated
  using (client_id = (select auth.uid()) or therapist_id = (select auth.uid()));

create policy entries_select_own on public.entries
  for select to authenticated
  using (owner_id = (select auth.uid()));

-- shared read: a share row for ME AND an active link with the owner, re-checked on every read
create policy entries_select_shared on public.entries
  for select to authenticated
  using (
    private.is_actively_linked_to(entries.owner_id)
    and exists (
      select 1 from public.shares s
      where s.entry_id = entries.id
        and s.shared_with_user_id = (select auth.uid())
    )
  );

create policy entries_insert_own on public.entries
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy entries_update_own on public.entries
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy entries_delete_own on public.entries
  for delete to authenticated
  using (owner_id = (select auth.uid()));

create policy shares_select_parties on public.shares
  for select to authenticated
  using (owner_id = (select auth.uid()) or shared_with_user_id = (select auth.uid()));

create policy shares_delete_owner on public.shares
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- ---------- the only way to create a share ----------
create or replace function public.share_entry(p_entry_id uuid, p_recipient_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
begin
  -- ONE uniform error for every failure, so entry ids and links cannot be probed
  if v_me is null
     or p_entry_id is null
     or p_recipient_id is null
     or p_recipient_id = v_me
     or not exists (select 1 from public.entries e where e.id = p_entry_id and e.owner_id = v_me)
     or not private.is_actively_linked_to(p_recipient_id)
  then
    raise exception 'share_not_allowed' using errcode = 'P0001';
  end if;

  insert into public.shares (entry_id, owner_id, shared_with_user_id)
  values (p_entry_id, v_me, p_recipient_id)
  on conflict (entry_id, shared_with_user_id) do nothing;
end;
$$;

revoke all on function public.share_entry(uuid, uuid) from public, anon;
grant execute on function public.share_entry(uuid, uuid) to authenticated;

-- ---------- ending (or deleting) a link revokes existing shares between the pair ----------
create or replace function private.revoke_shares_on_partner_link_end()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.shares s
  where (s.owner_id = old.client_id and s.shared_with_user_id = old.partner_id)
     or (s.owner_id = old.partner_id and s.shared_with_user_id = old.client_id);
  return null;
end;
$$;

create or replace function private.revoke_shares_on_tc_link_end()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.shares s
  where (s.owner_id = old.client_id and s.shared_with_user_id = old.therapist_id)
     or (s.owner_id = old.therapist_id and s.shared_with_user_id = old.client_id);
  return null;
end;
$$;

revoke all on function private.revoke_shares_on_partner_link_end() from public, anon;
revoke all on function private.revoke_shares_on_tc_link_end() from public, anon;

create trigger partner_link_end_revokes_shares
  after update of status on public.partner_links
  for each row
  when (new.status = 'ended' and old.status is distinct from 'ended')
  execute function private.revoke_shares_on_partner_link_end();

create trigger partner_link_delete_revokes_shares
  after delete on public.partner_links
  for each row
  execute function private.revoke_shares_on_partner_link_end();

create trigger tc_link_end_revokes_shares
  after update of status on public.therapist_client_links
  for each row
  when (new.status = 'ended' and old.status is distinct from 'ended')
  execute function private.revoke_shares_on_tc_link_end();

create trigger tc_link_delete_revokes_shares
  after delete on public.therapist_client_links
  for each row
  execute function private.revoke_shares_on_tc_link_end();
