# Privacy tests



Rules:



- Tests are adversarial: they try to BREAK isolation, not confirm the happy path.

- Run as the `authenticated` role with a real user identity. Never as `postgres` or `service_role` (they bypass RLS).

- Write the test BEFORE the policy it covers.

- Every test must seed rows and assert on them, so it cannot pass vacuously on an empty table.

- An unauthorized read must return zero rows, not an error that reveals the row exists.



Planned tests from docs/tasks.md (not written yet):



- test_owner_reads_own_entry

- test_partner_cannot_read_unshared_entry

- test_sharing_one_entry_does_not_leak_others

- test_therapist_cannot_read_unshared_entry

- test_revoked_share_removes_access

- test_ended_partner_link_does_not_grant_access

- test_direct_db_query_respects_rls



Additional tests required (gaps found in the plan review, not yet in docs/tasks.md):



- test_forged_share_on_foreign_entry_is_rejected

- test_ending_a_link_revokes_existing_shares

- test_anon_role_reads_zero_rows

- test_every_public_table_has_rls_enabled

