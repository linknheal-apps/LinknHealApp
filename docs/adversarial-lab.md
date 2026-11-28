# Link & Heal: Adversarial Test Lab (Reference)

| | |
|---|---|
| **Status** | DRAFT v0.2, proposals only. Nothing here is tested or approved yet. v0.2 folds in Round 1 (6 AIs) and Round 2 (5 AIs); see `round2-decisions.md`. |
| **Date** | 2026-11-26 (v0.1: 2026-11-25) |
| **Owner** | Ahmed (decisions) · Gemini implements · Claude verifies · ChatGPT reviews |
| **Precedence** | Lower than `constitution.md` and `spec.md`/`plan.md`/`tasks.md`. If this file conflicts with them, they win and this file gets fixed. |
| **Extends** | The 17-test base matrix in `lh-adversarial-testing` (T010 to T018). The base tests stay exactly as they are. |
| **Where to keep it** | `docs/adversarial-lab.md` in the repo |

---

## 0. الملخص (عربي)

- الملف ده **مرجع** للـ lab اللي بنكسر بيه الـ privacy: cast ثابت من accounts (A لـ Z) فيهم معالجين وعملاء ومهاجمين، وكل واحد حالته معروفة من الأول.
- بيغطي: single، couple، breakup، new relationship، تغيير معالج، سحب الموافقة، هجمات المعالج، هجمات العميل/الشريك، token مسروق، flood من accounts كتير، audit، notifications، وفحوصات الموبايل (screenshot).
- **قرار breakup:** المعالج بس هو اللي ينهي الـ link. العميل يبعت طلب جوه التطبيق، والشريك التاني مايشوفوش. الوصول يتقفل فوراً في نفس الـ transaction، والمعالج يحدد مصير الداتا المشتركة في نفس لحظة التنفيذ.
- **الـ screenshot:** بنعتبره طبقة ردع مش حماية. Android بيمنعه فعلاً، iOS لأ. الحماية الحقيقية هي الـ `RLS`.
- **الـ roadmap:** بيتولد من `app-map` والحالة بتيجي من نتائج CI مش من كلام الـ agent (القسم 10).
- في **قرارات مفتوحة** (القسم 3) لازم تتحسم قبل ما الـ tests المتعلقة بيها تتكتب. أهمها: يعني إيه "الداتا القديمة" بالظبط (N1).

---

## 1. How to use this file

1. Every privacy PR lists the test IDs it touches (e.g. `BR-01`, `TH-06`). IDs are stable and never renumbered; a retired test is marked `RETIRED`, not deleted.
2. Adding any table that holds client data means adding rows here **first** (tests before policies, constitution Principle III).
3. Status (planned / built / verified) does **not** live in this file. It is derived from CI evidence (section 10). This file only says what must be true.
4. A row tagged `[N#]` depends on an open decision (section 3). It stays blocked until the owner decides. Agents must not guess the answer.
5. Phase column: **P0** = can be written against the Phase 0 schema (`users`, `partner_links`, `therapist_client_links`, `entries`, `shares`). **P1** = needs tables that do not exist yet (breakup requests, couple-scoped data, therapist notes, files, audit, invites).
6. Per `lh-router`: High-tier work (RLS, migrations, auth, sharing, audit) is never run autonomously by an agent. Everything here is High-tier.

---

## 2. Decisions already made (session of 2026-11-25)

| # | Decision |
|---|---|
| M1 | **Breakup is a therapist-only action.** Client and partner cannot end, update or delete a `partner_links` row. A breakup done by mistake or without telling the partner must be impossible. |
| M2 | The therapist decides what happens to the old data **at the moment of the breakup**, in the same action. There is no "waiting for a decision" state. |
| M3 | Access closes **immediately** at breakup, in the same transaction. |
| M4 | The other partner is **not told** that the therapist decides, and does not see the request. The partner is expected to contact the therapist. |
| M5 | A client who wants to end the relationship sends an **in-app request** to the therapist. The notification text is generic. |
| M6 | The client wants to **prevent patient screenshots**. Agreed to treat it as deterrence, not a security boundary (section 6.10). |
| M7 | The roadmap should **update automatically from the app map** (section 10). |

---

## 3. Open decisions this file depends on

These extend the register in `lh-router` (D1 to D10). Owners are proposals.

| # | Decision | Why it matters here | Owner |
|---|---|---|---|
| N1 | **What exactly is "old data"?** Proposal: couple-scoped data (joint exercises, relationship check-ins, couple assessments, gap view) plus the share grants between the two. **Individual entries always stay with their owner and are never deleted by a breakup.** | Changes every expected result in section 7. In Phase 0 only shares exist, so all three dispositions look identical until couple-scoped tables exist. | Client (clinical) |
| N2 | **Disposition options:** `DELETE` (rows physically gone), `SEAL` (kept, no app role can read), `THERAPIST_ONLY` (kept, only the linked therapist reads). The third is a proposal. Retention periods are a legal answer. | Agents must not author retention periods. | Client + lawyer (D7, D9) |
| N3 | **Who creates a `partner_links` row?** Therapist-only, or mutual acceptance by both partners. | Closes the "forged link" attack (CL-05). | Ahmed + client |
| N4 | **Safety valve for abusive relationships** when the therapist is unreachable. Existing behavior (owner can always revoke their own shares) stays. Is anything more needed (urgent flag, crisis-resources screen)? | M1 could trap someone. Clinical, ties to D6. | Client |
| N5 | **What the partner sees after a breakup** (copy). Must be generic and reviewed. | Agents must not write it (`[PENDING CLINICAL REVIEW]`). | Client clinical lead |
| N6 | **What happens to shares when a therapist link ends** (deleted, or dormant and blocked by the link check)? Default proposal: no access, shares deleted so a re-link cannot resurrect them. Therapist's own notes: retention rules. | SC-07, TH-05. | Ahmed + client + lawyer |
| N7 | **Consent withdrawal and therapist access.** The partner part is already specified (immediate revoke). The therapist part is not. | SC-08. | Client + lawyer |
| N8 | **iOS screenshot detection:** log it, show a notice, or do nothing? Store and UI copy must never promise "screenshots are blocked". | MB-06. | Client |
| N9 | **Session lifetime.** A JWT stays valid until it expires even after sign-out. What TTL is acceptable? (Supabase default is 1 hour; verify in project settings.) | SEC-03. | Ahmed |
| N10 | **Breakup-request limits:** how many open requests per couple, cancel allowed, notification dedupe. | BR-15, FL-04. | Ahmed + client |

