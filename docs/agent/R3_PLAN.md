# Implementation Plan: Rule R3 (Therapist Has No Direct SELECT on Client Data)

> **Document Classification:** DOCUMENTATION ONLY.  
> **Status:** Reviewable Proposal (Prepared for Ahmed).  
> **Rule Ref:** `docs/spec-addendum-001-d4-api-layer.md` (Rules R2, R3, R4, R9).  
> **Note:** All SQL blocks in this document are **DRAFT - NOT FOR EXECUTION**. No implementation or file modifications under `supabase/` have been made.

---

## 1. Current Behavior

### 1.1 Verbatim Policy & Helper Definitions

From `supabase/migrations/20261015100100_phase0_rls.sql`:

Lines 5–23 (`private.is_actively_linked_to`):
```sql
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
```

Lines 67–76 (`entries_select_shared`):
```sql
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
```

### 1.2 How the Therapist Read Branch Arises (5 lines max)
The policy `entries_select_shared` gates shared read access on `private.is_actively_linked_to(entries.owner_id)` plus a matching row in `public.shares`. Because `private.is_actively_linked_to` evaluates an `OR` between `public.partner_links` and `public.therapist_client_links`, any therapist possessing an active client link and a corresponding `shares` row is granted direct `SELECT` on `public.entries`.

---

## 2. Design Options

We evaluate approaches to satisfy R3 (closing direct therapist `SELECT` on client entries) while preserving direct partner reads.

### Option (a): New Partner-Only Helper Used by the Policy

Introduce a dedicated private helper function `private.is_actively_partner_linked_to(p_other uuid)` that queries only `public.partner_links`, and update `entries_select_shared` to invoke this new helper. Keep `private.is_actively_linked_to` for `public.share_entry()`.

#### Draft SQL (DRAFT - NOT FOR EXECUTION)
```sql
-- DRAFT - NOT FOR EXECUTION
create or replace function private.is_actively_partner_linked_to(p_other uuid)
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
  );
$$;

revoke all on function private.is_actively_partner_linked_to(uuid) from public, anon;
grant execute on function private.is_actively_partner_linked_to(uuid) to authenticated;

drop policy if exists entries_select_shared on public.entries;
create policy entries_select_shared on public.entries
  for select to authenticated
  using (
    private.is_actively_partner_linked_to(entries.owner_id)
    and exists (
      select 1 from public.shares s
      where s.entry_id = entries.id
        and s.shared_with_user_id = (select auth.uid())
    )
  );
```

#### Edge Cases & How It Fails
- **Clean separation:** Access control is strictly decoupled by relationship table. A therapist with an active `therapist_client_links` record will fail `private.is_actively_partner_linked_to` unconditionally.
- **Dual-role user edge case:** If user X is both a partner in `partner_links` and a therapist in `therapist_client_links` with client Y:
  - Schema check: In `supabase/migrations/20261015100000_phase0_schema.sql`, lines 13–20 (`partner_links`) and lines 27–35 (`therapist_client_links`) do not prohibit a user UUID from appearing in both tables.
  - If a user is registered as a partner in `partner_links` with client Y, they can read entries shared with them in their capacity as a partner. If they only have a `therapist_client_links` record with client Y, they cannot read entries directly.
- **Allowlist impact:** Adding a function to `private` requires updating the privilege catalog test allowlist (`09_function_privileges.test.sql`).

#### What Stays Unchanged
- `private.is_actively_linked_to(uuid)` remains untouched and still validates active links across both partner and therapist links.
- `public.share_entry(uuid, uuid)` remains untouched; owners can still share entries with therapists and partners alike.
- Triggers `private.revoke_shares_on_partner_link_end()` and `private.revoke_shares_on_tc_link_end()` remain untouched.

---

### Option (b): Inline Role / Table Check Against `public.users.role` Inside the Policy

Modify `entries_select_shared` to check that the reader has `role = 'client'` in `public.users`, or inline the partner-only check directly.

#### Draft SQL (DRAFT - NOT FOR EXECUTION)
```sql
-- DRAFT - NOT FOR EXECUTION
drop policy if exists entries_select_shared on public.entries;
create policy entries_select_shared on public.entries
  for select to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
        and u.role = 'client'
    )
    and private.is_actively_linked_to(entries.owner_id)
    and exists (
      select 1 from public.shares s
      where s.entry_id = entries.id
        and s.shared_with_user_id = (select auth.uid())
    )
  );
```

