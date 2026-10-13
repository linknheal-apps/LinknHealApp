import { User, PartnerLink, TherapistClientLink, Entry, Share } from '../types';

export const SEED_USERS: User[] = [
  {
    id: 'user-maya-001',
    role: 'client',
    name: 'Maya Lin',
    email: 'maya@example.com',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    created_at: '2026-09-01T08:00:00Z',
  },
  {
    id: 'user-leo-002',
    role: 'client',
    name: 'Leo Miller',
    email: 'leo@example.com',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    created_at: '2026-09-01T08:30:00Z',
  },
  {
    id: 'user-sarah-003',
    role: 'therapist',
    name: 'Dr. Sarah Vance, PsyD',
    email: 'dr.sarah@mindclinic.org',
    avatar: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150&auto=format&fit=crop&q=80',
    created_at: '2026-08-15T09:00:00Z',
  },
  {
    id: 'user-adversary-999',
    role: 'client',
    name: 'External / Adversarial Client',
    email: 'adversary@external.org',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    created_at: '2026-10-01T12:00:00Z',
  },
];

export const SEED_PARTNER_LINKS: PartnerLink[] = [
  {
    id: 'link-partner-001',
    client_id: 'user-maya-001',
    partner_id: 'user-leo-002',
    status: 'active',
    created_at: '2026-09-02T10:00:00Z',
  },
];

export const SEED_THERAPIST_CLIENT_LINKS: TherapistClientLink[] = [
  {
    id: 'link-tc-001',
    therapist_id: 'user-sarah-003',
    client_id: 'user-maya-001',
    status: 'active',
    created_at: '2026-09-03T14:00:00Z',
  },
  {
    id: 'link-tc-002',
    therapist_id: 'user-sarah-003',
    client_id: 'user-leo-002',
    status: 'active',
    created_at: '2026-09-03T14:15:00Z',
  },
];

export const SEED_ENTRIES: Entry[] = [
  {
    id: 'entry-maya-mood-01',
    owner_id: 'user-maya-001',
    entry_type: 'mood_checkin',
    body: {
      score: 2,
      label: 'Struggling',
      tags: ['Anxiety', 'Work Overload', 'Physical Tension'],
      note: 'Felt an anxiety surge during our 2 PM team call. Used the 4-7-8 breathing technique Dr. Sarah suggested. Kept this strictly private for personal reflection.',
    },
    created_at: '2026-10-10T14:35:00Z',
  },
  {
    id: 'entry-maya-reflection-02',
    owner_id: 'user-maya-001',
    entry_type: 'reflection',
    body: {
      prompt: 'Between-Session Observation',
      title: 'How we navigated dinner miscommunication yesterday',
      body: 'I noticed I withdrew when Leo brought up travel plans. I recognized the fight-or-flight shutdown and instead said I needed 10 minutes. When I returned, we talked calmly. Wanting Leo to see this progress.',
    },
    created_at: '2026-10-11T19:20:00Z',
  },
  {
    id: 'entry-maya-assessment-03',
    owner_id: 'user-maya-001',
    entry_type: 'assessment_response',
    body: {
      assessment_type: 'Weekly Emotional Regulation & Stress Inventory',
      answers: {
        emotional_exhaustion: 3,
        ability_to_ground: 4,
        conflict_recovery_speed: 3,
        safety_sense: 5,
      },
      summary_score: 15,
      reflection_note: 'Submitted for our upcoming Thursday session with Dr. Sarah.',
    },
    created_at: '2026-10-12T09:15:00Z',
  },
  {
    id: 'entry-leo-reflection-04',
    owner_id: 'user-leo-002',
    entry_type: 'reflection',
    body: {
      prompt: 'Personal Vulnerability Journal',
      title: 'Managing reactive irritation',
      body: 'Catching my urge to fix everything immediately instead of just holding space. Kept completely private in my personal vault.',
    },
    created_at: '2026-10-12T11:00:00Z',
  },
];

// Explicit shares:
// 1. entry-maya-reflection-02 is shared with Leo (Partner) ONLY
// 2. entry-maya-assessment-03 is shared with Dr. Sarah (Therapist) ONLY
// Note: entry-maya-mood-01 and entry-leo-reflection-04 have NO rows in shares (strictly PRIVATE).
export const SEED_SHARES: Share[] = [
  {
    id: 'share-001',
    entry_id: 'entry-maya-reflection-02',
    owner_id: 'user-maya-001',
    shared_with_user_id: 'user-leo-002',
    shared_at: '2026-10-11T19:22:00Z',
  },
  {
    id: 'share-002',
    entry_id: 'entry-maya-assessment-03',
    owner_id: 'user-maya-001',
    shared_with_user_id: 'user-sarah-003',
    shared_at: '2026-10-12T09:16:00Z',
  },
];
