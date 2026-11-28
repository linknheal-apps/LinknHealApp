# APP_MAP (lab): Link & Heal Adversarial Lab (Build mode, Tier 0, 2026-11-26)

> Gate check: touches consent and sharing rules and stored personal data (synthetic only). Decisions on those stay with `lh-clinical-gates`, `lh-privacy-rls` and the open decisions N1 to N10 / D1 to D10. This map describes what the lab needs. It decides nothing clinical, legal or about retention.
> Evidence labels: `Stated` = the owner or the reviewed spec said it. `Proposed` = suggested here. `Unknown` = needs a spike.
> Scope: this map covers the lab (a dev tool) only. The product map is `APP_MAP.md`. Both update at milestones, not on a schedule (section 8).

## 1. Promise and non-goals
**Promise:** a non-programmer directing AI agents can run one command and get proof, not claims, that nobody can read an entry they were not given. A green result means the attacks really ran, and a deliberate leak really turns it red.
**Non-goals:** (1) not a product feature, no UI beyond a terminal and generated files; (2) never runs against production or real data; (3) never decides clinical, legal or retention policy.

## 2. Cores
| Node | Class | Owns state | Invariants | build / wrap / use |
|---|---|---|---|---|
| `verdict.gate` | **core** | the rule "when does a result count" | A negative counts only with a positive control. A file with zero real assertions fails. A disappeared test ID fails. A mutant counts only if `KILLED`. Missing evidence is `INCOMPLETE`, never green. | build |
| `seed.manifest` | **kernel** | the truth table of who may read what (cast A to Z, DR1, sentinels) | Same seed gives same IDs. Seeding twice leaves no duplicates. Every check reads authorization from the manifest, not from the app under test. | build |
| `pgTAP`, `supabase test db`, Node, `PostgREST` | generic | none | n/a | use |

Removal test: remove `verdict.gate` and the lab still runs but proves nothing, so the promise dies. Remove the roadmap generator and only a convenience dies.

## 3. Nodes and roles
| Node | One sentence | Role | Evidence |
|---|---|---|---|
| `lab.interlock` | Refuses to start unless the target is local or an allowlisted synthetic staging DB with the `lab_synthetic` marker and seed nonce. | Guard | Stated (G1, G7, v0.2) |
| `identity.helper` | `tests.authenticate(uuid)` sets role and JWT claims together, then asserts `auth.uid()`. | Guard | Stated (G1) |
| `seed.runner` | Builds the cast and the manifest, then the control gate aborts the run if an authorized read fails. | Trigger | Stated |
| `suite.sql` | pgTAP files run as `authenticated`/`anon` inside `begin; rollback;`. | Trigger | Stated (G8) |
| `suite.api` | HTTP attacks with real JWTs, twin-ID comparison, PostgREST oracles. | Trigger | Stated |
| `suite.privileged` | Physical row counts and audit tamper as `postgres`, in its own folder, never counted as app-role tests. | Trigger (isolated) | Stated (G1 exception) |
| `race.harness` | Two connections, forced interleaving, lock-wait is the assertion. | Trigger | Stated (FL-03) |
| `mutation.engine` | Loosens each policy, function and grant from `pg_policy`, classifies `KILLED/INVALID/MASKED/SURVIVED`, restores. | Trigger + Guard | Stated (G13) |
| `canary.scanner` | Searches outputs for sentinels the reader was not allowed to see. | Sink | Stated (CAN-01) |
| `blocked.registry` | Holds rows tied to an open decision, excluded from `plan(N)`. | Config | Stated (G11) |
| `evidence.packer` | Writes `evidence/<utc>-<sha>/` and `evidence/latest`, bound to commit and migration hash. | Sink | Stated (section 9) |
| `roadmap.gen` | Computes status from the lab app map, results and evidence, writes the lab roadmap. | Sink | Stated (M7), Proposed (script) |
| `milestone.sync` | At a big step, writes a proposal to update the main roadmap and the product map. Never edits them. | Sink | Proposed |
| External: agents, OS, Supabase version | Agents may edit tests or seed. Supabase/PostgREST behavior can change between versions. | external, veto | Stated |

Twelve working nodes plus the external ones. At the Tier 0 cap, so details stay in the spec.

