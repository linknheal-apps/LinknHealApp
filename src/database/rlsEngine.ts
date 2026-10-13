import { Entry, Share, User, PartnerLink, TherapistClientLink, EntryType, EntryBody } from '../types';
import {
  SEED_USERS,
  SEED_PARTNER_LINKS,
  SEED_THERAPIST_CLIENT_LINKS,
  SEED_ENTRIES,
  SEED_SHARES,
} from './seedData';

const STORAGE_KEY_PREFIX = 'linknheal_rls_';

class PostgresRLSEngine {
  private users: User[] = [];
  private partnerLinks: PartnerLink[] = [];
  private therapistClientLinks: TherapistClientLink[] = [];
  private entries: Entry[] = [];
  private shares: Share[] = [];

  constructor() {
    this.loadState();
  }

  public loadState(): void {
    try {
      const storedUsers = localStorage.getItem(`${STORAGE_KEY_PREFIX}users`);
      const storedPartnerLinks = localStorage.getItem(`${STORAGE_KEY_PREFIX}partner_links`);
      const storedTcLinks = localStorage.getItem(`${STORAGE_KEY_PREFIX}tc_links`);
      const storedEntries = localStorage.getItem(`${STORAGE_KEY_PREFIX}entries`);
      const storedShares = localStorage.getItem(`${STORAGE_KEY_PREFIX}shares`);

      if (storedUsers && storedEntries && storedShares) {
        this.users = JSON.parse(storedUsers);
        this.partnerLinks = storedPartnerLinks ? JSON.parse(storedPartnerLinks) : [...SEED_PARTNER_LINKS];
        this.therapistClientLinks = storedTcLinks ? JSON.parse(storedTcLinks) : [...SEED_THERAPIST_CLIENT_LINKS];
        this.entries = JSON.parse(storedEntries);
        this.shares = JSON.parse(storedShares);
        return;
      }
    } catch (e) {
      console.warn('Failed to load from storage, using seed data', e);
    }

    this.resetToSeedData();
  }

