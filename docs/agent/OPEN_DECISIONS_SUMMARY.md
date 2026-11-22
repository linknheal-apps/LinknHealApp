# Open Decisions & Questions Summary

**Audit Date:** 2026-11-22  
**Branch:** `agent/audit-2026-11-22`  
**Sources Inspected:**
- `docs/decisions-form.html` (embedded decision matrix `#qdata`)
- `docs/ROADMAP.json` (decisions D1, D3, D5, D6, D7, D8, D9, D10 and phase blockers)
- `docs/spec-addendum-001-d4-api-layer.md`
- `docs/link-and-heal-reference.md`

**File Search Status:**
- `APP_MAP.md` / App Map file: **NOT FOUND** in `docs/` or repository root. Logged as draft in `docs/ROADMAP.json:89` (`["APP_MAP.md: مسودة للمراجعة", "g", "مش متأكد إنها اتحطت في الـ repo"]`).
- `decisions-form.html`: Located at `docs/decisions-form.html` (absent from root, present under `docs/`).

---

## 1. Architectural & Roadmap Decision Gates (D1 – D10)

From `docs/ROADMAP.json` and `docs/spec-addendum-001-d4-api-layer.md`:

| Decision ID | Topic / Question | Documented Status & Options | Feature / Phase Blocked |
|---|---|---|---|
| **D1** | Therapist Data Visibility Scope: Can therapist see unshared client entries or shared-only? | Open. Options: (1) Shared-only, (2) Everything, (3) Client opt-in. | Blocks Rule R3 migration and Therapist Web Dashboard (`ROADMAP.json:90`) |
| **D2** | Data Model: Supertype entries table vs. separate tables per feature | Decided. One generic `entries` supertype table with `shares.entry_id` foreign key. | Implemented in Phase 0 schema migration |
| **D3** | Frontend Mobile Framework: Capacitor vs. React Native | Open. Options: (1) Capacitor (current leaning), (2) React Native. | Blocks Mobile UI implementation (`ROADMAP.json:107`) |
| **D4** | API Layer Architecture: Standalone NestJS server vs. Direct PostgREST + RPC | Decided. Hybrid model: Direct PostgREST for own data, audited RPCs for therapist reads/mutations. | Release 1 architecture decided (Spec Addendum 001) |
| **D5** | Database Hosting Tier: Free tier vs. Paid tier | Open. Options: Paid managed Supabase tier required before real client data. | Blocks production deployment with real client data |
| **D6** | Clinical Risk / Harm Disclosure Handling | Open. Options: (1) Real-time alert, (2) Static crisis screen, (3) Hybrid. | Blocks Alert pipeline implementation |
| **D7** | Legal Jurisdiction & Governing Privacy Rules | Open. Options: Alberta (HIA), Canada federal (PIPEDA), USA (HIPAA), EU/UK (GDPR). | Blocks Launch gate and legal consent drafting |
| **D8** | Assessment Questionnaires & Licensing | Open. Options: (1) One assessment only, (2) PHQ-9 and GAD-7, (3) Other. | Blocks Assessment feature code (hard gate) |
| **D9** | In-App Account Deletion vs. Clinical Record Retention | Open. Options: In-app full deletion vs. retaining audit ledger & clinical records with pseudonymous IDs. | Blocks App Store submission compliance |
| **D10** | Apple & Google Developer Account Ownership | Open. Options: (1) Client personally, (2) Developer on behalf, (3) Company account. | Blocks App Store & Google Play submission |

---

## 2. Product & Clinical Questions (`P1` – `P21`)

Verbatim options and blocking annotations from `docs/decisions-form.html`:

### P1
* **Question:** When a client discloses a risk of harm (for example PHQ-9 item 9), what should the app do?
* **Category:** Product & clinical | **Importance:** Critical
* **Why it matters:** Decides whether we build alert delivery or only a static crisis-resources screen. Alerts can imply 24/7 monitoring.
* **Blocks:** D6 · alert pipeline
* **Options:**
  - Real-time alert to the therapist
  - Static crisis resources only
  - Both (hybrid)
  - Not decided yet

### P2
* **Question:** If alerts are used: who receives them, by which channel (push, email, SMS), and what happens outside working hours?
* **Category:** Product & clinical | **Importance:** Critical
* **Why it matters:** Prevents a disclosed risk sitting unseen for days and sets honest wording shown to clients.
* **Blocks:** D6
* **Type:** Free text / Comment