## 4. Edges
| From -> To | Kind | Sync? | On failure | Evidence |
|---|---|---|---|---|
| `lab.interlock` -> everything | Command (`Start` allowed or denied) | sync | exit non-zero before any statement | Stated |
| `seed.runner` -> `seed.manifest` | Event `SeedCompleted(hash)` | sync | abort run | Proposed |
| `seed.manifest` -> `suite.*`, `canary.scanner` | Read model (expected access) | sync | run `INCOMPLETE` | Stated |
| `identity.helper` -> `suite.sql` | Direct call | sync | test fails (self-check) | Stated |
| `suite.*` -> `verdict.gate` | Event `TestResult` | async | missing results are `INCOMPLETE` | Stated |
| `mutation.engine` -> `suite.*` | Command `Mutate(target)` then `Restore` | sync | if restore fails: full `db reset`, run marked `DIRTY` | Proposed |
| `verdict.gate` -> `evidence.packer` | Event `VerdictReady` | sync | no pack, no `verified` | Stated |
| `evidence.packer` -> `roadmap.gen` | Event `EvidenceWritten(sha, hash)` | sync | stale evidence downgrades `verified` to `built` | Stated, tested |
| `roadmap.gen` -> `milestone.sync` | Event `MilestoneRequested(name)` | manual | none | Proposed |

## 5. Interaction matrix (pairs that matter)
| A x B | Relation | Policy | Lives in | Test |
|---|---|---|---|---|
| `mutation.engine` x `seed.manifest` | competes | Seed error during a mutant run is `INVALID`, not a kill | `verdict.gate` | MRG-05 case |
| `blocked.registry` x `plan(N)` | conflicts if mixed | Blocked IDs never count in `plan(N)` | `verdict.gate` | lint compares plan vs non-blocked |
| `suite.privileged` x `G1` | conflicts | Separate folder, needs marker row, not counted | `lab.interlock` | runner on unmarked DB exits non-zero |
| `evidence.packer` x `roadmap.gen` | requires | `verified` needs migration hash equal to current | `roadmap.gen` | edit a migration, expect downgrade (tested in this build) |
| `canary.scanner` x `evidence.packer` | conflicts | Scan evidence for tokens and sentinels before packing | `evidence.packer` | SUR-17 |
| `agents` x `suite.*` / `seed.*` | competes | Protected paths, ID inventory, seed hash must match reviewed | `verdict.gate` + CI | delete one test, expect "ID disappeared" |
| `race.harness` x `mutation.engine` | competes | Never run at the same time on one DB | `lab.interlock` (lock file) | start two, second refuses |

## 6. Scenarios (time and failure)
| Scenario | Expected |
|---|---|
| Process killed mid-run | Partial folder is marked `INCOMPLETE`, never `latest`. |
| Killed after a mutation, before restore | Next start detects the mutant marker, forces `db reset`, flags `DIRTY`. |
| `results.json` missing or malformed | All features stay `built` at best. |
| Migration changed after the last green run | Feature drops from `verified` to `built`. |
| Two runs on one DB | Second refuses (lock file). |
| Agent deletes a failing test | CI fails: "ID disappeared". |
| Agent edits `app-map.lab.json` to look done | Status is computed from files, tests and mutants, so it does not change. The protected path also needs the owner's review. |
| Supabase or PostgREST upgraded | Pin versions in evidence. A behavior change shows as a changed result. |
| Open decision answered (for example N3) | Owner removes it from `blocked_by` in a reviewed PR, rows move out of the registry. |

## 7. Unknowns and top 3 risks
Unknowns, each with a cheap spike: pooler behavior of `SET LOCAL` and prepared statements (SUR-12); whether signed URLs are revoke-aware (ST-01, run early); `\ddp` default privileges on the deployed project (SUR-03); whether the lock-wait trick reaches the `create_share` interleaving (FL-03); PostgREST version features such as `Prefer` handling.
Top risks: (1) a green suite that proves nothing (vacuous or masked tests); (2) the agent that writes the code also editing the lab; (3) the lab pointed at real data by mistake.

## 8. Handoff readiness and update rule
Every node has an owner and one writer for its state; every edge has a failure behavior; each non-independent pair has a policy and a test; each unknown has a spike. Not yet true: the files do not exist, so `roadmap.gen` honestly shows 0 verified.

**Update rule (Stated by the owner):**
- `docs/lab/ROADMAP.lab.json` regenerates **automatically** at the end of every `npm run lab`, from `app-map.lab.json` and CI evidence.
- The main `docs/ROADMAP.json` and `APP_MAP.md` update **only at milestones**, through `node scripts/lab-roadmap.mjs --milestone <name>`, which writes a proposal file for a reviewed PR.
- Milestones: `M-A-thin-slice` (deliberate leak turns red), `M-B-phase0-privacy` (L-03 to L-07 verified), `M-C-breakup-core` (L-08, L-10 verified), `M-D-p1-tables` (L-13 verified), `M-E-device` (L-14 done on real devices).
