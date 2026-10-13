export type UserRole = 'client' | 'therapist';

export interface User {
  id: string;
  role: UserRole;
  name: string;
  email: string;
  avatar?: string;
  created_at: string;
}

export type LinkStatus = 'pending' | 'active' | 'ended';

export interface PartnerLink {
  id: string;
  client_id: string;
  partner_id: string;
  status: LinkStatus;
  created_at: string;
}

export interface TherapistClientLink {
  id: string;
  therapist_id: string;
  client_id: string;
  status: LinkStatus;
  created_at: string;
}

export type EntryType = 'mood_checkin' | 'reflection' | 'assessment_response';

export interface MoodPayload {
  score: number; // 1-5
  label: string; // 'Terrible' | 'Struggling' | 'Okay' | 'Good' | 'Thriving'
  tags: string[];
  note?: string;
}

export interface ReflectionPayload {
  prompt: string;
  title: string;
  body: string;
}

export interface AssessmentPayload {
  assessment_type: string; // e.g., 'Weekly Connection Pulse (PHQ-adapted)'
  answers: Record<string, number | string>;
  summary_score?: number;
  reflection_note?: string;
}

export type EntryBody = MoodPayload | ReflectionPayload | AssessmentPayload;

export interface Entry {
  id: string;
  owner_id: string;
  entry_type: EntryType;
  body: EntryBody;
  created_at: string;
}

export interface Share {
  id: string;
  entry_id: string;
  owner_id: string;
  shared_with_user_id: string;
  shared_at: string;
}

export interface TestResult {
  id: string;
  name: string;
  userStory: string;
  description: string;
  passed: boolean;
  durationMs: number;
  details: string;
  log: string[];
}