### P3
* **Question:** Who writes and approves the crisis wording and the list of crisis resources (hotlines) for your region?
* **Category:** Product & clinical | **Importance:** Critical
* **Why it matters:** Developers and AI must not write crisis text. We need a named owner.
* **Blocks:** Crisis screen
* **Type:** Free text / Comment

### P4
* **Question:** Can the therapist see client entries that the client did not share?
* **Category:** Product & clinical | **Importance:** Critical
* **Why it matters:** This is the core privacy rule. Our documents disagree today, so it has to come from you.
* **Blocks:** D1 · privacy rules (RLS)
* **Options:**
  - No, only what the client submits
  - Yes, always
  - Only if the client opts in
  - Not decided yet

### P5
* **Question:** Which assessments should Release 1 include?
* **Category:** Product & clinical | **Importance:** Critical
* **Why it matters:** One type keeps scope small; two covers depression and anxiety.
* **Blocks:** D8
* **Options:**
  - One assessment only
  - PHQ-9 and GAD-7
  - Other (explain in notes)
  - Not decided yet

### P6
* **Question:** Is the licence or permission to use the chosen questionnaires confirmed?
* **Category:** Product & clinical | **Importance:** Critical
* **Why it matters:** We will not put protected items or scoring tables into code until this is Yes.
* **Blocks:** D8 · hard gate
* **Options:**
  - Yes
  - No
  - Not sure

### P7
* **Question:** Will any AI feature be included, and who pays for it?
* **Category:** Product & clinical | **Importance:** Critical
* **Why it matters:** Hard gate: no AI code is written until this is answered.
* **Blocks:** Hard gate · AI
* **Options:**
  - No AI in Release 1
  - App owner pays
  - Therapist pays (own key)
  - Client pays per use
  - Not decided yet

### P8
* **Question:** Should couples (two linked partners) be in Release 1?
* **Category:** Product & clinical | **Importance:** Major
* **Why it matters:** The privacy rules are built for it from day one, but screens and testing double if it ships now.
* **Blocks:** Not specified
* **Options:**
  - Yes, in Release 1
  - After the single-client flow is proven
  - Not sure

### P9
* **Question:** After an assessment, what does the client see?
* **Category:** Product & clinical | **Importance:** Major
* **Why it matters:** Interpreting scores for clients is a clinical decision, not an engineering one.
* **Blocks:** Not specified
* **Options:**
  - Nothing until I review it
  - Score after I release it
  - Score immediately
  - Not decided yet

### P10
* **Question:** How do you verify a therapist account before it can invite clients?
* **Category:** Product & clinical | **Importance:** Major
* **Why it matters:** Release 1 uses manual verification. We need your steps.
* **Blocks:** Therapist sign-up
* **Type:** Free text / Comment

### P11
* **Question:** Do you approve generic notification texts like “You have a new task.” (no clinical content on the lock screen)?
* **Category:** Product & clinical | **Importance:** Major
* **Why it matters:** Protects clients if someone else sees their phone.
* **Blocks:** Not specified
* **Options:**
  - Yes
  - No
  - Not sure

### P12
* **Question:** Confirm: in-app messaging between therapist and client is NOT in Release 1?
* **Category:** Product & clinical | **Importance:** Minor
* **Why it matters:** Messaging adds monitoring expectations and legal load. Keeping it out is the safer default.
* **Blocks:** Not specified
* **Options:**
  - Yes
  - No
  - Not sure

### P13
* **Question:** Reminder default for new clients?
* **Category:** Product & clinical | **Importance:** Minor
* **Why it matters:** Sets the starting behaviour. Clients can always change time, quiet hours and pause.
* **Blocks:** Not specified
* **Options:**
  - Off until the client turns them on
  - Daily reminder at a default time
  - Not sure

### P14
* **Question:** Who will use Release 1: only you, or several therapists?
* **Category:** Product & clinical | **Importance:** Major
* **Why it matters:** Several therapists means we must keep each therapist's clients fully separate and add clinic-level accounts.
* **Blocks:** Not specified
* **Options:**
  - Only me
  - A few therapists in one practice
  - Several practices or a clinic
  - Not sure

### P15
* **Question:** Should clients ever be able to see your private clinical notes?
* **Category:** Product & clinical | **Importance:** Major
* **Why it matters:** Access rules for notes differ by law and change what we store and how.
* **Blocks:** Not specified
* **Options:**
  - Never
  - Only notes I choose to share
  - Yes, on request
  - Not decided yet

