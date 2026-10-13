# Link & Heal — Project Constitution

## Core Principles

### I. Privacy Is Structural, Not Cosmetic
No entry is visible to anyone but its owner unless an explicit row exists in the
`shares` table linking that specific entry to that specific reader. Visibility is
never inferred from a relationship (partner link, therapist link) alone.

### II. Verify, Never Trust
No agent's claim of "done" or "tests pass" is accepted without independent
verification (`grep`/`diff`/running the actual test suite). This applies most
strictly to the privacy/RLS layer.

### III. Adversarial Testing on the Privacy Layer Is Mandatory
Before any UI work begins, the privacy layer must have passing tests that
actively try to break isolation — e.g. one partner attempting to read the
other partner's private entry, a therapist attempting to read an entry never
shared with them. These tests are written before the corresponding feature
code, not after.

### IV. Real Infrastructure, Not Prototypes
There is no separate design/mockup/proof-of-concept phase (client decision).
Every piece built is production-track code from day one — including Phase 0's
auth and schema.

### V. Gated Features
- No AI/BYOK code until the client confirms who pays for AI costs.
- No clinical assessment logic until assessment licensing is confirmed.

## Technical Constraints
- Client mobile app: React + TypeScript + Vite + Tailwind + Capacitor (iOS + Android).
- Therapist dashboard: web-only React app.
- Database: PostgreSQL with real Row-Level Security (not the usual offline-first
  SQLite/Drizzle stack — this project is centralized and multi-user).
- Deployment: GitHub → Codemagic → Google Play Console + App Store Connect.
  No local Mac/PC required for building or signing.

## Workflow
- Gemini implements. Claude verifies with real tests before the next phase starts.
- ChatGPT performs independent periodic review; results cross-checked with Claude.
- English-only app (no Arabic/RTL requirements for this project).

## Governance
This constitution supersedes ad-hoc practice. Any change to Principles I–III
requires explicit re-confirmation, since they are the basis of the client's
core trust requirement (safe data separation between client, partner, and
therapist).

**Version**: 1.0.0 | **Ratified**: 2026-09-22
