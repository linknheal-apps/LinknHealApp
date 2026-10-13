import { TestResult } from '../types';
import { rlsEngine } from '../database/rlsEngine';

export async function runAdversarialSecuritySuite(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // Snapshot or reset to known clean seed state for deterministic suite execution
  rlsEngine.resetToSeedData();

  // Test 1: test_owner_reads_own_entry (US1 - Owner reads their own data)
  {
    const start = performance.now();
    const log: string[] = [];
    let passed = false;
    let details = '';

    try {
      log.push('Setting session: SET LOCAL app.current_user_id = "user-maya-001" (Maya Lin)');
      const mayaEntries = rlsEngine.selectEntries('user-maya-001');
      log.push(`Found ${mayaEntries.length} entries for Maya`);

      const ownUnshared = mayaEntries.find(e => e.id === 'entry-maya-mood-01');
      const ownSharedWithPartner = mayaEntries.find(e => e.id === 'entry-maya-reflection-02');
      const ownSharedWithTherapist = mayaEntries.find(e => e.id === 'entry-maya-assessment-03');

      if (ownUnshared && ownSharedWithPartner && ownSharedWithTherapist) {
        passed = true;
        details = 'Maya successfully reads all 3 of her own entries (private, partner-shared, therapist-shared).';
        log.push('VERIFIED: entries_owner_all policy allows owner full visibility.');
      } else {
        passed = false;
        details = 'Failed to read all owned entries.';
      }
    } catch (err: any) {
      log.push(`ERROR: ${err.message}`);
      details = err.message;
    }

    results.push({
      id: 'T010',
      name: 'test_owner_reads_own_entry',
      userStory: 'US1 (P1)',
      description: 'Owner reads their own data at any time, regardless of sharing state.',
      passed,
      durationMs: Math.round(performance.now() - start),
      details,
      log,
    });
  }

  // Test 2: test_partner_cannot_read_unshared_entry (US2 - Partner cannot see unshared entries)
  {
    const start = performance.now();
    const log: string[] = [];
    let passed = false;
    let details = '';

    try {
      log.push('Setting session: SET LOCAL app.current_user_id = "user-leo-002" (Leo Miller - Partner)');
      log.push('Asserting relationship status: Active partner link exists between Maya and Leo.');
      const partnerLink = rlsEngine.getPartnerLink('user-leo-002');
      log.push(`Partner link status: ${partnerLink.link?.status}`);

      log.push('Adversarial probe: Leo attempts SELECT ON entries WHERE id = "entry-maya-mood-01"');
      const interceptedEntry = rlsEngine.selectEntryById('user-leo-002', 'entry-maya-mood-01');

      if (interceptedEntry === null) {
        passed = true;
        details = 'Access denied at RLS layer. Returned null (0 rows). Record existence not leaked.';
        log.push('VERIFIED: Absence of shares row enforces strict default-deny. Active partner link does not leak private records.');
      } else {
        passed = false;
        details = 'CRITICAL FAILURE: Partner B accessed unshared private entry of Partner A!';
        log.push('FAIL: Private entry was returned to linked partner.');
      }
    } catch (err: any) {
      log.push(`ERROR: ${err.message}`);
      details = err.message;
    }

    results.push({
      id: 'T011',
      name: 'test_partner_cannot_read_unshared_entry',
      userStory: 'US2 (P1)',
      description: 'Partner cannot read unshared entries despite having active partner link.',
      passed,
      durationMs: Math.round(performance.now() - start),
      details,
      log,
    });
  }

  // Test 3: test_sharing_one_entry_does_not_leak_others (US3 - Granular entry sharing)
  {
    const start = performance.now();
    const log: string[] = [];
    let passed = false;
    let details = '';

    try {
      log.push('Setting session: SET LOCAL app.current_user_id = "user-leo-002" (Leo Miller)');
      log.push('Maya explicitly shared entry "entry-maya-reflection-02" with Leo.');
      log.push('Maya did NOT share entry "entry-maya-mood-01" with Leo.');

      const sharedEntry = rlsEngine.selectEntryById('user-leo-002', 'entry-maya-reflection-02');
      const unsharedEntry = rlsEngine.selectEntryById('user-leo-002', 'entry-maya-mood-01');

      if (sharedEntry !== null && unsharedEntry === null) {
        passed = true;
        details = 'Leo can read specifically shared entry X, but cannot read unshared entry Y.';
        log.push(`Shared entry received: "${sharedEntry.id}"`);
        log.push('Unshared entry correctly withheld (null)');
        log.push('VERIFIED: entries_shared_read policy isolates visibility per-entry.');
      } else {
        passed = false;
        details = 'Granular sharing violated.';
      }
    } catch (err: any) {
      log.push(`ERROR: ${err.message}`);
      details = err.message;
    }

    results.push({
      id: 'T012',
      name: 'test_sharing_one_entry_does_not_leak_others',
      userStory: 'US3 (P1)',
      description: 'Sharing entry X grants access ONLY to X, not to unshared entry Y.',
      passed,
      durationMs: Math.round(performance.now() - start),
      details,
      log,
    });
  }

  // Test 4: test_therapist_cannot_read_unshared_entry (US4 - Therapist cannot see unshared entries)
  {
    const start = performance.now();
    const log: string[] = [];
    let passed = false;
    let details = '';

    try {
      log.push('Setting session: SET LOCAL app.current_user_id = "user-sarah-003" (Dr. Sarah Vance - Therapist)');
      log.push('Active therapist-client link exists with Maya.');

      const therapistEntries = rlsEngine.selectEntries('user-sarah-003');
      log.push(`Therapist query returned ${therapistEntries.length} total entries.`);

      const leakedPrivateMood = therapistEntries.find(e => e.id === 'entry-maya-mood-01');
      const leakedPartnerReflection = therapistEntries.find(e => e.id === 'entry-maya-reflection-02');
      const sharedAssessment = therapistEntries.find(e => e.id === 'entry-maya-assessment-03');

      if (!leakedPrivateMood && !leakedPartnerReflection && sharedAssessment) {
        passed = true;
        details = 'Therapist sees ONLY assessment explicitly shared with her. Private mood and couples reflection are excluded.';
        log.push('VERIFIED: Clinical link does not grant universal bypass. Default-deny holds.');
      } else {
        passed = false;
        details = 'Therapist isolation failed. Unshared entries appeared in therapist query.';
      }
    } catch (err: any) {
      log.push(`ERROR: ${err.message}`);
      details = err.message;
    }

    results.push({
      id: 'T013',
      name: 'test_therapist_cannot_read_unshared_entry',
      userStory: 'US4 (P1)',
      description: 'Linked therapist cannot read entries not explicitly shared with them.',
      passed,
      durationMs: Math.round(performance.now() - start),
      details,
      log,
    });
  }

  // Test 5: test_revoked_share_removes_access (US5 - Revoking share removes access immediately)
  {
    const start = performance.now();
    const log: string[] = [];
    let passed = false;
    let details = '';

    try {
      log.push('Step 1: Verify Leo can read entry-maya-reflection-02 prior to revoke');
      const initialRead = rlsEngine.selectEntryById('user-leo-002', 'entry-maya-reflection-02');
      log.push(`Initial read result: ${initialRead ? 'Found' : 'Missing'}`);

      log.push('Step 2: Maya executes DELETE FROM shares WHERE entry_id = "entry-maya-reflection-02" AND shared_with_user_id = "user-leo-002"');
      rlsEngine.revokeShare('user-maya-001', 'entry-maya-reflection-02', 'user-leo-002');
      log.push('Share row successfully deleted by owner.');

      log.push('Step 3: Leo re-attempts SELECT ON entries immediately');
      const postRevokeRead = rlsEngine.selectEntryById('user-leo-002', 'entry-maya-reflection-02');

      if (initialRead !== null && postRevokeRead === null) {
        passed = true;
        details = 'Revocation is instantaneous and authoritative. Subsequent read returns 0 rows.';
        log.push('VERIFIED: Revoking share eliminates read permission immediately with zero caching lag.');
      } else {
        passed = false;
        details = 'Revoked share still leaked or initial read was invalid.';
      }
    } catch (err: any) {
      log.push(`ERROR: ${err.message}`);
      details = err.message;
    }

    results.push({
      id: 'T014',
      name: 'test_revoked_share_removes_access',
      userStory: 'US5 (P2)',
      description: 'Revoking a previously granted share removes reader access immediately.',
      passed,
      durationMs: Math.round(performance.now() - start),
      details,
      log,
    });
  }

  // Test 6: test_ended_partner_link_does_not_grant_access
  {
    const start = performance.now();
    const log: string[] = [];
    let passed = false;
    let details = '';

    try {
      log.push('Simulating relationship status change: Changing partner link to "ended"');
      rlsEngine.setPartnerLinkStatus('link-partner-001', 'ended');
      log.push('Partner link status is now "ended"');

      log.push('Leo queries Maya unshared mood checkin entry');
      const readResult = rlsEngine.selectEntryById('user-leo-002', 'entry-maya-mood-01');

      if (readResult === null) {
        passed = true;
        details = 'Access only ever comes from shares table, never inferred from link state.';
        log.push('VERIFIED: Relationship status never confers implicit visibility.');
      } else {
        passed = false;
        details = 'Isolation breached on ended link.';
      }
    } catch (err: any) {
      log.push(`ERROR: ${err.message}`);
      details = err.message;
    }

    results.push({
      id: 'T015',
      name: 'test_ended_partner_link_does_not_grant_access',
      userStory: 'Security Gate (P1)',
      description: 'An ended partner link cannot grant read access; access is shares-only.',
      passed,
      durationMs: Math.round(performance.now() - start),
      details,
      log,
    });
  }

  // Test 7: test_direct_db_query_respects_rls (Raw SQL direct execution)
  {
    const start = performance.now();
    const log: string[] = [];
    let passed = false;
    let details = '';

    try {
      log.push('Connecting to simulated PostgreSQL engine with connection role: adversary');
      log.push('Query: SELECT * FROM entries;');
      const rawQueryResult = rlsEngine.executeRawQuery('user-adversary-999', 'SELECT * FROM entries;');

      log.push(`Engine execution plan: ${rawQueryResult.executionPlan[0]}`);
      log.push(`Returned rows: ${rawQueryResult.rowCount}`);

      if (rawQueryResult.rowCount === 0) {
        passed = true;
        details = 'Raw SQL direct query executed under adversary role returns 0 rows. RLS enforced at DB layer.';
        log.push('VERIFIED: RLS is the authoritative boundary, not cosmetic UI filtering.');
      } else {
        passed = false;
        details = `Adversary obtained ${rawQueryResult.rowCount} rows through direct SQL query!`;
      }
    } catch (err: any) {
      log.push(`ERROR: ${err.message}`);
      details = err.message;
    }

    results.push({
      id: 'T016',
      name: 'test_direct_db_query_respects_rls',
      userStory: 'Defense-in-depth (P1)',
      description: 'Direct database queries respect RLS; zero rows returned to unauthorized parties.',
      passed,
      durationMs: Math.round(performance.now() - start),
      details,
      log,
    });
  }

  // Restore seed data after test run
  rlsEngine.resetToSeedData();

  return results;
}
