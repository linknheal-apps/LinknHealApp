# UX Interaction Rules (Link & Heal)

Status: owner decisions of 2026-11-26. Sits under `lh-clinical-gates` and `lh-ux-direction`; it adds interaction rules only. Applies to the client app (Capacitor) and the therapist web dashboard unless a rule says otherwise.

## Rule 1: Every popup has a close control
Any modal, sheet, dialog or popover shows a visible `X` (accessible name "Close") at a fixed corner, minimum 44x44 pt. Also closes with the system back action (Rule 4) and with `Esc` on web. Tapping outside closes only if nothing unsaved (Rule 2).
- Build one shared `<Sheet>` component. No screen builds its own popup.
- Accept: every popup in the app has the control; VoiceOver and TalkBack announce "Close"; focus returns to the opener.

## Rule 2: Any page that changes data has a Save button
A page with editable data shows a primary **Save** button, disabled until something changed (dirty), showing a clear "Saved" confirmation after the server accepts it. Closing or going back with unsaved changes asks: Save / Discard / Keep editing.
- Never show "Saved" before the server confirms. Offline: show "Saved on device", and share-state changes still require a connection (`lh-mobile-capacitor` section 5).
- Reconciling with existing rules: the mood and assessment flows keep **autosaved drafts** (`lh-ux-direction` rule 4). Their final step is the explicit **Save Privately / Submit to Therapist** pair, which IS their Save. Never pre-selected, never a third generic button.
- Accept: dirty guard test (edit, press back, get the three-way prompt); no popup closes silently with unsaved data.

## Rule 3: Scroll stays on the top layer
When a popup is open, touch and wheel scrolling move only the popup content. The page behind never moves, including iOS rubber-banding.
- On open: lock body scroll (`overflow: hidden` on the root plus compensate scrollbar width on web); on iOS WebView also set the scroll container to `overscroll-behavior: contain` and `-webkit-overflow-scrolling: touch`. Restore the exact previous scroll position on close.
- Nested popups: only the topmost scrolls.
- Accept: on a real iPhone and a real Android phone, open a long sheet over a long page, swipe up and down, close; the page is at the same position.

## Rule 4: Back button behavior
- Back goes one step back: closes the topmost popup first, then goes back one screen.
- On the **home (root) screen**, the first back press shows a short notice ("Press back again to exit"); a second press within about 2 seconds exits.
- **Platform honesty:** this is Android behavior (hardware button or gesture, via `@capacitor/app` `backButton`). iOS has no back button and no programmatic exit, so there the edge-swipe and the in-app back arrow go one step back, and the home screen shows no exit prompt. Do not promise exit on iOS.
- Back must never skip an unsaved-changes prompt (Rule 2) and must never land on a screen showing another account's data after sign-out.
- Accept: scripted Android test of the stack (popup, screen, root, double press); manual iOS swipe check.

## Rule 5: Screenshots and biometrics
- **Client app:** block screenshots, screen recording and recents preview on all sensitive screens (default: everywhere) using `@capacitor/privacy-screen`. Android enforces it (`FLAG_SECURE`). iOS cannot block screenshots (blur in the app switcher only; detection per `N8`). A second camera cannot be stopped. UI and store copy never promise otherwise (decision M6: deterrent, not a boundary).
- **Therapist side:** requires biometric confirmation before showing client data.
  - The therapist app is a **web dashboard** in Release 1, and browsers cannot block screenshots. The honest control there is WebAuthn (platform passkey with user verification: fingerprint, face or device PIN) on sign-in and again after an idle or resume window, plus audited reads and MFA (FL-05).
  - If a therapist mobile app is built later (out of the Release 1 scope), use native biometrics and the same privacy screen as the client app.
  - Open questions for the owner and client: re-verification window (N9-style number), and whether the therapist fallback may be a device PIN.
- Accept: MB-01 to MB-04, MB-06 and the new MB-13 (back stack) and MB-14 (therapist biometric required, fails closed when cancelled).

## Review checklist (add to every screen PR)
- [ ] Every popup: X works, Esc/back closes it, focus returns
- [ ] Every editing page: Save disabled until dirty, "Saved" only after server ack, unsaved guard
- [ ] Scroll lock verified on a real device, position restored
- [ ] Back stack and root double-back (Android) tested; iOS swipe tested
- [ ] Privacy screen on; therapist biometric gate present and fails closed
- [ ] Still holds: one primary action, four states (loading, empty, error, offline), i18n keys, logical CSS, no gamification