#### Edge Cases & How It Fails
- **Table Recursion / RLS:** Subquerying `public.users` inside an RLS policy on `public.entries` evaluates against `public.users` RLS (`users_select_self`: `id = auth.uid()`). While allowed, it introduces an extra table lookup per row check unless wrapped in a `security definer` function.
- **Role immutability / Semantic coupling:** Relies on the user's coarse account-level role (`public.users.role in ('client', 'therapist')`) rather than the relationship type. If a clinician acts as a peer client in a support group or partner relationship, their coarse account role would block them from reading partner-shared entries.
- **Edge cases from schema constraints:**
  - In `supabase/migrations/20261015100000_phase0_schema.sql`:
    - Line 9: `role text not null check (role in ('client', 'therapist'))`
    - Lines 13–20: `partner_links` references `public.users(id)` for both `client_id` and `partner_id` with NO check constraint enforcing that `partner_id` has `role = 'client'`.
    - Lines 27–35: `therapist_client_links` references `public.users(id)` for `therapist_id` and `client_id` with NO check constraint enforcing `therapist_id` has `role = 'therapist'`.
    Consequently, role-based checks inside policies can produce unexpected denials or leaks if role values ever desynchronize from link semantics.

#### What Stays Unchanged
- No new functions in schema `private`, so `09_function_privileges.test.sql` catalog test allowlist remains unchanged.
- `public.share_entry` remains unchanged.

---

### Option (c): Inline `partner_links` Check Directly in Policy Without New Function

Instead of creating a new `security definer` function in `private`, inline the active `partner_links` check directly into the `entries_select_shared` policy expression.

#### Draft SQL (DRAFT - NOT FOR EXECUTION)
```sql
-- DRAFT - NOT FOR EXECUTION
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
```

#### Edge Cases & How It Fails
- **Subquery RLS interaction:** In PostgreSQL, subqueries in RLS policies execute under the invoking user's permissions. Table `public.partner_links` has RLS enabled and policy `partner_links_select_parties` (`client_id = auth.uid() or partner_id = auth.uid()`). The subquery satisfies this policy cleanly because it filters on `(client_id = auth.uid() or partner_id = auth.uid())`.
- **Zero Catalog Expansion:** Does not create any new function in `private` or `public`. The function privilege catalog test (`09_function_privileges.test.sql`) requires zero allowlist modifications.
- **Clean Relational Semantics:** Partner access depends strictly on `partner_links`, ignoring `therapist_client_links` completely.
- **Performance considerations:** In PostgreSQL, inlining the subquery allows the query planner to optimize the join between `entries`, `partner_links`, and `shares` using available indexes (`partner_links_client_idx`, `partner_links_partner_idx`, `partner_links_pair_uniq`, `shares_shared_with_idx`).

#### What Stays Unchanged
- `private.is_actively_linked_to(uuid)` remains untouched for `share_entry` and other caller verifications.
- Function allowlists in `09_function_privileges.test.sql` remain untouched.
- `public.share_entry` and link-end triggers remain untouched.

---

### Schema Constraints Analysis

From `supabase/migrations/20261015100000_phase0_schema.sql`:

1. **Role Constraint (Line 9):**
   ```sql
   role text not null check (role in ('client', 'therapist')),
   ```
2. **Partner Links Constraints (Lines 13–23):**
   ```sql
   create table public.partner_links (
     id uuid primary key default gen_random_uuid(),
     client_id uuid not null references public.users (id) on delete cascade,
     partner_id uuid not null references public.users (id) on delete cascade,
     status text not null check (status in ('pending', 'active', 'ended')),
     created_at timestamptz not null default now(),
     check (client_id <> partner_id)
   );
   create unique index partner_links_pair_uniq
     on public.partner_links (least(client_id, partner_id), greatest(client_id, partner_id));
   ```
   *Note:* The schema enforces `client_id <> partner_id` and unique unordered pairs, but does not enforce that either user has `role = 'client'`.
