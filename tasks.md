# Tasks: Phase 0 — Privacy & Auth Foundation

## Setup
- [ ] T001 Initialize GitHub repo, connect to Codemagic (build only — no
      store submission yet, that's a later phase)
- [ ] T002 Choose and provision PostgreSQL (Supabase recommended default)
- [ ] T003 Set up API project skeleton (TypeScript)

## Schema
- [ ] T004 Create `users`, `partner_links`, `therapist_client_links` tables
- [ ] T005 Create `entries` (generic placeholder) and `shares` tables
- [ ] T006 Write migration scripts (not ad-hoc SQL run by hand)

## Security
- [ ] T007 Enable RLS on `entries` and `shares`
- [ ] T008 Write `entries_owner_all` and `entries_shared_read` policies
- [ ] T009 Write `shares_owner_manage` and `shares_visible_to_parties` policies

## Tests — write BEFORE marking any policy task "done" [P1]
- [ ] T010 [P] `test_owner_reads_own_entry`
- [ ] T011 [P] `test_partner_cannot_read_unshared_entry`
- [ ] T012 [P] `test_sharing_one_entry_does_not_leak_others`
- [ ] T013 [P] `test_therapist_cannot_read_unshared_entry`
- [ ] T014 [P] `test_revoked_share_removes_access`
- [ ] T015 [P] `test_ended_partner_link_does_not_grant_access`
- [ ] T016 `test_direct_db_query_respects_rls` (raw SQL, not via API)

*(`[P]` = can be written in parallel, independent of each other)*

## Verification
- [ ] T017 Claude independently re-runs the full test suite against the
      real database (not trusting Gemini's "tests pass" claim)
- [ ] T018 Claude spot-checks the actual RLS policy SQL via `diff` against
      what's committed (confirm no policy was silently loosened)

## Exit Criteria for Phase 0
All tasks above checked, all 7 tests passing, independently verified.
No entry, mood check-in, reflection, or UI work begins before this gate.