### P16
* **Question:** When therapy ends, or a client moves to another therapist, what happens to access and data?
* **Category:** Product & clinical | **Importance:** Major
* **Why it matters:** Decides how links are closed and what the client keeps.
* **Blocks:** Not specified
* **Options:**
  - Access closes, data kept per retention rules
  - Client keeps their private entries
  - Case by case
  - Not decided yet

### P17
* **Question:** For couples: what should happen when one partner withdraws consent or leaves, and when one partner discloses abuse or a safety concern about the other?
* **Category:** Product & clinical | **Importance:** Major
* **Why it matters:** Protects each partner. Safety screening must never be exposed to the other partner.
* **Blocks:** Couples module
* **Type:** Free text / Comment

### P18
* **Question:** Should the app lock (PIN or fingerprint) be required?
* **Category:** Product & clinical | **Importance:** Major
* **Why it matters:** Protects clients if their phone is lost or seen by someone else, but adds friction.
* **Blocks:** Not specified
* **Options:**
  - Required
  - Optional, on by default
  - Optional, off by default
  - Not sure

### P19
* **Question:** Should clients give an emergency contact when they sign up?
* **Category:** Product & clinical | **Importance:** Major
* **Why it matters:** Can help in a crisis, but it adds data to protect and expectations on you.
* **Blocks:** Not specified
* **Options:**
  - Yes
  - No
  - Not sure

### P20
* **Question:** Besides English, which languages do you want, and when?
* **Category:** Product & clinical | **Importance:** Minor
* **Why it matters:** The app is built ready for translation, but each language needs reviewed clinical wording.
* **Blocks:** Not specified
* **Type:** Free text / Comment

### P21
* **Question:** Should clients be able to see a history of who viewed their shared data?
* **Category:** Product & clinical | **Importance:** Minor
* **Why it matters:** Builds trust, and we already record this internally.
* **Blocks:** Not specified
* **Options:**
  - Yes
  - No
  - Not sure

---

## 3. Legal & Privacy Questions (`L1` – `L15`)

Verbatim options and blocking annotations from `docs/decisions-form.html`:

### L1
* **Question:** Which privacy rules govern your practice (main one)?
* **Category:** Legal & privacy | **Importance:** Critical
* **Why it matters:** Drives consent text, retention, breach duties and hosting. Mention any others in notes.
* **Blocks:** D7 · launch
* **Options:**
  - Alberta (HIA)
  - Canada federal (PIPEDA)
  - USA (HIPAA)
  - EU / UK (GDPR)
  - Other or several

### L2
* **Question:** Do you have a lawyer who can review consent, privacy and retention?
* **Category:** Legal & privacy | **Importance:** Critical
* **Why it matters:** Several decisions here need legal sign-off before launch.
* **Blocks:** D7 · D9
* **Options:**
  - Yes
  - No
  - Not sure

### L3
* **Question:** Who is legally responsible for client data?
* **Category:** Legal & privacy | **Importance:** Critical
* **Why it matters:** Decides who signs agreements with vendors and answers a regulator.
* **Blocks:** Not specified
* **Options:**
  - You personally
  - Your clinic or company
  - The app company
  - Not sure, ask the lawyer

### L4
* **Question:** How long must clinical records be kept, and what should be deleted when a client leaves?
* **Category:** Legal & privacy | **Importance:** Critical
* **Why it matters:** Apple requires in-app account deletion, while records and the audit log may have to be kept.
* **Blocks:** D9 · store submission
* **Type:** Free text / Comment

### L5
* **Question:** Must all client data stay in Canada?
* **Category:** Legal & privacy | **Importance:** Critical
* **Why it matters:** Decides the hosting region. Real data also needs a paid tier.
* **Blocks:** D5 · production
* **Options:**
  - Yes
  - No
  - Not sure

### L6
* **Question:** Will any client under 18 use the app in Release 1?
* **Category:** Legal & privacy | **Importance:** Critical
* **Why it matters:** Minors raise consent-age and guardian questions that are not built yet.
* **Blocks:** Not specified
* **Options:**
  - Yes
  - No
  - Not sure

### L7
* **Question:** Who drafts and approves the consent text, privacy policy and terms of use?
* **Category:** Legal & privacy | **Importance:** Major
* **Why it matters:** Developers and AI may only add marked placeholders.
* **Blocks:** Not specified
* **Type:** Free text / Comment

