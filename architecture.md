# Link & Heal — System Architecture

## 1. Product Summary
Therapist-first "between sessions" companion app. Clients (individuals or couples) check in on mood, complete therapist-assigned assessments, and write private reflections. Selected entries can be shared with a partner and/or a therapist — sharing is always an explicit, per-entry choice, never automatic. Therapists use a separate web dashboard to view what has been shared with them and assign assessments.

## 2. Components

```
┌─────────────────────┐     ┌─────────────────────┐
│  Client Mobile App   │     │ Therapist Web Dash   │
│  React+TS+Capacitor  │     │  React+TS (web only) │
│  (iOS + Android)     │     │                       │
└──────────┬───────────┘     └───────────┬───────────┘
           │                             │
           │        HTTPS / REST or RPC  │
           └──────────────┬──────────────┘
                           │
                  ┌────────▼────────┐
                  │   API Layer     │
                  │ (auth, business │
                  │  logic)         │
                  └────────┬────────┘
                           │
                  ┌────────▼────────┐
                  │   PostgreSQL    │
                  │  + Row-Level    │
                  │   Security      │
                  └─────────────────┘
```

- **Client mobile app**: React + TypeScript + Vite + Tailwind + Capacitor. Same codebase targets iOS and Android via Capacitor's native shells — no separate native rewrite.
- **Therapist dashboard**: web-only React app (no Capacitor needed — therapists work from a browser/desktop in this phase; therapist mobile access was flagged as an open client question, not yet decided).
- **Database**: PostgreSQL with real RLS — this project is centralized/multi-user, unlike Ahmed's usual offline-first SQLite/Drizzle stack, because client, partner, and therapist all need controlled access to overlapping data.

## 3. Core Domain Entities (draft — confirm in Phase 0 data-model.md)

| Table | Purpose |
|---|---|
| `users` | id, role (`client` \| `therapist`), auth fields |
| `therapist_client_links` | therapist_id, client_id, status (pending/active/ended) |
| `partner_links` | client_id, partner_id, status — couples relationship |
| `mood_checkins` | owner_id, mood, tags[], note, created_at |
| `reflections` | owner_id, body, created_at |
| `assessment_responses` | owner_id, assessment_type, answers, created_at |
| `shares` | entry_type, entry_id, owner_id, shared_with_user_id, shared_at |

**The `shares` table is the single source of truth for visibility.** No entry is readable by anyone but its owner unless a matching row exists in `shares`. This is what Phase 0's RLS policies and adversarial tests are built against.

## 4. Access Model
- **Owner** always has full read/write on their own entries.
- **Partner** can read an entry only if a `shares` row exists linking that entry to the partner's user id.
- **Therapist** can read an entry only if a `shares` row exists linking that entry to the therapist's user id.
- A partner can never read another partner's entries through any indirect path (e.g. via a shared relationship record) — only through an explicit `shares` row on that specific entry.

## 5. Deployment Pipeline
1. Code lives in a GitHub repo (Gemini commits, Claude verifies via `grep`/`diff`/tests before merge).
2. Codemagic is connected to the repo.
3. Codemagic builds the Android `AAB` and iOS `IPA` from the same Capacitor codebase — no local Mac/PC required.
4. Codemagic submits builds to Google Play Console and App Store Connect via API.
5. Signing/certificates managed by Codemagic (no manual Mac-based signing step).

**Prerequisites not yet in place:** Apple Developer Program account ($99/yr), Google Play Console account ($25 one-time) — need to be registered under whichever party (client or Ahmed) legally owns the app listing.

## 6. Explicit Non-Goals for Now (client-confirmed gates)
- No AI/BYOK code until client answers who pays for AI costs.
- No clinical assessment features until assessment licensing is confirmed.
- No design/mockup phase — client wants direct, iterative building.
