# APP_MAP v1.1: Link & Heal (Build + Reverse on the backend, Tier 0, updated 2026-11-25)

> Gate check: touches **consent and sharing**, **stored personal data**, **notifications** and (later) **crisis handling**. This map only describes what exists and what is unknown there. Decisions belong to `lh-clinical-gates` and to the owner (a therapist). A map never overrides a gate.
>
> Evidence labels: `Verified` (raw CI log, catalog query, or file read) · `Stated` (the owner said it) · `Proposed` (suggested, not decided) · `Inferred` · `Unknown` · `Missing` (nothing implements it yet).
>
> Scope note: only the database layer is built. `src/App.tsx` returns `null`, and `package.json` has no `@supabase/supabase-js` and no Capacitor. Every app node below is therefore `Missing` until work starts.

## 1. Promise and non-goals
**Promise:** a therapist-first between-sessions companion. Single clients and couples log mood and write private reflections, and share selected entries on purpose. The therapist works from a separate web dashboard. (Stated)

**Non-goals (current):**
- No AI feature in the first release. (Stated 2026-11-25; the hard gate on who pays still applies if AI is ever added)
- No clinical assessment logic until licensing is confirmed. (Stated, hard gate)
- Not an emergency service. (Stated)

## 2. Cores
| Node | Class | Owns state | Invariants | build / wrap / use OS |
|---|---|---|---|---|
| `supabase.core` (Postgres + RLS) | core + kernel | `users`, `partner_links`, `therapist_client_links`, `entries`, `shares` | No row is readable except by its owner, or by a partner with an **active link AND an explicit `shares` row**. A therapist has **no direct read** of `entries` (R3). Revoke takes effect on the next request. | wrap (Supabase) |
| `audit.log` (`private.audit_events`) | kernel | append-only hash-chained audit trail, gap-free `seq` | Rows cannot be updated or deleted by app roles; chain is verifiable; the `private` schema is not exposed in the Data API. | wrap (Postgres) |

Every user action goes through Supabase first, then reaches the other party. Each app keeps its own copy of the data it needs. (Stated)