### L8
* **Question:** Is it OK to pay for a hosted database plan before real client data goes in?
* **Category:** Legal & privacy | **Importance:** Major
* **Why it matters:** The free tier is for fake test data only.
* **Blocks:** D5
* **Options:**
  - Yes
  - No
  - Not sure

### L9
* **Question:** Do you approve these services handling data: Supabase (database), Codemagic (app builds) and a push-notification provider?
* **Category:** Legal & privacy | **Importance:** Major
* **Why it matters:** Every outside service that touches data needs your approval and may need an agreement.
* **Blocks:** Not specified
* **Options:**
  - Yes
  - No
  - Not sure

### L10
* **Question:** Who is responsible for notifying clients and authorities after a data breach, and how quickly?
* **Category:** Legal & privacy | **Importance:** Major
* **Why it matters:** A response plan is easier to write before launch than after an incident.
* **Blocks:** Not specified
* **Type:** Free text / Comment

### L11
* **Question:** Has your professional liability insurer been told about the app?
* **Category:** Legal & privacy | **Importance:** Minor
* **Why it matters:** Some policies need notice of new digital tools.
* **Blocks:** Not specified
* **Options:**
  - Yes
  - No
  - Not sure

### L12
* **Question:** Will any clients be outside your province or country?
* **Category:** Legal & privacy | **Importance:** Major
* **Why it matters:** Cross-border practice rules and the privacy law that applies can change.
* **Blocks:** Not specified
* **Options:**
  - Yes
  - No
  - Not sure

### L13
* **Question:** Does the app change your duty to report (harm to self, to others, or to a child)? What is your process?
* **Category:** Legal & privacy | **Importance:** Major
* **Why it matters:** The app must not promise more than your process can deliver.
* **Blocks:** Not specified
* **Type:** Free text / Comment

### L14
* **Question:** Can clients ask for a copy of their data, or for deletion?
* **Category:** Legal & privacy | **Importance:** Major
* **Why it matters:** Privacy laws usually give access rights, and Apple expects in-app deletion.
* **Blocks:** D9
* **Options:**
  - Yes, both inside the app
  - Yes, by contacting me
  - Copy yes, deletion limited by record rules
  - Not decided yet

### L15
* **Question:** Is it OK to collect anonymous usage and crash data (never client content)?
* **Category:** Legal & privacy | **Importance:** Major
* **Why it matters:** Each analytics tool is another outside service handling data.
* **Blocks:** Not specified
* **Options:**
  - Yes
  - No
  - Not sure

---

## 4. Accounts & Launch Questions (`A1` – `A6`)

Verbatim options and blocking annotations from `docs/decisions-form.html`:

### A1
* **Question:** Who owns the Apple and Google developer accounts?
* **Category:** Accounts & launch | **Importance:** Critical
* **Why it matters:** The owner controls the app listing and its legal declarations.
* **Blocks:** D10 · store submission
* **Options:**
  - You (the client)
  - The developer on your behalf
  - A company account
  - Not decided yet

### A2
* **Question:** Who writes and approves the app store description and any health claims?
* **Category:** Accounts & launch | **Importance:** Major
* **Why it matters:** Wording can change how the app is classified by the stores and regulators.
* **Blocks:** Not specified
* **Type:** Free text / Comment

### A3
* **Question:** Can you provide a test therapist and a test client for app store reviewers?
* **Category:** Accounts & launch | **Importance:** Minor
* **Why it matters:** The app is invite-only, so reviewers cannot sign up on their own.
* **Blocks:** Not specified
* **Options:**
  - Yes
  - No
  - Not sure

### A4
* **Question:** How will the app be paid for?
* **Category:** Accounts & launch | **Importance:** Major
* **Why it matters:** Affects hosting costs and the stores' payment rules.
* **Blocks:** Not specified
* **Options:**
  - Free for clients, therapist pays
  - Clients pay
  - Clinic or grant pays
  - Not decided yet

### A5
* **Question:** Who handles client support (questions, login problems), and which email should we show?
* **Category:** Accounts & launch | **Importance:** Major
* **Why it matters:** Clients need an honest contact, separate from emergency help.
* **Blocks:** Not specified
* **Type:** Free text / Comment

### A6
* **Question:** What is your pilot plan: how many therapists and clients, and by what date?
* **Category:** Accounts & launch | **Importance:** Major
* **Why it matters:** Sets how much we harden first and the order of the remaining work.
* **Blocks:** Not specified
* **Type:** Free text / Comment
