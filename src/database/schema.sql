-- =========================================================================
-- Link & Heal — Phase 0: Privacy & Auth Foundation Database Schema & RLS
-- As ratified in docs/plan.md, docs/spec.md, and docs/constitution.md
-- =========================================================================

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL CHECK (role IN ('client', 'therapist')),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Partner Links Table (Relationship status does NOT infer data visibility)
CREATE TABLE IF NOT EXISTS partner_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'ended')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Therapist-Client Links Table (Links therapist with client)
CREATE TABLE IF NOT EXISTS therapist_client_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'ended')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Entries Table (Mood check-ins, reflections, assessment responses)
CREATE TABLE IF NOT EXISTS entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('mood_checkin', 'reflection', 'assessment_response')),
  body JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Shares Table: The Single Authoritative Source of Cross-User Visibility
CREATE TABLE IF NOT EXISTS shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shared_with_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shared_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (entry_id, shared_with_user_id)
);

-- =========================================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- =========================================================================

ALTER TABLE entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE shares ENABLE ROW LEVEL SECURITY;

-- Policy 1: Owner can always read/write/modify their own entries
CREATE POLICY entries_owner_all ON entries
  FOR ALL
  USING (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::UUID)
  WITH CHECK (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::UUID);

-- Policy 2: Others can SELECT only if an explicit row exists in shares table
CREATE POLICY entries_shared_read ON entries
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM shares
      WHERE shares.entry_id = entries.id
        AND shares.shared_with_user_id = NULLIF(current_setting('app.current_user_id', true), '')::UUID
    )
  );

-- Policy 3: Only the entry owner can create or delete shares for their own entries
CREATE POLICY shares_owner_manage ON shares
  FOR ALL
  USING (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::UUID)
  WITH CHECK (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::UUID);

-- Policy 4: A user can read a share row if they are the owner or the recipient
CREATE POLICY shares_visible_to_parties ON shares
  FOR SELECT
  USING (
    owner_id = NULLIF(current_setting('app.current_user_id', true), '')::UUID
    OR shared_with_user_id = NULLIF(current_setting('app.current_user_id', true), '')::UUID
  );
