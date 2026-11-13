# Spec Addendum 001 — D4: API Layer Decision

**Status:** Decided (owner: Ahmed) · **Applies to:** T003 and every later phase
**Does not change:** Constitution Principles I–III, spec FR1–FR5, the `shares` table as the single source of visibility.
**Reviewed:** independent security review (ChatGPT) triaged; accepted findings are folded into R2, R3, R5, R7, R9–R11 below.

## Decision

Link & Heal uses a **hybrid** model. There is **no separate API server** (no NestJS) in Release 1.

| Path | Used for | Guard |
|---|---|---|
| Direct Supabase (PostgREST) | A client reading and writing **their own** data (e.g. own mood entries) | RLS (forced) |
| Audited `RPC` | Therapist reads of client data, sharing/revoking, scoring, alerts, exports, file URLs | RLS + code path that writes an audit event |
| Edge Function | Only as a thin caller of an audited `RPC`, or for work with no client-data read (e.g. PDF rendering of data the RPC returned) | Calls the RPC; never reads client data and audits in two steps |

## Why

- The Blueprint requires that every access to a client file appears in the audit log. RLS and triggers cannot see `SELECT`, so reads need a code path that writes the event.
- A separate server adds hosting, secrets and attack surface for a solo builder. The RLS layer is already proven (93 pgTAP tests green on `main`).
- If a full API is needed later, the `RPC` contracts become that API.

## Rules

1. **R1 — RLS stays the authority.** Every table holding client data keeps RLS enabled and forced. RPCs never replace policies.
2. **R2 — Audited reads, atomic and fail-closed.** A therapist reads client data only through one SQL function (`RPC`) that performs the read and inserts the `audit_events` row in the same transaction. If the audit insert fails, no data is returned. An audit event is written for: successful reads, denied attempts, and signed-URL issuance (the event is the issuance; URLs are short-lived).
3. **R3 — Close every direct path.** For every table holding client data, a therapist has no direct `SELECT`. Today this means removing the therapist branch of `entries_select_shared`; the same applies to every future client-data table. Also: no views over client data in exposed schemas (unless `security_invoker`); client-data tables are not in a Realtime publication; Storage buckets are private with no therapist direct policy. This tightens access; it never loosens it. Verified by catalog queries and therapist-JWT tests, including nested PostgREST relationship queries.
4. **R4 — Tests first.** Per Constitution Principle III: adversarial tests first, then the policy change, then a mutation check. "Done" means: a negative test exists for each direct path in R3, and each policy/grant/function check that was changed has a mutation that makes a test fail. Existing tests in `03_sharing` and `04_links` that assume a direct therapist read are updated as part of that change.
5. **R5 — Canada-only.** Edge Functions that touch client data are pinned to `ca-central-1` and tests check `x-sb-edge-region`. This is one check, not proof of residency: the vendor/data-flow inventory must also confirm the region of the database, Storage, backups and logs.
6. **R6 — Keys.** Only the Supabase URL and anon key ship in client bundles. `service_role` is used only server-side (Edge Function secrets), never in `VITE_*` variables, and is scanned for in builds and CI output.
7. **R7 — Validation is not authorization.** Zod at every RPC/Edge Function boundary plus database `check` constraints validate shape only. Authorization is checked separately and has its own tests (valid input, wrong client, must be denied).
8. **R8 — Logs.** Logs and errors contain event names and pseudonymous IDs only: no names, emails, notes, scores, request/response bodies or SQL parameters.
9. **R9 — `SECURITY DEFINER` hygiene.** Every such function: fixed `search_path` and schema-qualified references; `EXECUTE` revoked from `public` and `anon`, granted only to `authenticated`; caller identity taken only from `auth.uid()` (never from a parameter; null means deny); authorization checked against current database state (links/shares), never JWT claims alone; privileges verified per full signature, including overloads. A catalog test lists all functions reachable by `anon`/`authenticated` and fails on any unexpected one.
10. **R10 — `audit_events` hardening.** Append-only: `update`, `delete` and `truncate` revoked, with triggers that raise on update/delete/truncate. A single writer function takes a transaction-level advisory lock so the chain cannot fork. The canonical serialization is defined in the migration (fixed field order, unambiguous delimiters, UTC timestamps, hash-version column). `actor_id` comes from `auth.uid()` only. The verification function is tested by mutation (modify, delete, reorder, fork).
11. **R11 — Scope of the guarantee.** The audit guarantee covers application roles. It does not cover Supabase platform operators, the database owner or `service_role`, and a hash chain stored in the same database cannot stop a database administrator from rewriting history. This is accepted for the pilot and documented; external anchoring can be added later.

## `audit_events` (to be created in a new migration)

- Columns: `id`, `at`, `actor_id`, `action`, `subject_type`, `subject_id`, `prev_hash`, `hash`, `hash_version`. References only, no clinical content, pseudonymous IDs.
- One global chain for Release 1.
- Own pgTAP tests and mutation checks, as for the privacy layer.

## T003 (replaces "Set up API project skeleton (TypeScript)")

- [ ] `supabase/functions/` skeleton with one health-check function (no client data)
- [ ] Shared Zod schemas package/folder
- [ ] Migration for `audit_events` + its tests (R10)
- [ ] Catalog test for function privileges (R9)
- [ ] CI keeps `supabase test db` green

## Deferred (not in T003)

- Performance benchmarks and chain partitioning (pilot scale is 5–10 clients).
- Storage, signed URLs and Realtime tests: when those features are introduced (R2, R3 already bind them).
- Therapist-facing read RPCs for real features (Phase 1+), scoring, alerts, exports.
- Any UI beyond a dev harness, AI/BYOK code, clinical assessment logic (gates unchanged).

## Open items this does not settle

- D9: in-app account deletion vs immutable audit trail and clinical retention (client + lawyer). `audit_events` must reference pseudonymous IDs so deleting a person does not require rewriting the chain.
- D3: Capacitor vs React Native.