3. **Therapist-Client Links Constraints (Lines 27–35):**
   ```sql
   create table public.therapist_client_links (
     id uuid primary key default gen_random_uuid(),
     therapist_id uuid not null references public.users (id) on delete cascade,
     client_id uuid not null references public.users (id) on delete cascade,
     status text not null check (status in ('pending', 'active', 'ended')),
     created_at timestamptz not null default now(),
     check (therapist_id <> client_id),
     unique (therapist_id, client_id)
   );
   ```
   *Note:* The schema enforces `therapist_id <> client_id` and unique `(therapist_id, client_id)`, but does not enforce that `therapist_id` has `role = 'therapist'`.
4. **Can one user be both therapist and partner?**
   Yes. No cross-table constraint prevents user X from existing in `therapist_client_links` with user A and simultaneously in `partner_links` with user B (or even user A).
   Therefore, gating entry reads by `partner_links` (Options a and c) is strictly superior to checking `public.users.role = 'client'` (Option b).

---

## 3. Side Effects Analysis

### 3.1 `public.share_entry()` Allows Therapist Recipient (Consent Row for R2 RPC)
- **Current implementation:** `supabase/migrations/20261015100100_phase0_rls.sql` lines 100–124:
  ```sql
  create or replace function public.share_entry(p_entry_id uuid, p_recipient_id uuid)
  ...
  if v_me is null
     or p_entry_id is null
     or p_recipient_id is null
     or p_recipient_id = v_me
     or not exists (select 1 from public.entries e where e.id = p_entry_id and e.owner_id = v_me)
     or not private.is_actively_linked_to(p_recipient_id)
  then
    raise exception 'share_not_allowed' using errcode = 'P0001';
  end if;
  ```
- **Finding:** Because `public.share_entry` calls `private.is_actively_linked_to(p_recipient_id)`, and `is_actively_linked_to` checks both `partner_links` and `therapist_client_links`, an entry owner CAN share an entry with their linked therapist. The resulting row in `public.shares` is created and acts as the explicit consent grant that future audited RPCs (R2) will check. None of Options (a), (b), or (c) break this.

### 3.2 Triggers Revoking Shares on Link End are Unaffected
- **Current implementation:** `supabase/migrations/20261015100100_phase0_rls.sql` lines 130–181:
  - `private.revoke_shares_on_partner_link_end()` (lines 130–142) triggered by `partner_link_end_revokes_shares` and `partner_link_delete_revokes_shares`.
  - `private.revoke_shares_on_tc_link_end()` (lines 144–156) triggered by `tc_link_end_revokes_shares` and `tc_link_delete_revokes_shares`.
- **Finding:** These triggers delete rows from `public.shares` based on `(client_id, partner_id)` and `(client_id, therapist_id)`. None of the proposed options touch these triggers or their underlying functions.

### 3.3 Function Privilege Catalog Test Allowlists (`09_function_privileges.test.sql`)
- **Current allowlists:**
  - Lines 62–85 (`private` schema allowlist):
    ```sql
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
    ```
  - Lines 108–132 (`public` schema allowlist):
    ```sql
    select set_eq(
      ...
      $$
        select unnest(array[
          'share_entry(uuid, uuid)'
        ]::text[])
      $$,
      'schema public: authenticated may execute ONLY functions in allowlist'
    );
    ```
- **Finding:**
  - If **Option (a)** is chosen: Adding `private.is_actively_partner_linked_to(uuid)` REQUIRES adding `'private.is_actively_partner_linked_to(uuid)'` to the array at lines 80–82 in `09_function_privileges.test.sql`. Otherwise test assertion a2 FAILS.
  - If **Option (b)** or **Option (c)** is chosen: No new function is introduced; `09_function_privileges.test.sql` requires **no changes**.

### 3.4 Policies `shares_select_parties` and `users_select_self`
- `shares_select_parties` (`supabase/migrations/20261015100100_phase0_rls.sql` lines 91–93):
  ```sql
  create policy shares_select_parties on public.shares
    for select to authenticated
    using (owner_id = (select auth.uid()) or shared_with_user_id = (select auth.uid()));
  ```
  - Report: R3 specifies "For every table holding client data, a therapist has no direct SELECT." Table `public.shares` is metadata/consent tracking, not clinical entry data. In `10_r3_therapist_no_direct_read.test.sql` line 49, control test 6 asserts: `the therapist share row exists and is visible to the recipient`. Touching `shares_select_parties` would break this assertion. R3 does NOT require touching `shares_select_parties`.