## 3. Nodes and roles
| Node | One sentence | Role | Evidence |
|---|---|---|---|
| `supabase.core` | Decides who may read or write each entry. | Guard + owner of state | Verified: 176 pgTAP tests (12 files) pass on `main` (R3 run `45381458615` had 163; nested-query test added in PR #14, run `45556487549`); cloud `pg_policies` shows `entries_select_shared` with no therapist branch |
| `share_entry` RPC | The only path that creates a share: checks `auth.uid()`, entry ownership, recipient is not self, active link; one uniform error `share_not_allowed`. | Guard | Verified: migration `20261015100100_phase0_rls.sql` lines 100-127, cloud text matches logically (2026-11-22) |
| `audit.log` | Records writes through `private.write_audit_event`; verified by `private.verify_audit_events`. | Sink | Verified: PR #6, tests `08_audit_events`. **No function calls the writer yet** (allowlist is empty). |
| `edge.functions` | Home for audited RPC / Edge Functions (pinned `ca-central-1`) with Zod at every boundary. | Config / skeleton | Verified: `supabase/functions/health` and `_shared/schemas.ts` (PR #5). No real function yet. |
| `therapist.read-path` | Audited, atomic read of client data for the therapist (RPC / Edge Function). | Trigger + Guard | Missing. Proposed in Spec Addendum 001 (R2-R4, hybrid D4) |
| `client.app` | Login, mood check-in, reflections, share and revoke. | Trigger | Missing. Framework decided: Capacitor (D3, Stated 2026-11-25). First screen: login + mood check-in (Stated) |
| `therapist.dashboard` | Web view of what was shared with the therapist; assigns assessments later. | Sink | Missing. Waits for `therapist.read-path` and for D1 |
| `offline.queue` | Holds share requests while offline and sends them when the connection returns. | Config | Stated, not built |
| `notifications` | Generic text only, no clinical content in push or lock screen. | Sink | Proposed (Blueprint), not decided or built |
| `data.lifecycle` | Archive with recovery, therapist-chosen auto-delete, encrypted backup download, and a full-storage alert to the therapist. | Config | Stated, not built |
| `ci.guards` | pgTAP privacy tests plus evidence checks that fail when assertions are removed or policies loosened. | Guard (on changes) | Verified: workflows `db-tests.yml`, `evidence-checks.yml` |
| `platform + user` | OS (permissions, process kill, background limits) and the person (can revoke consent). | external, veto | Inferred |

## 4. Edges
| From -> To | Kind | Sync? | On failure | Evidence |
|---|---|---|---|---|
| `client.app` -> `supabase.core` (own entries, read own) | Command / Query, direct with RLS | sync | RLS denies, app shows an error | Stated (D4 hybrid) |
| `client.app` -> `share_entry` RPC | Command `ShareEntry` | sync, or queued when offline | uniform `share_not_allowed`; queued request is rejected on sync and the client is notified and can retry | Verified (RPC); queue Stated |
| `therapist.dashboard` -> `therapist.read-path` -> `supabase.core` | Query through an audited RPC | sync | denied, no partial result | Proposed (R2-R4) |
| `therapist.read-path` -> `audit.log` | Command `WriteAuditEvent` | must be atomic with the read | read must not return if the audit write fails | Proposed (R2) |
| `supabase.core` -> `notifications` | Event (a share arrived, a task was assigned) | async | drop or retry, never carry clinical text | Proposed |
| `data.lifecycle` -> `therapist` | Event (storage full) | async | Unknown | Stated |

## 5. Interaction matrix (pairs that matter only)
| A x B | Relation | Policy | Lives in | Test |
|---|---|---|---|---|
| Share x Partner link ended | requires | access needs an active link **at read time**, not only at share time | `entries_select_shared` policy | Verified: `04_links` test 9 (mutation check caught it) |
| Share x Revoke | orders | deleting the `shares` row removes access on the next request | RLS (no cache) | Inferred: revoke tests exist in the pgTAP suite (file numbers not re-checked). Client cache invalidation: Unknown |
| Therapist x Direct read | conflicts | no direct `SELECT`; only audited RPC | RLS + `therapist.read-path` | Verified: `10_r3_therapist_no_direct_read` and `12_r3_nested_query` (embedded queries; mutation run `45558424457` failed tests 8-11 only) |
| Therapist x Partner role (same person) | competes | **accepted**: such a person reads what was shared with them via the partner path | `entries_select_shared` | Verified: `11_r3_dual_role` characterizes it |
| Therapist read x Audit | requires | no read without an audit event | `therapist.read-path` | Missing |
| Offline share x Link ended while offline | competes | server decides on sync; client is notified | `share_entry` + `offline.queue` | Missing |
| New public table x API exposure | conflicts | new tables must not be open to `anon`/PUBLIC | CI test (option a, decided) + "Automatically expose new tables" is OFF | Partly: dashboard setting Verified; new CI test Unknown |

## 6. Scenarios (time and failure)
| Scenario | Expected behavior |
|---|---|
| Consent withdrawn or partner link ended mid-flow | Next read is denied by the read-time link check. Verified in DB tests. App-side cache: Unknown |
| Duplicate share request | One share per (entry, recipient). Inferred from the schema |
| Offline, then sync | Queued shares are sent automatically; a rejected one notifies the client, who can retry. Stated, not built |
| Process killed mid-share | Unknown |
| Therapist reads while the audit write fails | Must fail the read. Proposed, not built |
| Two operations at once (share + revoke) | Unknown |
| Platform veto (permissions revoked, background limits) | Unknown |
| Supabase storage full | Alert the therapist, who archives or deletes. Stated, not designed. Free tier also auto-pauses after 7 days idle (seen 2026-10-24) |

## 7. Unknowns and top 3 risks
**Top risks**
1. **D1, what the therapist may see (open, with the lawyer under D7).** The owner's instinct is that the therapist sees everything, including between partners. The database now enforces the opposite: no direct read, only what is shared, and only through a read path that does not exist yet. Needs a decision before the dashboard is built.
2. **No audited therapist read path.** "Every client-file access is audited" cannot be met by RLS alone. Until `therapist.read-path` exists, the therapist has no way to read shared data at all, and `audit.log` has no caller.
3. **Exposure drift on new objects.** Default privileges owned by `supabase_admin` still grant `anon` access to new public tables and functions; `rls_auto_enable()` is executable by `anon`/`authenticated`; sign-ups are still open on an invite-only app (Stated 2026-11-25: left open during the lab phase with synthetic data only; must be closed before the first real client). Cheap to check, easy to forget.

**Other unknowns (each with a cheap spike)**
- Framework (D3): decided, Capacitor (2026-11-25).
- Hosting and accounts: Supabase stays on Free until testing; Apple, Google and Supabase accounts are registered under the therapist app owner (Stated 2026-11-25).
- Offline and lifecycle ideas are `Stated` by the owner only: review them with the therapist before building.
- Behavior on a client's death or on moving to another therapist: Unknown, needs the owner and the lawyer.
- PostgREST nested-query test required by R3: done (PR #14, SQL forms of the embedded queries; a real HTTP-level test stays optional).

## 8. Handoff readiness
Not ready for UI. Missing: an owner for `therapist.read-path`, a decision on D1 (D3 is decided), and policies and tests for the offline and lifecycle cells in sections 4 and 5. Ready now: the database layer (every state has one writer, `shares`/`entries` access rules each have a test, and mutation checks prove the key tests can fail).

## Changelog
- **v1.1 (2026-11-25):** D3 decided (Capacitor), first UI screen decided, nested-query test merged (PR #14, 176 tests), no AI in the first release, open sign-up accepted only during the lab phase, Free plan and store accounts under the therapist owner.
- **v1.0 (2026-11-24):** first version after R3 (PR #13).