  public saveState(): void {
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}users`, JSON.stringify(this.users));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}partner_links`, JSON.stringify(this.partnerLinks));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}tc_links`, JSON.stringify(this.therapistClientLinks));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}entries`, JSON.stringify(this.entries));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}shares`, JSON.stringify(this.shares));
    } catch (e) {
      console.error('Failed to save state to localStorage', e);
    }
  }

  public resetToSeedData(): void {
    this.users = JSON.parse(JSON.stringify(SEED_USERS));
    this.partnerLinks = JSON.parse(JSON.stringify(SEED_PARTNER_LINKS));
    this.therapistClientLinks = JSON.parse(JSON.stringify(SEED_THERAPIST_CLIENT_LINKS));
    this.entries = JSON.parse(JSON.stringify(SEED_ENTRIES));
    this.shares = JSON.parse(JSON.stringify(SEED_SHARES));
    this.saveState();
  }

  public getUsers(): User[] {
    return [...this.users];
  }

  public getUserById(id: string): User | undefined {
    return this.users.find(u => u.id === id);
  }

  public getPartnerLink(userId: string): { partner?: User; link?: PartnerLink } {
    const link = this.partnerLinks.find(
      l => l.client_id === userId || l.partner_id === userId
    );
    if (!link) return {};
    const partnerId = link.client_id === userId ? link.partner_id : link.client_id;
    const partner = this.users.find(u => u.id === partnerId);
    return { partner, link };
  }

  public setPartnerLinkStatus(linkId: string, status: 'active' | 'pending' | 'ended'): void {
    const link = this.partnerLinks.find(l => l.id === linkId);
    if (link) {
      link.status = status;
      this.saveState();
    }
  }

  public getTherapist(clientId: string): { therapist?: User; link?: TherapistClientLink } {
    const link = this.therapistClientLinks.find(l => l.client_id === clientId && l.status === 'active');
    if (!link) return {};
    const therapist = this.users.find(u => u.id === link.therapist_id);
    return { therapist, link };
  }

  public getTherapistClients(therapistId: string): User[] {
    const activeLinks = this.therapistClientLinks.filter(
      l => l.therapist_id === therapistId && l.status === 'active'
    );
    const clientIds = activeLinks.map(l => l.client_id);
    return this.users.filter(u => clientIds.includes(u.id));
  }

  // =========================================================================
  // AUTHORITATIVE ROW-LEVEL SECURITY EVALUATIONS
  // Exact replica of PostgreSQL policies defined in docs/plan.md
  // =========================================================================

  /**
   * RLS Evaluation for entries table:
   * Policy entries_owner_all: owner_id = current_user_id
   * Policy entries_shared_read: EXISTS (SELECT 1 FROM shares WHERE entry_id = entries.id AND shared_with_user_id = current_user_id)
   */
  public evaluateEntryRls(currentUserId: string, entry: Entry): { canRead: boolean; reason: string } {
    if (!currentUserId) {
      return { canRead: false, reason: 'DENIED: Unauthenticated session (current_user_id is NULL)' };
    }

    // Policy entries_owner_all
    if (entry.owner_id === currentUserId) {
      return { canRead: true, reason: 'ALLOWED: entries_owner_all (Owner reads own entry)' };
    }

    // Policy entries_shared_read
    const hasMatchingShare = this.shares.some(
      s => s.entry_id === entry.id && s.shared_with_user_id === currentUserId
    );

    if (hasMatchingShare) {
      return { canRead: true, reason: 'ALLOWED: entries_shared_read (Explicit share exists in shares table)' };
    }

    return {
      canRead: false,
      reason: 'DENIED: Default Deny. Neither owner nor explicit recipient in shares table',
    };
  }

  /**
   * Query entries with RLS enforced under the identity of currentUserId
   */
  public selectEntries(currentUserId: string): Entry[] {
    return this.entries.filter(entry => this.evaluateEntryRls(currentUserId, entry).canRead);
  }

  /**
   * Select a specific entry with RLS enforced.
   * If denied, returns null without leaking record existence.
   */
  public selectEntryById(currentUserId: string, entryId: string): Entry | null {
    const entry = this.entries.find(e => e.id === entryId);
    if (!entry) return null;
    const rls = this.evaluateEntryRls(currentUserId, entry);
    return rls.canRead ? entry : null;
  }

  /**
   * Insert entry with RLS enforced (owner_id MUST equal currentUserId)
   */
  public insertEntry(currentUserId: string, entryType: EntryType, body: EntryBody): Entry {
    if (!currentUserId) {
      throw new Error('RLS Violation: Cannot create entry without authenticated user');
    }

    const newEntry: Entry = {
      id: `entry-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      owner_id: currentUserId,
      entry_type: entryType,
      body,
      created_at: new Date().toISOString(),
    };

    this.entries.unshift(newEntry);
    this.saveState();
    return newEntry;
  }

  /**
   * Delete entry with RLS enforced (entries_owner_all)
   */
  public deleteEntry(currentUserId: string, entryId: string): boolean {
    const entryIndex = this.entries.findIndex(e => e.id === entryId);
    if (entryIndex === -1) return false;

    const entry = this.entries[entryIndex];
    if (entry.owner_id !== currentUserId) {
      throw new Error(`RLS Violation: User ${currentUserId} is not owner of entry ${entryId}`);
    }

    // Cascade delete shares
    this.shares = this.shares.filter(s => s.entry_id !== entryId);
    this.entries.splice(entryIndex, 1);
    this.saveState();
    return true;
  }

  // =========================================================================
  // SHARES TABLE OPERATIONS
  // =========================================================================

  /**
   * RLS Evaluation for shares table:
   * Policy shares_visible_to_parties: owner_id = current_user_id OR shared_with_user_id = current_user_id
   */
  public evaluateShareRls(currentUserId: string, share: Share): boolean {
    return share.owner_id === currentUserId || share.shared_with_user_id === currentUserId;
  }

  public selectShares(currentUserId: string, entryId?: string): Share[] {
    return this.shares.filter(share => {
      if (entryId && share.entry_id !== entryId) return false;
      return this.evaluateShareRls(currentUserId, share);
    });
  }

  /**
   * Share an entry with a specific user.
   * Enforces policy shares_owner_manage: owner_id = currentUserId.
   */
  public shareEntry(currentUserId: string, entryId: string, sharedWithUserId: string): Share {
    const entry = this.entries.find(e => e.id === entryId);
    if (!entry) {
      throw new Error('Entry not found');
    }

    // Must be entry owner to share
    if (entry.owner_id !== currentUserId) {
      throw new Error(`RLS Violation (shares_owner_manage): Only owner (${entry.owner_id}) can share this entry`);
    }

    // Avoid duplicate share
    const existing = this.shares.find(
      s => s.entry_id === entryId && s.shared_with_user_id === sharedWithUserId
    );
    if (existing) {
      return existing;
    }

    const newShare: Share = {
      id: `share-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      entry_id: entryId,
      owner_id: currentUserId,
      shared_with_user_id: sharedWithUserId,
      shared_at: new Date().toISOString(),
    };

    this.shares.push(newShare);
    this.saveState();
    return newShare;
  }

  /**
   * Revoke a share.
   * Enforces policy shares_owner_manage: owner_id = currentUserId.
   */
  public revokeShare(currentUserId: string, entryId: string, sharedWithUserId: string): boolean {
    const shareIndex = this.shares.findIndex(
      s => s.entry_id === entryId && s.shared_with_user_id === sharedWithUserId
    );
    if (shareIndex === -1) return false;

    const share = this.shares[shareIndex];
    if (share.owner_id !== currentUserId) {
      throw new Error(`RLS Violation (shares_owner_manage): Only owner (${share.owner_id}) can revoke this share`);
    }

    this.shares.splice(shareIndex, 1);
    this.saveState();
    return true;
  }

  /**
   * Execute a simulated raw database query under a specific session user.
   * Demonstrates that direct DB execution enforces RLS rather than relying on application code.
   */
  public executeRawQuery(asUserId: string, querySql: string): {
    rowCount: number;
    rows: any[];
    executionPlan: string[];
  } {
    const user = this.users.find(u => u.id === asUserId);
    const plan: string[] = [
      `SET LOCAL app.current_user_id = '${asUserId || 'NULL'}'; -- Role: ${user?.role || 'anonymous'}`,
      `EXPLAIN ANALYZE ${querySql}`,
      `-> Seq Scan on entries`,
      `   Filter: ((owner_id = '${asUserId}') OR (EXISTS (SELECT 1 FROM shares WHERE entry_id = entries.id AND shared_with_user_id = '${asUserId}')))`,
    ];

    if (querySql.toLowerCase().includes('from entries')) {
      const allowed = this.selectEntries(asUserId);
      return {
        rowCount: allowed.length,
        rows: allowed.map(e => ({
          id: e.id,
          owner_id: e.owner_id,
          entry_type: e.entry_type,
          created_at: e.created_at,
          body_summary: typeof e.body === 'object' ? JSON.stringify(e.body).substring(0, 50) + '...' : String(e.body),
        })),
        executionPlan: plan,
      };
    }

    if (querySql.toLowerCase().includes('from shares')) {
      const allowed = this.selectShares(asUserId);
      return {
        rowCount: allowed.length,
        rows: allowed,
        executionPlan: [
          `SET LOCAL app.current_user_id = '${asUserId || 'NULL'}';`,
          `Filter: (owner_id = '${asUserId}' OR shared_with_user_id = '${asUserId}')`,
        ],
      };
    }

    return {
      rowCount: 0,
      rows: [],
      executionPlan: [`Table not recognized in simulation`],
    };
  }
}

export const rlsEngine = new PostgresRLSEngine();