- `users_select_self` (`supabase/migrations/20261015100100_phase0_rls.sql` lines 50–52):
  ```sql
  create policy users_select_self on public.users
    for select to authenticated
    using (id = (select auth.uid()));
  ```
  - Report: `users_select_self` restricts users to viewing only their own record in `public.users`. R3 does NOT require touching `users_select_self`.

---

## 4. Existing Tests Impact (Files 01..09)

Every assertion in test files `01` through `09` was checked for dependence on a therapist reading entries directly or on `is_actively_linked_to` semantics:

### 4.1 File: `supabase/tests/database/03_sharing.test.sql`
- **Line 84:**
  ```sql
  select is((select count(*)::int from public.entries where id = 'e2000000-0000-0000-0000-000000000002'), 1, 'therapist reads the entry shared with them');
  ```
  - **Impact:** Asserts that therapist Carol (`c0000000-0000-0000-0000-000000000003`) directly reads entry `e2...` shared with her.
  - **Required update:** Under R3, a therapist must NOT have direct `SELECT`. This test must be updated to expect `0` (or replaced with the R3 assertion that therapist direct read returns 0), with the description updated from `'therapist reads the entry shared with them'` to `'therapist has no direct read on the entry shared with them (R3)'`.
- **Line 85:**
  ```sql
  select is((select count(*)::int from public.entries where id = 'e1000000-0000-0000-0000-000000000001'), 0, 'therapist cannot read the entry not shared with them');
  ```
  - **Impact:** Asserts therapist cannot read an unshared entry. Remains 0 under R3, but passes vacuously once all direct reads return 0. Kept or merged into R3 suite.

### 4.2 File: `supabase/tests/database/04_links.test.sql`
- **Line 83:**
  ```sql
  select is((select count(*)::int from public.entries where id = 'e1000000-0000-0000-0000-000000000001'), 0, 'therapist cannot read after the link ended');
  ```
  - **Impact:** Asserts therapist cannot read the entry after the link was ended. Under R3, the therapist cannot read the entry even when the link is active. The assertion still evaluates to 0, so it passes, but it tests link revocation for a role that no longer has direct read.

### 4.3 Other Files Checked (`01`, `02`, `05`, `06`, `07`, `08`, `09`)
- `01_meta.test.sql`: Lines 58–59 test `anon cannot execute the link helper`. No therapist entry read tested.
- `02_entries_isolation.test.sql`: Line 51 tests `therapist cannot read any unshared entry although linked`. Expected count is 0. Unaffected (passes).
- `05_ownership_and_links.test.sql`: Lines 71–74 test relationship disclosure to strangers. Unaffected.
- `06_owner_reassign.test.sql`: Tests owner reassign prevention. Unaffected.
- `07_shares_visibility.test.sql`: Line 90 tests non-recipient therapist seeing 0 share rows. Unaffected.
- `08_audit_events.test.sql`: Tests audit event hash chain. Unaffected.
- `09_function_privileges.test.sql`: Tests catalog privileges. Affected ONLY IF Option (a) adds a new function to schema `private`.

---

## 5. Mutation Plan (R4)

Per Constitution Principle III and Addendum Rule R4: "Tests first... each policy/grant/function check that was changed has a mutation that makes a test fail."

| Object Touched / Mutated | Current Definition | Target Replacement | Test Turning Red When Mutated | Status / Mutation Analysis |
|---|---|---|---|---|
| Policy `entries_select_shared` on `public.entries` | Uses `private.is_actively_linked_to(entries.owner_id)` | (Option c) Uses `partner_links` check directly; or (Option a) Uses `private.is_actively_partner_linked_to` | `10_r3_therapist_no_direct_read.test.sql` assertions 8 & 9 | **Covered.** Mutation reverting to `is_actively_linked_to` turns assertions 8 & 9 in file 10 red (returns 1 instead of 0). |
| Helper `private.is_actively_partner_linked_to` (if Option a) | New function in schema `private` | Not present or unrevoked | `09_function_privileges.test.sql` assertion a2 | **Covered.** If added without allowlist, 09 turns red. If execute not granted, partner reads turn red in `10_r3` assertion 10. |
| Function grant to `authenticated` (if Option a) | `grant execute on function private.is_actively_partner_linked_to(uuid) to authenticated;` | Omitted / Revoked | `10_r3_therapist_no_direct_read.test.sql` assertion 10 | **Covered.** Partner cannot evaluate policy; permission denied or 0 rows returned. |
| Negative guard: Therapist Direct Read | Therapist reads entry shared via `shares` | Return 0 rows | `03_sharing.test.sql` line 84 | **Covered.** Existing test in `03_sharing.test.sql` line 84 turns red until updated to match R3. |
| Policy `entries_select_own` on `public.entries` | `using (owner_id = (select auth.uid()))` | Unchanged | `02_entries_isolation.test.sql` T1, `10_r3` assertion 4 | Regression safety guard. |
| Policy `shares_select_parties` on `public.shares` | `using (owner_id = auth.uid() or shared_with_user_id = auth.uid())` | Unchanged | `10_r3_therapist_no_direct_read.test.sql` assertion 6 | Regression safety guard. |

