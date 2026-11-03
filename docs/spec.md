# Feature Specification: Phase 0 — Privacy & Auth Foundation

## Why
Everything else in Link & Heal (mood check-ins, reflections, assessments,
couples space, therapist dashboard) depends on one guarantee: an entry is
never readable by anyone the owner didn't explicitly choose to share it with.
This phase builds and proves that guarantee before any feature UI exists.

## User Stories

### US1 — Owner reads their own data (P1)
As a client, I can create and read my own entries at any time, regardless of
sharing state.
**Acceptance**: A newly created entry is readable by its owner and by no one else by default.

### US2 — Partner cannot see unshared entries (P1)
As a client with a linked partner, my partner cannot read any entry of mine
that I have not explicitly shared with them — even though we are linked.
**Acceptance**: Adversarial test — partner B queries for partner A's private
entry and gets zero rows / access denied, not an error revealing existence.

### US3 — Sharing a specific entry grants access only to that entry (P1)
As a client, when I share one entry with my partner or therapist, only that
entry becomes readable to them — not my other entries.
**Acceptance**: After sharing entry X, reader can read X but still cannot read
entry Y (unshared).

### US4 — Therapist cannot see unshared entries (P1)
As a client, my linked therapist cannot read any entry I have not explicitly
shared with them, even though we have an active therapist-client link.
**Acceptance**: Same pattern as US2, therapist role.

### US5 — Revoking a share removes access (P2)
As a client, if I revoke a previously granted share, the other party can no
longer read that entry.
**Acceptance**: Delete the `shares` row → subsequent read attempt fails.

## Out of Scope for Phase 0
- Any UI beyond a minimal test/dev harness.
- Mood check-ins, reflections, or assessments as features (schema only).
- AI/BYOK anything.
- Clinical assessment content.

## Functional Requirements
- **FR1**: System MUST store every shareable entry with an `owner_id`.
- **FR2**: System MUST express all cross-user visibility through a single
  `shares` table (entry_id, owner_id, shared_with_user_id), where `entry_id` references the single `entries` supertable.
- **FR3**: System MUST enforce visibility via database-level RLS, not
  application-level filtering alone (defense in depth, but RLS is the
  authoritative boundary).
- **FR4**: System MUST deny access by default — absence of a `shares` row
  means no access, full stop.
- **FR5**: System MUST pass all adversarial tests in US2–US5 before Phase 0
  is considered complete.

## Success Criteria
- 100% of adversarial cross-access tests pass.
- A partner or therapist account, given only a valid session token, cannot
  read any entry not explicitly shared with them — verified by attempting
  the read directly against the database with that role's credentials, not
  just through the app UI.
