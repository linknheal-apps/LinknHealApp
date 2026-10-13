# Reference — Link & Heal

**Status:** Phase 0 (foundation) — spec-kit delivered, Gemini building against it.
**Stack:** Frontend TBD (React Native/React + TypeScript candidate) · `Supabase`
(`PostgreSQL` + real RLS) · No separate design/mockup phase — client wants direct build +
iterate.

This file exists so the templates in `client-project-architect/SKILL.md` have one real,
filled example to imitate exactly — not just an empty table shape.

---

## Project Snapshot

- Client project, separate from the LifeCompanion ecosystem. English-only, therapist-first
  between-session companion app for singles and couples, with a therapist web dashboard.
- Compared 5 AI-generated product specs (including Ahmed's own) and synthesized the best
  ideas across them before committing to an architecture.
- **Decision:** Phase 0 = privacy/submission pipeline + adversarial RLS test suite, before
  couples, AI, or any other feature.
- **Decision:** `PostgreSQL` with real Row-Level Security is required (not the usual
  SQLite/Drizzle/Capacitor offline-first stack) — this project needs centralized multi-user
  RLS between therapist/client/partner.
- **Decision:** TDD is mandatory specifically on the privacy/visibility layer — adversarial
  cross-user-access tests written before any UI, verified independently by Claude before
  accepting Gemini's implementation.
- **Decision:** Using `Supabase` (Free tier to start), not self-hosted Postgres.
- Workflow: Gemini implements → Claude verifies with real tests → ChatGPT does independent
  periodic review.
- Hard gates: no AI/BYOK code until the client answers who pays for AI costs; no clinical
  assessment features until assessment licensing is confirmed.
- Delivered: `architecture.md` + Spec Kit artifacts (`constitution.md`, `spec.md`,
  `plan.md`, `tasks.md`) for Phase 0.
- 13 open client questions pending (paying customer, data ownership, jurisdiction,
  therapist verification, assessment licensing, AI cost/opt-in, therapist mobile app, EHR
  integration, crisis escalation policy, etc.) — sent via a client-facing decision brief.
- **Open architectural question to resolve before Gemini goes further than Phase 0:**
  whether visibility is modeled as a `content_visibility` column/enum on each table (as an
  external ChatGPT-drafted blueprint proposed) or via the single `shares` table Ahmed and
  Claude already designed. Not yet reconciled — flag before Phase 1 starts.

---

## Template 2 — Roles & Permission Matrix (filled)

| Role | Access |
|---|---|
| Therapist | Own clients' clinical records, assignments, measures, homework, resources, alerts, reports. |
| Adult client | Own data and assigned work. |
| Couple partner | Own private data + explicitly SHARED couple content. Never the other partner's PRIVATE data. |
| Teen | Own data; guardian access only where explicitly permitted. |
| Guardian | Only explicitly allowed information — no detailed teen answers by default. |

**Enforcement layer:** API authorization + `Supabase`/`PostgreSQL` RLS (defense in depth —
never UI-only). Every one of the rows above must have a corresponding RLS policy, not just
a client-side check.

---

## Template 4 — Data Visibility Model (filled)

| Visibility level | Who can see it |
|---|---|
| PRIVATE | Author + assigned therapist. Default for all new records. |
| SHARED | Both partners in a couple + assigned therapist. |
| CLINICAL_ONLY | Therapist only — used for sensitive clinical/safety information (e.g. IPV screening). |

Unauthorized records are **omitted** by the RLS policy/query, never merely hidden in the UI.
Separation or consent withdrawal must immediately revoke partner access — this is a
correctness requirement, test it explicitly (see Template 6 below).

---

## Template 5 — Threat Model (filled, partial — extend as Phase 1+ features land)

| Scenario | Defense |
|---|---|
| Partner A reads Partner B's PRIVATE record via UI, direct object ID, or raw API call | RLS policy denies at the database level, independent of API-layer checks — test all three access paths, not just the UI. |
| Push notification exposes clinical content on lock screen | Notification templates are generic by design ("You have a new update") — no clinical payload ever enters push text. |
| Lost/stolen client phone | PIN/biometric app unlock + session timeout + encrypted local data. |
| Compromised therapist account | 2FA + session controls + immutable audit log of every access. |

---

## Template 6 — Acceptance Criteria (filled, Phase 0 scope)

| Test | Pass condition |
|---|---|
| Partner isolation | Partner A cannot access Partner B's PRIVATE records through the UI, a guessed/direct API call, or a crafted object ID — verified by an automated adversarial test, not manual spot-checking. |
| `shares` table correctness | Revoking a share immediately removes access on the next request — no caching/staleness window. |
| RLS coverage | Every table holding client data has an active RLS policy; a query with no valid session returns zero rows, not an error leaking schema info. |

---

## Changelog
- Created alongside `client-project-architect` v1.0 as its first filled reference example,
  distilled from Link & Heal's project memory and the ChatGPT-generated Full Product &
  Technical Blueprint (Sept 2026).
