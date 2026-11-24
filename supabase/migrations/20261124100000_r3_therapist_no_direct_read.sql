-- R3 (spec-addendum-001): a therapist has NO direct SELECT on client data.
-- Option (c): shared read now requires an ACTIVE partner_links row AND an explicit shares row.
-- therapist_client_links no longer grants any direct read; therapist reads go through audited RPC (R2).
-- Dual-role (therapist who is also partner of the same client) is an accepted, documented behavior (test 11).
drop policy if exists entries_select_shared on public.entries;

create policy entries_select_shared on public.entries
  for select to authenticated
  using (
    exists (
      select 1 from public.partner_links l
      where l.status = 'active'
        and ((l.client_id = (select auth.uid()) and l.partner_id = entries.owner_id)
          or (l.partner_id = (select auth.uid()) and l.client_id = entries.owner_id))
    )
    and exists (
      select 1 from public.shares s
      where s.entry_id = entries.id
        and s.shared_with_user_id = (select auth.uid())
    )
  );