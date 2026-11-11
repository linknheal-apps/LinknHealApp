# Research Notes & Evidence: PostgreSQL RLS and Mutation Testing

## Context & Environment
- **PostgreSQL Major Version:** 17 (configured via `supabase/config.toml` `major_version = 17` and tested in Supabase CLI 2.121.0 in CI).
- **Documentation Cited:** PostgreSQL 17 official documentation (`https://www.postgresql.org/docs/17/`).
- **PostgreSQL Source:** `src/backend/rewrite/rowsecurity.c` on github.com/postgres/postgres.

---

## 1. Problem M7: UPDATE WITH CHECK vs. SELECT USING Layering

### Mechanism & Hypotheses
When an `UPDATE` statement is executed under Row Level Security (RLS):
1. **Existing Rows Check:** The existing row being targeted must satisfy the `USING` clause of the applicable `UPDATE` policy.
2. **New Rows Check (WCO):** The updated row (`NEW`) must satisfy the `WITH CHECK` expression of the `UPDATE` policy.
3. **SELECT Policies Applied as WithCheckOption (WCO):** In addition, if the `UPDATE` requires `SELECT` rights on the relation (e.g. evaluating a `WHERE` clause, a `RETURNING` clause, or referencing columns), PostgreSQL applies `SELECT` policies' `USING` clauses as `WithCheckOption` (`WCO_RLS_UPDATE_CHECK`) on the resulting `NEW` row.
4. **Consequence for M7:**
   - In Link & Heal, `entries_update_own` has `using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))`.
   - `entries_select_own` has `using (owner_id = (select auth.uid()))`.
   - Mutation M7 replaces `with check (owner_id = (select auth.uid()))` with `with check (true)`.
   - When user A runs `UPDATE entries SET owner_id = B WHERE id = ...`:
     - Layer 1 (`entries_update_own with check`): Evaluates to `true` under M7.
     - Layer 2 (`entries_select_own using` applied to `NEW` row via WCO): Evaluates `NEW.owner_id = (select auth.uid())`, which is `B = A` (`false`).
     - PostgreSQL raises `ERROR: new row violates row-level security policy for table "entries"` (SQLSTATE `42501`).
   - Hence, even with `with check (true)`, the reassignment is blocked by Layer 2 (`entries_select_own`). M7 is an equivalent mutant by layered defense.

### Evidence & Citations

1. **PostgreSQL 17 Documentation – Row Security Policies (`ddl-rowsecurity.html`):**
   - **URL:** https://www.postgresql.org/docs/17/ddl-rowsecurity.html
   - **Excerpt [UNVERIFIED by direct curl, retrieved via web search summary]:** *"Typically an UPDATE command also needs to read data from columns in the relation being updated (e.g., in a WHERE clause or a RETURNING clause, or in an expression on the right hand side of the SET clause). In this case, SELECT rights are also required on the relation being updated, and the appropriate SELECT or ALL policies will be applied in addition to the UPDATE policies."*

2. **PostgreSQL 17 Documentation – CREATE POLICY (`sql-createpolicy.html`):**
   - **URL:** https://www.postgresql.org/docs/17/sql-createpolicy.html
   - **Excerpt [UNVERIFIED by direct curl, retrieved via web search summary]:** *"WITH CHECK: The new row will be checked against the policy if it is an INSERT, UPDATE, or MERGE command. If the expression returns true or null, the row will be allowed, whereas if false is returned, an error is raised."*

3. **PostgreSQL Source Code – `src/backend/rewrite/rowsecurity.c`:**
   - **URL:** https://github.com/postgres/postgres/blob/master/src/backend/rewrite/rowsecurity.c
   - **Excerpt [UNVERIFIED by direct curl, retrieved via web search summary]:** *"Get and add ALL/SELECT policies, if SELECT rights are required for this relation (eg: when RETURNING is used). These are added as WCO policies rather than security quals to ensure that an error is raised if a policy is violated; otherwise, we might end up silently dropping rows to be added."*

---