Related existing decisions that still apply: **D1** (does the therapist see unshared entries? This file follows the Phase 0 spec: **no**), **D4** (reads need an audited code path), **D6** (crisis flow), **D9** (deletion vs retention).

---

### 3b. Client questions, split (Round 2)

Bundled questions come back half-answered, so each decision owner gets its own line.

| Q | Question | Blocks |
|---|---|---|
| Q-01 | What is couple-scoped "old data"? Which tables/files, which retention period per disposition, are backups/exports/derived rows in scope? Does `SEAL` stay? (Recommendation only: drop it unless a named unsealer, approvals and expiry exist.) | N1, N2, D9 |
| Q-02 | Does the therapist ever read an entry the client did not share (D1)? Is there a break-glass? (If yes it must be an audited share row, never an `OR` in a policy.) | D1 |
| Q-03 | Does a link count as consent for a derived cross-partner comparison (gap view)? | gap view |
| Q-04 | What can a client do alone when the therapist is unreachable, at 24 h, 72 h, never? | N4, D6 |
| Q-05 | Who creates a partner link? | N3 |
| Q-06 | Exact partner-facing copy after a breakup. | N5 |
| Q-07 | Residual access, two numbers: stolen phone, and revoked partner. (Check the platform's minimum JWT TTL first.) | N9, M3 exceptions |
| Q-08 | Therapist link end and consent withdrawal: effect on past shares and on the therapist's own notes. | N6, N7 |
| Q-09 | iOS screenshot detection: log, notify, nothing. | N8 |
| Q-10 | Abuse limits, notification channels, therapist verification, who reads the audit log. | N10, D4 |
| Q-11 | Jurisdictions, hosting region, subprocessors (push, crash, analytics), 18+ only? Counsel answers; engineers do not assert law. | D9 |

---

## 4. Global rules (non-negotiable)

| # | Rule |
|---|---|
| G1 | Run as `authenticated` or `anon`, never `postgres`/`service_role`. Prove the acting identity with `tests.authenticate(uuid)` (sets role and JWT claims together) followed by `is(auth.uid(), <uuid>)` and `is(current_user,'authenticated')` after every switch. `current_user` alone proves nothing inside a `SECURITY DEFINER` function. **Exception:** the separate privileged suite `tests/privileged/` (physical row counts, audit tamper). It is not counted as an app-role privacy test and refuses to run unless the DB has host allowlist + `lab_synthetic` marker + seed nonce. |
| G2 | **Every negative test has a positive control** in the same test: first assert the authorized actor CAN read/do it, then assert the attacker cannot. A negative alone also passes when the seed failed. |
| G3 | **No response may vary with the existence of a row the caller cannot see** (the twin rule): same status, SQLSTATE, message, detail, hint, body shape and headers for a real foreign ID and a dead ID, after ID normalization. "Zero rows" is the default implementation for reads, not an axiom. Writes, FK, unique and upsert paths are tested as separate channels. |
| G4 | **Mutation check** for every policy and RPC: loosen it on purpose (`using (true)`, drop `with check`, drop the active-link clause) and confirm at least one test turns red. |
| G5 | `plan(N)` must equal the real assertion count. A file with 0 assertions fails. |
| G6 | Three access paths: raw SQL as the role, API with a **real JWT** and crafted/guessed IDs, and UI later. |
| G7 | Synthetic data only. Deterministic cast (section 5). No real person's data anywhere, including AI prompts. |
| G8 | pgTAP files run inside `begin; ... rollback;`. pgTAP cannot test concurrency, so FL tests are scripts with multiple connections that reseed and clean up explicitly. |
| G9 | Test IDs are stable (see section 1). |
| G10 | Tests never decide clinical or legal policy. A row marked `[N#]` is blocked, not guessed. |
| G11 | **BLOCKED rows are not TAP tests.** They live in a registry with `blocked_by`, and are excluded from `plan(N)`. `skip`/`todo` are allowed only for registered BLOCKED IDs. |
| G12 | **Fail closed.** CI fails on vacuous assertions (`pass(`, `ok(true`), zero-assertion files, `plan(N)` mismatch, a test without an identity assertion, a missing collector, malformed TAP, a disappeared test ID (unless `RETIRED`), or a seed hash different from the reviewed one. `tests/**`, `seed/**` and runner config need owner review. |
| G13 | **Mutation outcomes have four classes:** `KILLED` (the named assertion flipped), `INVALID` (seed/setup error), `MASKED` (mutant applied but hidden, e.g. a permissive `using(true)` hidden by a RESTRICTIVE policy), `SURVIVED`. Only `KILLED` counts. A `pg_policy` before/after diff must prove the mutant really applied. |
| G14 | Test-only hooks (GUCs, triggers, RPCs such as `lab_probe`) live in test files or a test schema only. CI greps `supabase/migrations/` for `tests.` and fails if found. |

---

## 5. The cast

### 5.1 Accounts

| Account | Role | Initial state |
|---|---|---|
| **A** | client, single | No therapist, no partner. Uses "Save Privately" only. |
| **B** | client, single | Linked to TH1. |
| **C** | client, couple 1 | Active partner link with D. Linked to TH1. |
| **D** | client, couple 1 | Active partner link with C. Linked to TH1. |
| **E** | client, couple 2 | Active partner link with F. Linked to TH1. **Breakup subject.** |
| **F** | client, couple 2 | Active partner link with E. Linked to TH1. |
| **G** | client | Created after E's breakup as **E's new partner**. Linked to TH1. |
| **H** | client | **F's new partner** after the breakup. Linked to TH2 (therapist change). |
| **I** | client, single | Linked to TH2 only. |
| **J** | client | **Invite pending**, has not accepted yet (P1). |
| **K** | client, couple 3 | Has **withdrawn consent**. Partner is L. |
| **L** | client, couple 3 | K's partner. |
| **TH1** | therapist, verified | Clients: B, C, D, E, F, G. |
| **TH2** | therapist, verified | Clients: H, I. Linked to nobody else. |
| **TH3** | therapist, **unverified** | Signed up, manual verification pending. |
| **TH4** | therapist, verified | **Former** therapist of B (link ended). |
| **DR1** | therapist + client | One account that is a verified therapist AND a client of TH2. Roles must never merge (SCH-05). |
| **X** | attacker | Valid client account, no links at all ("stranger"). |
| **Y** | attacker | Holds tokens: expired, forged, replayed after sign-out, tokens of other users. |
| **Z** | attacker | Client who tries to **become a therapist or admin** (role tampering). |
| **ANON** | no session | |

`M`, admin assistant, teen, guardian, family member: **parked** (not Release 1, see `lh-clinical-gates`).

### 5.2 Seed data

Every client account gets four entries, so every sharing state exists:

| Entry | State |
|---|---|
| `{acct}-priv` | Private, never shared |
| `{acct}-toPartner` | Shared with partner only |
| `{acct}-toTH` | Shared with therapist only |
| `{acct}-toBoth` | Shared with partner and therapist |

For accounts with no partner or no therapist, only the applicable entries exist.

### 5.3 Canary sentinels

Every seeded body contains a unique string `SENTINEL::{acct}::{kind}`. After a run, search for sentinels belonging to accounts that were **not** authorized to see them in: API responses of other users, server logs, audit payloads, error messages, push payloads, exports. Any hit is a leak (see `CAN-01`). This catches leaks the table tests do not think of.

---

## 6. Test groups

### 6.1 BASE: the existing 17 (from `lh-adversarial-testing`)

| ID | Test | Task |
|---|---|---|
| BASE-01 | owner reads own entry | T010 |
| BASE-02 | partner cannot read unshared entry | T011 |
| BASE-03 | sharing X does not leak Y | T012 |
| BASE-04 | therapist cannot read unshared entry | T013 |
| BASE-05 | revoked share removes access on the next request | T014 |
| BASE-06 | ended partner link grants nothing | T015 |
| BASE-07 | direct SQL under the role respects RLS | T016 |
| BASE-08 | forged share for someone else's entry is rejected | F1 |
| BASE-09 | share to an unlinked or ineligible user is rejected | F6 |
| BASE-10 | ending a link revokes existing shares; re-link does not resurrect them | F2 |
| BASE-11 | no session (anon) gets zero rows from every table | F3 |
| BASE-12 | share failures are indistinguishable (no existence oracle) | F8 |
| BASE-13 | cross-user UPDATE/DELETE on entries affects 0 rows | |
| BASE-14 | cannot insert an entry with another user's `owner_id` | |
| BASE-15 | non-owner cannot delete or edit a share | |
| BASE-16 | meta: every `public` table has RLS enabled AND forced | |
| BASE-17 | views are `security_invoker`; SECURITY DEFINER functions set `search_path` | |

### 6.2 SC: relationship scenarios

| ID | Actors | Scenario and expected | Ph |
|---|---|---|---|
| SC-01 | A, B, TH1, X | A saves 4 private entries. Nobody else reads any. A tries to share to TH1: uniform rejection (no link). | P0 |
| SC-02 | B, TH1, TH2, TH3, TH4 | B shares `B-toTH`. TH1 reads exactly that row, reads `B-priv` → 0. TH2, TH3, TH4 read 0. | P0 |
| SC-03 | C, D | Active link, zero shares: neither sees the other's entries. C shares `C-toPartner`: D reads only that row. C revokes: D's **next request** returns 0. | P0 |
| SC-04 | C, D, TH1 | `C-toTH` visible to TH1 and not D. `D-toTH` visible to TH1 and not C. Sharing to TH1 never creates visibility between C and D. | P0 |
| SC-05 | E, F, TH1 | Breakup. See group BR. | |
| SC-06 | E, F, G, H | New relationship. See BR-18 to BR-20. | |
| SC-07 | F, TH1, TH2 | **Therapist change.** F's link with TH1 ends and a link with TH2 starts. TH2 reads only what F shares to TH2 afterwards. TH1 reads 0 of F's old shares (default per `[N6]`) and 0 of the new ones. F's own entries are unaffected. | P0 `[N6]` |
| SC-08 | K, L, TH1 | **Consent withdrawal.** L loses all access to K's shares immediately. K still reads own entries. Therapist side blocked until `[N7]`. | P0 / blocked |
| SC-09 | J, X | **Invite.** Code works once, only for the invited account, expires, no identifiers in the URL. X using J's code gets a uniform failure. | P1 |
| SC-10 | A, C, D | **Linking exposes nothing.** A gets a therapist later; C links with D after both already have entries. Old private entries stay private (a link alone never grants read, Principle I). | P0 |

### 6.3 BR: breakup (central)

**Sketch (not code, not approved):** one server-side function, e.g. `therapist_end_couple_link(link_id, disposition)`, `SECURITY DEFINER`, `search_path = ''`. In **one transaction** it: checks the caller is a verified therapist actively linked to this couple; ends the link; deletes or seals share grants between the two; applies the disposition (`[N1]`, `[N2]`); writes the audit event. Any failure rolls back everything.

**Who may do what:**

| Action | Allowed | Everyone else |
|---|---|---|
| End a partner link (breakup) | The verified therapist linked to **that** couple | Denied: E, F, TH2, TH3, TH4, X, Z |
| Create a partner link | `[N3]` | Denied |
| Create a breakup request | A member of that active link | Denied |
| Read a breakup request | The linked therapist | Denied: the other partner too |
| Revoke own share | The owner | Denied |

| ID | Actor | Attack or action | Expected | Ph |
|---|---|---|---|---|
| BR-01 | E | `UPDATE partner_links SET status='ended'` on own couple link | 0 rows / denied, link unchanged. **Control:** TH1 can. | P0 |
| BR-02 | F | Same as BR-01 | Same | P0 |
| BR-03 | E | `DELETE` own partner link | 0 rows, link intact | P0 |
| BR-04 | TH2 (verified, not linked), TH3 (unverified), TH4 (former) | Call the breakup function on E–F | Uniform denial, nothing changes | P0 |
| BR-05 | X, Z, ANON | Same, including direct table writes | Denied | P0 |
| BR-06a | TH1 | End E–F (no disposition parameter). Independent of N1/N2. | Link ended; all E↔F shares gone; E and F still read own entries; TH1 still reads `E-toTH`. | P0 |
| BR-06b | TH1 | End E–F with each valid disposition | Per-disposition result in section 7. **BLOCKED** (N1, N2, P1 tables). | P1 |
| BR-07 | TH1 | Call with an invalid disposition or force a failure midway | **Nothing** changes (link still active, shares intact, no audit row). Then a valid call succeeds. | P0 |
| BR-08 | E, F | Read each other's shared entries in the **next statement** after commit | 0 rows, no caching, no grace period | P0 |
| BR-09 | TH1, E (concurrent) | TH1 ends the link while E revokes a share | Consistent end state, no error text that leaks details | P0 (script) |
| BR-10 | TH1 | Call the breakup twice | Second call is a no-op or a uniform error. Data is never re-exposed. Exactly one effective audit event. | P0 |
| BR-11 | privileged suite | After `DELETE`: count rows as `postgres` | **Physically 0 rows** for the couple's shared data. No `deleted_at` flag, no soft delete. Includes derived rows and stored files. | P1 |
| BR-12 | privileged suite | After `SEAL`: count rows as `postgres` | Rows **exist**, but E, F, TH1, TH2, G, X all read 0 | P1 |
| BR-13 | TH1 | After `THERAPIST_ONLY` | TH1 reads; E, F, G, H, TH2, X read 0 | P1 |
| BR-14 | E | Create a breakup request | Only for E's own active link. Row visible to TH1 only. Notification text generic. | P1 |
| BR-15 | E | Spam breakup requests | Deduped or limited (`[N10]`). TH1 gets **one** notification, not one per request. | P1 |
| BR-16 | F, TH2, X | Read E's request | 0 rows. F's UI/API shows **no pending flag** and no count (`M4`). | P1 |
| BR-17 | E, F | After breakup: read **own** entries | Still readable (owner). Individual entries are never deleted by a breakup (`[N1]`). | P0 |
| BR-18 | G | After E–G link: read E's old couple-era shares and entries not shared to G | 0 rows | P0 |
| BR-19 | F, H | Read anything from the E–G era | 0 rows | P0 |
| BR-20 | TH2 | Read E–G data (not their therapist) | 0 rows | P0 |
| BR-21 | E, F | Re-link E–F later | Old shares and old couple data are **not** resurrected, in every disposition | P0 |
| BR-22 | E | `SELECT` the link row after breakup | Sees only a generic status. Columns such as `ended_by` and `disposition` are not selectable by clients (column grants or a `security_invoker` view). | P0/P1 |
| BR-23 | TH1 | After breakup: audit event | `couple_link_ended` with actor, link id, disposition, timestamp. No clinical content. Chain valid. | P1 |
| BR-24 | E | Try to end own **therapist** link | Behavior defined by `[N6]`; until decided, denied. | P0 `[N6]` |

### 6.4 TH: therapist attacks

| ID | Actor | Attack | Expected | Ph |
|---|---|---|---|---|
| TH-01 | TH1 | Read A's entries (not linked) | 0 | P0 |
| TH-02 | TH1 | Read `B-priv` (linked, not shared; D1 note) | 0 | P0 |
| TH-03 | TH2 | Read `C-toTH` (shared with TH1, not TH2) | 0 | P0 |
| TH-04 | TH3 | Read anything / be the target of a share | 0 / rejected (unverified) | P0 |
| TH-05 | TH4 | Read B's old shared entries after the link ended | 0 `[N6]` | P0 |
| TH-06 | TH1 | Insert a `therapist_client_links` row to A (self-link without consent), or `UPDATE` an ended link back to active | Denied | P0 |
| TH-07 | TH1 | Change own `role` or `verified` flag | Denied. Only a server/admin path can. | P0 |
| TH-08 | TH1 | Promote a client to therapist (`users.role`) | Denied | P0 |
| TH-09 | TH1 | Insert a share "on behalf of" client C (`owner_id = C`) | Rejected (forged share, F1 variant) | P0 |
| TH-10 | TH1 | Edit or delete a client's entry | 0 rows. Therapist comments are separate rows. | P0 |
| TH-11 | TH1 | Read `C-toPartner` (shared to D only) | 0 | P0 |
| TH-12 | TH1 | Enumerate by guessed UUIDs | Same response as for non-existent IDs | P0 |
| TH-13 | TH1 | Call `private.*` helpers directly or use them as an oracle | No `EXECUTE` / not exposed; identity is derived from `auth.uid()` | P0 |
| TH-14 | TH1 | Verification revoked mid-session; JWT still valid | Access stops on the **next request** (policy reads the table, not a JWT claim) | P0 |
| TH-15 | TH2 | Read TH1's private clinical notes | 0 | P1 |
| TH-16 | TH1 | `UPDATE`/`DELETE` on `audit_events` | Denied (append-only), cannot hide own reads | P1 |
| TH-17 | TH2 | Export TH1's client data | Denied. Allowed exports are permission-checked, consent-checked and audited. | P1 |
| TH-18 | TH1 | Read D's individual screening result (IPV) via any view or RPC | 0. Gap view is therapist-only and never reaches C or D. | P1 |

Note: **RLS cannot stop a therapist from deliberately telling D what C shared.** See section 12.

### 6.5 CL: client and partner attacks

| ID | Actor | Attack | Expected | Ph |
|---|---|---|---|---|
| CL-01 | C | `UPDATE`/`DELETE` D's shares | 0 rows | P0 |
| CL-02 | C | Insert a share with `owner_id = D` | Rejected | P0 |
| CL-03 | C | Read `D-priv` | 0 | P0 |
| CL-04 | Z | Edit `user_metadata` / `users.role` to become therapist, then call therapist-only paths | Denied. No policy may read `user_metadata`. | P0 |
| CL-05 | C | Insert a `partner_links` row to X or to a stranger | Denied (`[N3]`) | P0 |
| CL-06 | C | Insert a `therapist_client_links` row naming TH1 | Denied | P0 |
| CL-07 | C | Read therapist notes about D or about C | 0 | P1 |
| CL-08 | C | Read D's IPV screening | 0, never exposed to the partner | P1 |
| CL-09 | C | Read other couples' `partner_links` (E–F) | 0. C sees only own link. | P0 |
| CL-10 | C | List `users`: emails, roles, other people | Only permitted minimal fields, no emails | P0 |
| CL-11 | C | Change `owner_id` of own entry to D | Rejected (re-pointing) | P0 |
| CL-12 | C | Share/unshare cycles on one entry | No residual access after the final revoke | P0 |
| CL-13 | C | Read **metadata** of D's shares (to learn that D shared something with TH1) | 0, no existence leak | P0 |
| CL-14 | C | Mass assignment: extra fields `role`, `verified`, `status`, `visibility`, `owner_id` on insert/update | Ignored or rejected | P0 |
| CL-15 | C | Replay an old or used invite code | Uniform failure | P1 |
| CL-16 | C | Read D's breakup request | 0 (`M4`) | P1 |

### 6.6 SEC: sessions and API surface

| ID | Actor | Attack | Expected | Ph |
|---|---|---|---|---|
| SEC-01 | ANON | Read every table | 0 rows, no errors that reveal existence | P0 |
| SEC-02 | Y | Expired JWT | 401, no data | P0 |
| SEC-03 | Y | Token after sign-out | Refresh fails. The **access token works until it expires** (known limit, see `[N9]`). Document the TTL. | P0 |
| SEC-04 | Y | C's token used against D's rows | 0 | P0 |
| SEC-05 | Y | Token signed with a wrong secret / `alg: none` | Rejected | P0 |
| SEC-06 | build | Search the **built bundle** for `service_role` and for any key besides URL + anon | None found (`findstr`) | P0 |
| SEC-07 | C | Subscribe via Realtime to channels or tables of D | No events. Realtime has its own authorization (rule 12 of `lh-privacy-rls`). | P0/P1 |
| SEC-08 | C | Request a signed URL for D's file; reuse an expired URL | Denied | P1 |
| SEC-09 | C | PostgREST tricks: embeds (`select=*,shares(*)`, `users(*)`), filters or ordering on hidden rows (`body=ilike.*x*`) | 0 rows; no counting oracle | P0 |
| SEC-10 | C | Call helper functions with arbitrary ids (`are_linked(D, E)`) | No information about others | P0 |
| SEC-11 | C | Write HTML/SQL payloads in text fields | Stored as data. Rendered as text on the therapist dashboard (no script runs). | P0 / UI later |
| SEC-12 | any | `SECURITY DEFINER` without `search_path`; plain views | None exist (BASE-17) | P0 |

### 6.7 AU and CAN: audit and canaries

| ID | Check | Expected | Ph |
|---|---|---|---|
| AU-01 | Privileged actions each write an event: link create/end, share/revoke, breakup + disposition, therapist reads (via RPC, D4), request create, file access, export | One event each, actor + subject, **no PHI** | P1 |
| AU-02 | `UPDATE`/`DELETE` on `audit_events` as any app role | Denied; trigger raises | P1 |
| AU-03 | (privileged suite) Chain verification function passes; **tamper test**: edit a row as `postgres` inside a test | Verification fails (otherwise it checks nothing) | P1 |
| AU-04 | Sequential and concurrent inserts | Chain does not fork (advisory lock or single writer) | P1 |
| AU-05 | Denied attacks (BR-01, TH-06, CL-04...) | Optional: a security event without PHI, for anomaly review | P1 |
| CAN-01 | Run the whole suite, then search all outputs for unauthorized sentinels (5.3) | Zero hits in API bodies, logs, audit, errors, push payloads | P0+ |

### 6.8 NT: notifications

| ID | Check | Expected | Ph |
|---|---|---|---|
| NT-01 | Every template | Generic text only (see `lh-clinical-gates` table). No names, scores, moods, diagnoses. | P1 |
| NT-02 | Breakup request | TH1 receives a generic "You have a new update." The partner receives **nothing**. Any new template needs the clinical lead's approval. | P1 |
| NT-03 | Event of C | Never notifies D unless explicitly designed | P1 |
| NT-04 | Sign-out | Push token unregistered | P1 |
| NT-05 | Spam from one account | Target is not flooded (see FL-07) | P1 |

### 6.9 FL: flood and concurrency

**Harness:** a script (Node + real Auth logins, or `k6`) that signs in as many cast accounts at once against **local Supabase or staging with synthetic data only**. Never production. Start small (e.g. 20 accounts, 5 minutes) and scale. Starting numbers are tunable, not requirements.

**Invariants that must hold at all times:**

| # | Invariant |
|---|---|
| INV-1 | **No cross-user read, ever.** Every row a worker receives is its own, or covered by a share + active link at that moment. Verified per response by an oracle built from the seed manifest (not by a second query to the same DB). Missing trace records fail the run. A blind shadow reader is optional and trusted only if a `using(true)` mutation makes it fire. |
| INV-2 | **Revoke is immediate, per surface.** "Starts" = server statement start after the revoke call returned at the harness. Log server time for every read; reads overlapping the boundary are counted as an "ambiguous window", not hidden. Applies to table reads only. Signed URLs, open Realtime subscriptions, live JWTs, delivered push and exports have separate, documented exceptions (section 12). Default isolation is `READ COMMITTED` (each statement sees new commits); `REPEATABLE READ` freezes the snapshot. |
| INV-3 | **No resurrected shares.** Racing `create_share` against `end_link`: the share is rejected or removed, never active after the link ended. (The classic race: the share function checks the link, the link ends, then the share inserts.) Defense idea: lock the link row `FOR SHARE` in the share RPC and `FOR UPDATE` in `end_link`. |
| INV-4 | **Audit chain intact** after the run: no forks, event count equals action count. |
| INV-5 | **Idempotency:** duplicate submits with the same client UUID create one row. |
| INV-6 | **Rate limits hold** for login, invite use, share creation, breakup requests, notifications. |
| INV-7 | **No leakage in errors under load** (500s carry no SQL, ids or content). |
| INV-8 | **Fairness (soft):** X flooding does not block C's normal requests. |

| ID | Scenario | Checks | Ph |
|---|---|---|---|
| FL-01 | Mixed storm: 20+ accounts creating entries, sharing, revoking, reading | INV-1, INV-2, INV-7 | P0 |
| FL-02 | One owner toggles share/revoke on one entry while the recipient polls | INV-2 | P0 |
| FL-03 | `end_link` vs `create_share` race. Mechanism: session A (lab) holds `FOR UPDATE` on the link row; session B calls `create_share`; poll `pg_stat_activity` for `wait_event_type='Lock'` (**blocking is the assertion**); A ends the link and commits; B must insert 0 rows or fail uniformly. Both orders. No production hook. Control: A idle, share created and readable. | INV-3 | P0 |
| FL-04 | E spams breakup requests | INV-6, `[N10]` | P1 |
| FL-05 | Login brute force on TH1 | Rate limit or lockout, MFA required | P0 |
| FL-06 | Invite-code brute force (J's invite) | Single use, expiry, rate limit, enough entropy | P1 |
| FL-07 | One account triggers many notifications to one target | Deduped, target not spammed | P1 |
| FL-08 | Offline queue replays 100 duplicates | INV-5, exactly one row each | P1 |
| FL-09 | TH1 double-clicks the breakup | BR-10 under concurrency | P0 |
| FL-10 | Connection-pool exhaustion | Fails gracefully, no data in errors | P0 |

### 6.9b SUR, SCH, RV, ST: surfaces, schema and bypass planes (added in v0.2)

One assertion per row, so a mutant can be killed by name (G13). `[CHECK]` = verify behavior on the deployed Supabase/PostgREST version before trusting.

| ID | Actor | Attempt | Expected / control | Ph |
|---|---|---|---|---|
| SUR-01 | runner | Enumerate every exposed object: tables, views, RPCs (incl. overloads and all-DEFAULT args), buckets, Realtime publications, Edge Functions, `/graphql/v1` fields. | Each maps to a test or a written exclusion. Control: a scratch table with no policy produces failing generated tests. | P0 |
| SUR-02 | runner | Catalog lint per migration: RLS not enabled and forced; policies with no `TO` (means PUBLIC, includes anon); policies reading `user_metadata` or app-authorization claims from `auth.jwt()` (MFA `aal` is allowed); materialized views in `public`; `SECURITY DEFINER` without `search_path`; plain views; recursion (`explain select * from entries` as `authenticated` must not raise `42P17`). | Zero rows each, one ID per check. Control: scratch violator is flagged. | P0 |
| SUR-03 | ANON, X, TH3 | `has_function_privilege` for every `public` function; call every DEFINER function with valid, null and cross-user args; read `\ddp` / `proacl` (Supabase default privileges may grant EXECUTE to anon/authenticated explicitly, so `REVOKE FROM PUBLIC` alone may not be enough). | No client-data DEFINER executable by anon; no boolean helper for arbitrary IDs; uniform denial. Control: TH1 calls breakup on a scratch couple. `[CHECK]` | P0 |
| SUR-04 | runner (privileged) | List DEFINER functions whose owner has `rolsuper` or `rolbypassrls`. | None app-callable except an approved list. Control: scratch function is flagged. | P0 |
| SUR-05 | X, runner | `has_schema_privilege(role,'public','CREATE')` for anon/authenticated; lint policy expressions for unqualified functions/operators; lab-only operator-shadowing run of BASE-02. | false; 0 rows; zero unqualified references. | P0 |
| SUR-06 | X, Y | Edge Functions: list `verify_jwt=false` in `config.toml`; call each with no JWT, wrong JWT, X's JWT and body ids; grep for `service_role` and identity read from the body; CORS and error-stack hygiene. | 401/403/uniform 404, no side effects. Control: C's legitimate call works. | P0/P1 |
| SUR-07 | C, F, X | Realtime planes separately: `postgres_changes`, broadcast, presence, public channel with anon key. Column plane: revoke a column from `authenticated`, then dump raw frame keys (also DELETE with `REPLICA IDENTITY FULL`). | No frames, or keys within SELECTable columns; none after the revoke commits. Control: own events arrive. `[CHECK]` | P0/P1 |
| SUR-08 | C | PostgREST oracles, one row each: `count=exact`, `HEAD`, `Range`, singular `Accept`, embeds both ways, `order`, filter, `id=in.(real,dead)` in one request, `Accept-Profile`/`Content-Profile` of other schemas, `Accept: text/csv`. Compare via twin helper. | `[]`, `Content-Range: */0`, no nested data, identical shape. Control: own rows return correctly. `[CHECK]` | P0 |
| SUR-09 | X, E | Twin column probe: `select=ended_by` (hidden) vs `select=nonexistent_xyz`, SQL and REST; OpenAPI as anon vs authenticated. | Same status and SQLSTATE; no row content in OpenAPI. Control: TH1 reads via the authorized path. `[CHECK]` | P0/P1 |
| SUR-10 | X | Constraint oracles, three separate tests: unique (existing pair vs random pair), FK (real foreign entry vs dead entry), upsert `on_conflict` + `resolution=ignore-duplicates`. Also a single `id=in.(real,dead)` request. | Indistinguishable. Remedy: authorize in `WITH CHECK` first, or route through an RPC that normalizes errors. Control: legitimate share and link succeed. | P0 |
| SUR-11 | Y | JWT with wrong `aud`, `iss`, `role`, project ref, `alg: none`, wrong signature, expired. | 401 before any query. Control: valid JWT works. | P0 |
| SUR-12 | harness | Pooler: test-only RPC doing session-level `set_config(...,false)`; 20 sequential requests as D through pooled and direct ports; `PREPARE` as C then `EXECUTE` as X. Lint: every migration `set_config` uses `is_local=true`. | D always sees D's `auth.uid()` and the default `search_path`; X sees 0 rows. `[CHECK]` | P0 |
| SUR-13 | X | `LISTEN` on every `pg_notify` channel; read `pg_stat_activity` query text while C runs a canary query; read `storage.objects` directly. | No payload, no foreign query text, no foreign object metadata. | P0 |
| SUR-14 | build | Scan `dist/**`, Capacitor assets, unzipped APK/IPA, source maps and `git log -p` for `service_role` (decode any `eyJ` token), `SUPABASE_SERVICE_ROLE_KEY`, sentinels, `.env*`. Extends SEC-06. | Zero hits; anon key only; no release source maps. Control: planted fake is flagged. | P0 |
| SUR-15 | runner | Egress allowlist: every outbound host (crash, analytics, push, CDN, fonts) is on a written list; no sentinel, entry body, email or link id in bodies to non-Supabase hosts. | Allowlist equals observed hosts. Control: a debug breadcrumb with a sentinel is caught. | P0 |
| SUR-16 | runner | Harness isolation: marker row in file A not visible in file B; run the suite twice in reversed order; compare results and a post-run `pg_policy` hash. | Identical. Control: a deliberately order-dependent scratch test fails. `[CHECK]` | P0 |
| SUR-17 | runner | Scan `evidence/**` and console logs for raw JWT and refresh-token patterns. | Zero; redacted placeholders. | P0 |
| SUR-18 | X | `/graphql/v1`: entries filter by real vs dead id, `__type` introspection of hidden columns, mutation on `shares`, anon key only. | Disabled in Release 1, or twin-identical with no hidden column. Control: C's own query works. `[CHECK]` | P0 |
| RV-01 | E | `revoke_all_my_shares()` with: no therapist ever, therapist link ended, TH1 deleted through the Admin API, TH1 unverified. | Next statement: F, G, TH1 read 0 of E's entries. Control: before the call F reads `E-toPartner`. | P0 |
| SCH-01 | catalog | Unique index on `(entry_id, reader_id)`; no boolean visibility columns on `shares`. **Pin one column name** (`reader_id` vs `grantee_id`) before generating SQL. | Pass. | P0 |
| SCH-02 | E | Create E–G while E–F is active (constraint on both endpoint columns plus a canonical `least/greatest` pair index). | Rejected. Control: after E–F ends, E–G succeeds. | P0 |
| SCH-03 | C, TH1 | Self-link in `partner_links` and `therapist_client_links`; self-share. | Rejected or grants nothing. | P0 |
| SCH-04 | TH1 | End C–D, then read `C-toTH` and `C-toBoth`. | Still readable (therapist link is separate). | P0 |
| SCH-05 | DR1 | Dual-role account: therapist reads and client reads do not merge. | No cross-role access. | P0 |
| ST-01 | C, D | Recipient mints a signed URL with a huge `expiresIn`; owner revokes; recipient fetches. Decode `exp`. | Expect bytes until expiry (bearer). Record as an exception to M3, or front with an authorizing Edge Function. Control: before revoke it works. `[CHECK]` | P1 |
| ST-02 | C, D | Owner overwrites the same path after sharing, revokes; old URL refetched, hash both. | A written rule is required (immutable keys per version). `[CHECK]` | P1 |
| ST-03 | C | Storage object plane: list another prefix, encoded traversal, `x-upsert` over D's object, `/object/public/` on a private bucket, image `render` variant, CDN cache after expiry. | Denied, no bytes or metadata. | P1 |
| UI-01 | E | Revoke tapped offline or with a forced 500. | UI never says "revoked" before a server commit ack. | P1 |

### 6.10 MB: mobile and screenshot (manual, on real devices)

**Honest scope:** screenshot prevention is a **deterrent layer**, not a boundary. The real protection is `RLS` and "the client only sees what concerns them."

| Platform | What is possible |
|---|---|
| Android | `@capacitor/privacy-screen` sets `FLAG_SECURE`: blocks screenshots and screen recording, hides the recents preview, stops mirroring to non-secure displays. |
| iOS | **Cannot block** screenshots. Can blur in the app switcher. Can detect after the fact and hide content during recording/mirroring via native APIs (`UIScreen.isCaptured`, the screenshot notification). Check what the plugin covers; anything extra is small native code. |
| Both | **A second camera photographing the screen cannot be stopped.** |
| Therapist web | Browsers cannot block screenshots. The therapist is bound by professional duty; reads are audited. |

| ID | Device check | Expected |
|---|---|---|
| MB-01 | Android: screenshot on a sensitive screen | Blocked or black |
| MB-02 | Android: recents / app switcher | Preview hidden |
| MB-03 | Android: screen recording and casting | Content hidden or blocked |
| MB-04 | iOS: app switcher | Blur or overlay |
| MB-05 | iOS: screen recording / mirroring | Content hidden (verify; else native code) |
| MB-06 | iOS: screenshot | **Cannot be blocked.** Documented. Detection event per `[N8]`. No UI or store copy promises otherwise. |
| MB-07 | Biometric prompt | Content stays covered (`privacyModeOnActivityHidden`) |
| MB-08 | Lock-screen notifications | Generic text only, verified on a locked real device |
| MB-09 | Accessibility | TalkBack and VoiceOver still work with the privacy screen on (do not assume, test) |
| MB-10 | App data inspection | No tokens or client data in `localStorage`/IndexedDB/plain files |
| MB-11 | Backups | `allowBackup=false`: `adb backup` yields nothing; iOS files excluded from iCloud |
| MB-12 | Quick-exit | Instantly obscures and locks. Android may close the app; iOS can only obscure and lock. |

---

## 7. Golden tables: who can read what

`✔` can read, `✘` zero rows. Follows the Phase 0 spec (therapist does **not** see unshared entries). If D1 resolves to the Blueprint model, the TH1 column of the `*-priv` row changes.

### 7.1 Active couple C–D with TH1

| Entry | C | D | TH1 | TH2 | TH3 | X | ANON |
|---|---|---|---|---|---|---|---|
| `C-priv` | ✔ | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ |
| `C-toPartner` | ✔ | ✔ | ✘ | ✘ | ✘ | ✘ | ✘ |
| `C-toTH` | ✔ | ✘ | ✔ | ✘ | ✘ | ✘ | ✘ |
| `C-toBoth` | ✔ | ✔ | ✔ | ✘ | ✘ | ✘ | ✘ |

### 7.2 After TH1 ends the E–F link (individual entries)

Individual entries are never deleted by a breakup (`[N1]` proposal). Same result for all three dispositions.

| Entry | E | F | G | TH1 | TH2 | X |
|---|---|---|---|---|---|---|
| `E-priv` | ✔ | ✘ | ✘ | ✘ | ✘ | ✘ |
| `E-toPartner` (shared to F before) | ✔ | **✘** | ✘ | ✘ | ✘ | ✘ |
| `E-toTH` | ✔ | ✘ | ✘ | ✔ | ✘ | ✘ |
| `E-toBoth` | ✔ | **✘** | ✘ | ✔ | ✘ | ✘ |

TH1 keeps reading what E shared to TH1 because E's therapist link is separate from the couple link.

### 7.3 Couple-scoped data (P1, `[N1]` `[N2]`)

| Disposition | E | F | G, H | TH1 | TH2 | X | Rows exist? |
|---|---|---|---|---|---|---|---|
| `DELETE` | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | **No** (physically gone) |
| `SEAL` | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | Yes |
| `THERAPIST_ONLY` | ✘ | ✘ | ✘ | ✔ | ✘ | ✘ | Yes |

### 7.4 New relationship E–G

| Entry | E | G | F | H | TH1 | TH2 |
|---|---|---|---|---|---|---|
| `E-toPartner` (shared to G) | ✔ | ✔ | ✘ | ✘ | ✘ | ✘ |
| E–F era shares/couple data | per 7.2/7.3 | ✘ | per 7.2/7.3 | ✘ | per 7.3 | ✘ |

---

## 8. Mutation checks to run before accepting green

For each, loosen on purpose and confirm at least one test fails. Restore afterwards.

| Mutation | Expected red |
|---|---|
| `entries` read policy → `using (true)` | BASE-02, BASE-04, TH-01, TH-02 |
| Remove the active-link clause from the share read policy | BASE-06, BR-08 (SC-07 is blocked by N6) |
| Remove `with check` on share insert | BASE-08, TH-09, CL-02 |
| Let a client `UPDATE` `partner_links` | BR-01, BR-02, BR-03 |
| Remove the therapist-linked check in the breakup function | BR-04 |
| Remove the delete-shares step from `end_link` | BASE-10, BR-21 |
| Remove the lock in the share RPC | FL-03 |
| Remove the transaction/rollback behavior | BR-07 |
| Change the audit trigger to allow `UPDATE` | AU-02 |
| Read role from `user_metadata` in a policy | CL-04 |

---

## 9. Evidence required to accept a gate

Never accept a summary. Collect (per `lh-agent-verification`):

1. Raw output of `supabase test db` from a fresh run, including the TAP plan line and every `ok`/`not ok`.
2. The assertion count compared with this file's rows for the phase.
3. `git status` and `git diff --stat`; zero-byte files; files outside the allowed list.
4. `findstr` over migrations: `using (true)`, `with check (true)`, `disable row level security`, `security definer` without `set search_path`, `grant ... to anon`.
5. The mutation check results (section 8).
6. Proof of role (`current_user`) in the tests.
7. For FL: the harness log with each invariant's result, plus the audit chain verification output.
8. For MB: a dated checklist with device model, OS version, and a photo or screen recording of each result.
9. One evidence folder per run, `evidence/<utc>-<git-sha>/`: raw TAP, `results.json`, `mutations.json` (with KILLED/INVALID/MASKED/SURVIVED), `policies.sql`, migration hash, tool and PostgREST versions, `git status`, `git diff --stat`, `SUMMARY.md`. An unclean `git status` marks the run DIRTY. Evidence is bound to the commit and the migration hash; a stale green run never marks the current commit `verified`.
10. Token scan of the evidence folder (SUR-17) is clean.

Only then write "verified", and say exactly which items were done.

---

## 10. Roadmap that updates itself from the app map

**Goal:** the roadmap can never say "done" for something that is not proven.

**Single source of truth:** `docs/app-map.yaml` (in the repo). One node per feature, linked to this file's test IDs.

```yaml
features:
  - id: F-SHARE-001
    name: Share and revoke an entry
    phase: 0
    depends_on: [F-SCHEMA-001]
    blocked_by: []            # decision ids such as D6, N1
    tests: [BASE-02, BASE-05, BASE-08, BASE-12, SC-03]
```

**Status is computed, never typed by hand:**

| Status | Condition |
|---|---|
| `blocked` | `blocked_by` has an open decision |
| `planned` | Nothing merged yet |
| `in_progress` | A branch or PR exists |
| `built` | Merged to the main branch |
| `verified` | **All** linked test IDs exist, run, and pass in CI **and** an evidence file for that task is in the repo (section 9) |

The roadmap shows **two counters**: "claimed by agents" vs "verified by CI". A gap between them is the point of the whole system. An agent's own report never changes a status.

**How it runs:**
1. Tests emit a machine-readable result (TAP converted to JSON) as a CI artifact.
2. A small script reads `app-map.yaml` + test results + evidence files and produces the roadmap (the existing project roadmap HTML format).
3. A GitHub Action runs it on every merge to main. Output is published as a CI artifact or opened as a bot PR. **Do not commit straight to main** (generated files cause merge conflicts and hide history).
4. First version: run the script by hand. Add the Action once the output format is stable.

**Kill rule (v0.2):** a mutant kill is required only for features that have a policy, grant or function. UI-only features (copy, empty states) verify through their own tests. `verified` also requires zero open BLOCKED dependencies. First version is a flat CSV from `results.json`; the Action, bot PR and HTML wait until the format stops changing.

**Scope note:** this is dev tooling, not product. Per scope discipline, build the simple manual version after the Phase 0 tests exist, since there is nothing to verify before that.

---

## 11. Rollout order and task-card slicing

One task card per step (goal, allowed files, forbidden files, acceptance check, evidence to paste back).

| Step | What | Depends on |
|---|---|---|
| 0 | **Thin slice:** `npm run lab` (one Node entry point) + seed + `tests.authenticate` + twin helper + BASE-02, BASE-04, BASE-08 with positive controls, then a deliberate `using(true)` leak that must turn them red. Nothing else is built until this catches the leak. | Phase 0 schema |
| 1 | Seed script for the cast (5.1 to 5.2, incl. DR1) + manifest + control gate (aborts the run) + sentinel strings | Phase 0 schema |
| 2 | BASE-01 to 17 | Step 1 |
| 3 | TH and CL rows marked P0, SEC P0 rows | Step 2 |
| 4 | SC P0 rows + BR P0 rows (link end, atomicity, no resurrection) | Step 2, `[N3]`, `[N6]` |
| 5 | Mutation checks (section 8) for steps 2 to 4 | Steps 2 to 4 |
| 6 | FL harness: FL-01, 02, 03, 09 | Share and end-link RPCs |
| 7 | CAN-01 canary sweep | Steps 3 to 6 |
| 8 | P1 rows as each table lands (requests, couple data, notes, audit, files, notifications) | Decisions `N1`, `N2`, `N5`, `N10`, `D4`, `D9` |
| 9 | MB device checklist | A built app |
| 10 | app-map + roadmap script (section 10) | Steps 2 to 4 |

The **exit gate** of Phase 0 is unchanged: all privacy tests pass, Claude re-ran them against the real database, and the committed policy SQL was diffed against the reviewed SQL.

---

## 12. Residual risks (tests cannot prove these)

| Risk | Why tests cannot cover it | Mitigation |
|---|---|---|
| A therapist deliberately tells D what C shared | It is human behavior, not a data-access bug | Professional duty, audited reads, clear UI cues |
| A second camera photographs the screen | No OS can prevent it | Deterrent layer + minimum content on screen |
| Partner forces a client to unlock and show the phone | Coercion | App lock, quick-exit, generic notifications |
| Stolen JWT used until it expires | Access tokens cannot be revoked instantly | Short TTL (`[N9]`), refresh revocation |
| `service_role` key leaked or Supabase project compromised | Bypasses RLS entirely | Key never in a client, rotation plan, vendor inventory |
| A client trapped by M1 with an unreachable therapist | Product/clinical design | `[N4]` |
| iOS screenshot cannot be blocked | Platform limit | Honest copy, no promises (`[N8]`) |
| `M3` ("access closes immediately") is false on these surfaces | Signed URLs (bearer until expiry), open Realtime subscriptions, live JWTs (until `exp`), already-delivered push, downloaded exports, device cache | Per-surface written exception with a measured bound; server re-authorization where the bound is too long (Q-07) |
| A superuser or `BYPASSRLS` role skips triggers and RLS (`session_replication_role=replica`) | The audit chain is tamper-**evident**, not tamper-proof | External anchor of the chain head; owner-role audit (SUR-04) |

---

## 13. Changelog

| Date | Change |
|---|---|
| 2026-11-25 | v0.1 created from the design session. Decisions M1 to M7 recorded. Open decisions N1 to N10 proposed. All rows are proposals until tested and verified. |
| 2026-11-26 | v0.2: Round 1 (6 AIs) and Round 2 (5 AIs) folded in. G1 and G3 reworded; G11 to G14 added; BR-06 split into 06a/06b; privileged suite separated; DR1 added; section 6.9b added (SUR, SCH, RV, ST, UI); INV-1/INV-2/FL-03 redefined; client questions split (3b); section 12 gets M3 exceptions. `SEAL` flagged for removal pending Q-01. MRG-23 as a privacy test dropped. Details in `round2-decisions.md`. |