*Coverage Gap Check:* There is **NO COVERAGE GAP** for the R3 therapist read cutoff. File `10_r3_therapist_no_direct_read.test.sql` explicitly asserts:
- Assertion 8: `therapist has no direct SELECT on a shared entry` (expects 0)
- Assertion 9: `therapist sees zero entries in a raw query` (expects 0)
- Assertion 10: `partner still reads the entry shared with them` (expects 1)

---

## 6. Open Decisions for Ahmed

Numbered list with recommended default and risk analysis:

1. **Architecture Option Selection: Option (c) (Inlined `partner_links` check in policy) vs Option (a) (New `private.is_actively_partner_linked_to` helper)**
   - *Recommended Default:* **Option (c)**.
   - *Rationale:* Option (c) modifies only the policy `entries_select_shared`. It introduces zero new functions, avoids polluting schema `private`, requires no allowlist edits in `09_function_privileges.test.sql`, and accurately reflects that direct sharing in Release 1 is strictly a partner capability.
   - *Risk:* Option (c) inlines the table query into RLS. Because `public.partner_links` already has indexes on `(client_id)` and `(partner_id)`, query planning is optimal. Option (a) has the risk of function overhead and catalog allowlist maintenance.

2. **Handling Existing Test `03_sharing.test.sql:84`**
   - *Recommended Default:* Update `03_sharing.test.sql:84` in the implementation migration to assert `count = 0` (therapist has no direct read under R3), or remove therapist direct read from `03_sharing` since it is comprehensively covered in `10_r3_therapist_no_direct_read.test.sql`.
   - *Risk:* Updating it maintains full regression coverage in the core sharing test suite; leaving it unchanged will block CI once R3 is applied.

3. **Multi-Role User Policy Behavior**
   - *Recommended Default:* Rely on relationship-table membership (`partner_links` vs `therapist_client_links`), NOT `public.users.role`.
   - *Rationale:* Clean relational model. A user acting as a partner can read what is shared via `partner_links`; a therapist acting as a clinician cannot read directly regardless of account role.
   - *Risk:* Negligible. Aligns directly with database normalization principles.

---

## 7. Rollback Plan

If the R3 policy change needs to be rolled back after application:

1. **Order of Reversion:**
   - Step 1: Revert `entries_select_shared` policy on `public.entries` to use `private.is_actively_linked_to(entries.owner_id)` (restoring the previous shared read behavior).
   - Step 2 (if Option a was used): Drop function `private.is_actively_partner_linked_to(uuid)`.
   - Step 3: Revert test assertion updates in `supabase/tests/database/03_sharing.test.sql` line 84.
   - Step 4: Run `supabase test db` to verify all 10 test suites pass.
2. **Git Branch Cleanup (for Ahmed):**
   ```bash
   git checkout main
   git branch -D agent/r3-plan
   ```

---

## 8. Agent Decisions

1. Selected Option (c) as the primary recommended default because it avoids expanding the `SECURITY DEFINER` function footprint in schema `private` and requires no edits to `09_function_privileges.test.sql`.
2. Documented Option (a) as the secondary alternative if Ahmed prefers functional encapsulation in schema `private`.
3. Kept all SQL code labeled strictly as "DRAFT - NOT FOR EXECUTION" without creating any migration file under `supabase/migrations/`.
4. Left `03_sharing.test.sql` and all existing database test files untouched in the workspace.
5. Confirmed that no sensitive or clinical data, API keys, or forbidden files were touched.