## 2. Problem M2: RLS Interaction on Subquery Tables (`shares`)

### Mechanism & Hypotheses
In PostgreSQL, RLS policies on a table evaluated during a subquery apply under the security context of the executing role:
1. `entries_select_shared` defines:
   ```sql
   using (
     private.is_actively_linked_to(entries.owner_id)
     and exists (
       select 1 from public.shares s
       where s.entry_id = entries.id
         and s.shared_with_user_id = (select auth.uid())
     )
   );
   ```
2. Mutation M2 removes `and s.shared_with_user_id = (select auth.uid())` from the subquery, leaving:
   ```sql
   using (
     private.is_actively_linked_to(entries.owner_id)
     and exists (
       select 1 from public.shares s
       where s.entry_id = entries.id
     )
   );
   ```
3. However, `public.shares` has RLS enabled with `shares_select_parties`:
   ```sql
   using (owner_id = (select auth.uid()) or shared_with_user_id = (select auth.uid()));
   ```
4. When a low-privilege user queries `public.entries`, the subquery `select 1 from public.shares s where s.entry_id = entries.id` is subject to RLS on `public.shares`.
5. Therefore, `s` in the subquery only sees rows where `s.owner_id = auth.uid()` or `s.shared_with_user_id = auth.uid()`.
   - By table constraints and `share_entry()`, `shares(entry_id, owner_id) REFERENCES entries(id, owner_id)`.
   - If the caller is the owner (`s.owner_id = auth.uid()`), they already have access via `entries_select_own`.
   - If the caller is not the owner, they can only see rows in `public.shares` where `s.shared_with_user_id = auth.uid()`.
   - Thus, `exists (select 1 from public.shares s where s.entry_id = entries.id)` resolves only to true if a share row visible to the user exists, which requires `s.shared_with_user_id = auth.uid()`.
   - Removing the explicit predicate in M2 leaves the exact same semantics as long as `shares_select_parties` is enforced. M2 is an equivalent mutant by layered defense.

### Evidence & Citations

1. **PostgreSQL 17 Documentation – Row Security Policies (`ddl-rowsecurity.html`):**
   - **URL:** https://www.postgresql.org/docs/17/ddl-rowsecurity.html
   - **Excerpt [UNVERIFIED by direct curl, retrieved via web search summary]:** *"If it is necessary to consult other rows or other tables to make a policy decision, that can be accomplished using sub-SELECTs, or functions that contain SELECTs, in the policy expressions."*

---

## 3. Mutation Testing Literature: Equivalent Mutants

### Definition & Properties
- An **equivalent mutant** is a syntactically modified program variant that produces identical observable behavior to the original program under all valid inputs and environments.
- Formally, mutant $M$ of program $P$ is equivalent ($M \equiv P$) iff $\forall i \in \text{Inputs}: M(i) = P(i)$.
- Equivalent mutants cannot be killed by any behavioral test case because no test input can produce a differing output.

### Literature Citations
1. **Jia, Y. and Harman, M. (2011). "An Analysis and Survey of the Development of Mutation Testing." IEEE Transactions on Software Engineering, 37(5), 649-678:**
   - **URL:** https://doi.org/10.1109/TSE.2010.62
   - **Excerpt [UNVERIFIED by direct curl, retrieved via web search summary]:** *"A mutant is called an equivalent mutant if it always produces the same output as the original program for all possible test cases; detection of equivalent mutants is in general undecidable."*

2. **Madeyski, L., Orzeszyna, N., Torkar, R., and Jozala, M. (2014). "Overcoming the Equivalent Mutant Problem: A Systematic Literature Review." IEEE Transactions on Software Engineering, 40(1), 23-42:**
   - **URL:** https://doi.org/10.1109/TSE.2013.44
   - **Excerpt [UNVERIFIED by direct curl, retrieved via web search summary]:** *"The Equivalent Mutant Problem (EMP) is one of the most critical barriers preventing mutation testing from being widely used in practice because equivalent mutants cannot be detected by any test case."*
