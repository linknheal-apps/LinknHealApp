# EXPERIMENT PLAN: Resolving Mutation Survivors M7 and M2

## 1. Objectives & Scope
This plan guides the resolution of mutation survivors **M7** and **M2** on branch `test/exp-m7-m2-antigravity`.
Both mutations represent potential equivalent mutants by layered RLS defense in Supabase/PostgreSQL 17.

Per `TASK_M2_M7.md` and user instructions:
- **Hard Rules:** No modifying `supabase/migrations/`; no weakening/deleting existing tests in 01..06; work only on `test/exp-m7-m2-antigravity`; assert observable behavior as real roles; record verbatim CI logs and Actions run URLs; no guessing.
- **Verification of Tools:** `gh` is verified installed at `C:\Program Files\GitHub CLI\gh.exe` and authenticated as `linknheal-apps`.
- **First Push:** Must be a **BASELINE** with no test changes, recording baseline CI results.

---

## 2. Baseline Status
- **Files:** 6 test files (`01_meta.test.sql`, `02_entries_isolation.test.sql`, `03_sharing.test.sql`, `04_links.test.sql`, `05_ownership_and_links.test.sql`, `06_owner_reassign.test.sql`).
- **Expected DB Privacy Tests:** `Files=6, Tests=86, Result: PASS`.
- **Expected Mutations Status:**
  - `M7`: SURVIVED
  - `M2`: SURVIVED
  - `M7b`: KILLED
  - `M2b`: KILLED
  - Other mutations in matrix: KILLED (M1, M3, M4, M5, M6, M8)
- **Baseline Check:** If baseline results differ from expected, STOP, write `BLOCKED.md`, and report.

---

## 3. Order of Experiments & Hypotheses

### Phase 1: Baseline Execution (Attempt 1)
- **Change:** Add `PLAN.md`, `RESEARCH.md`, `M7.md`, `M2.md`. No test or policy changes.
- **Action:** Push to `origin test/exp-m7-m2-antigravity`.
- **CI Triggered:**
  - `DB privacy tests` on branch
  - `RLS Mutation Check` on branch
- **Expected Result:**
  - `DB privacy tests`: PASS (Files=6, Tests=86)
  - `M7`: SURVIVED
  - `M2`: SURVIVED
  - `M7b`: KILLED
  - `M2b`: KILLED
- **Meaning:** Establishes the exact baseline before any experimentation.

---

### Phase 2: Problem M7 Resolution
- **Hypothesis:** M7 (`entries_update_own with check (true)`) is an **EQUIVALENT** mutant because `entries_select_own` (`using (owner_id = (select auth.uid()))`) is enforced by PostgreSQL as a `WithCheckOption` on the `NEW` row of any `UPDATE` that requires `SELECT` access (such as `WHERE id = ...`).
- **Step 2.1 (Verification):**
  - Check whether any behavioral scenario exists where an owner can update `owner_id` or any entry field without triggering Layer 2.
  - Since an update statement targeting an entry requires identifying the row (e.g. `WHERE id = ...`), `SELECT` rights and `entries_select_own` are evaluated on the `NEW` row.
  - If `NEW.owner_id != auth.uid()`, Layer 2 raises SQLSTATE `42501`.
- **Step 2.2 (Complementary Mutation M7c - optional/supporting):**
  - Create `.mutation/M7c.patch`: `entries_select_own using (true)` with `entries_update_own with check (owner_id = auth.uid())` untouched.
  - Expected: SURVIVED (proving Layer 1 alone prevents unauthorized reassign).
  - Note: M7b opened both layers and died; M7 keeps Layer 2 and survives; M7c keeps Layer 1 and survives. Together, M7 + M7c + M7b prove independence and equivalence by layering.
- **Step 2.3 (Documentation):**
  - Document M7 as `EQUIVALENT-DOCUMENTED` in `docs/experiments/M7.md` with CI run URLs, raw logs, and the explicit dependency statement: *"M7 is equivalent while `entries_select_own` (Layer 2) requires `owner_id = auth.uid()`"*.

---

### Phase 3: Problem M2 Resolution
- **Hypothesis:** M2 removes `s.shared_with_user_id = auth.uid()` from the subquery in `entries_select_shared`. Because `public.shares` enforces RLS (`shares_select_parties`: `owner_id = auth.uid() or shared_with_user_id = auth.uid()`), low-privilege callers executing the subquery only see share rows where they are the owner or the recipient.
  - For entry owners: already granted access by `entries_select_own`.
  - For non-owners: only share rows with `shared_with_user_id = auth.uid()` are visible.
  - Therefore, removing `s.shared_with_user_id = auth.uid()` from the subquery does not reveal any additional rows. M2 is an equivalent mutant by layered defense.
- **Step 3.1 (Explore behavioral boundary):**
  - Attempt #0 (commit 7dd1fa3) tested partner reading therapist-shared entry, which survived.
  - Can any user see another user's entry through M2?
    - To see an entry via `entries_select_shared`, two conditions are required:
      1. `private.is_actively_linked_to(entries.owner_id)` must be true.
      2. `exists (select 1 from public.shares s where s.entry_id = entries.id)` must return true.
    - If user X is linked to owner A, and owner A shares entry E with user Y (also linked to A, e.g. therapist):
      - In the database, a row `shares(entry_id=E, owner_id=A, shared_with_user_id=Y)` exists.
      - Can user X see that row in `public.shares`?
      - Under `shares_select_parties`, `owner_id = auth.uid() or shared_with_user_id = auth.uid()`.
      - For user X, `owner_id` is A (not X) and `shared_with_user_id` is Y (not X).
      - So user X sees 0 rows from `public.shares`!
      - Therefore, `exists (...)` evaluates to `false` for user X.
    - Thus, user X CANNOT see entry E.
- **Step 3.2 (Guard Test / Dependency Pinning):**
  - If any gap in regression testing of `shares_select_parties` exists, add a test in `supabase/tests/database/07_shares_visibility.test.sql` to explicitly pin the behavior that third parties (even linked ones) cannot see shares they do not participate in.
  - Test will pass on unmutated code, will pass on M2 (confirming equivalence), and guards the security layer M2 silently relies upon.
- **Step 3.3 (Documentation):**
  - Document M2 as `EQUIVALENT-DOCUMENTED` in `docs/experiments/M2.md` with CI run URLs, raw logs, and the explicit dependency statement: *"M2 is equivalent while `shares_select_parties` restricts `public.shares` visibility to owner and recipient"*.

---

## 4. Definition of Done Checklist
- [ ] Baseline run executed and raw logs captured.
- [ ] M7: Full write-up in `docs/experiments/M7.md` with status `EQUIVALENT-DOCUMENTED`, citing paired evidence (M7 vs M7b / M7c), PostgreSQL 17 mechanism, and explicit layer dependency.
- [ ] M2: Full write-up in `docs/experiments/M2.md` with status `EQUIVALENT-DOCUMENTED`, citing paired evidence (M2 vs M2b), subquery RLS evaluation rules, and explicit layer dependency.
- [ ] Full matrix run on CI with all 10 mutation results recorded.
- [ ] All commits pushed to `test/exp-m7-m2-antigravity`.
