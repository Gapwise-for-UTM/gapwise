# Gapwise for UTM 1.0.0 release notes

These notes are prepared for the stable `v1.0.0` release and are published only after the 1.0 release-candidate gates and final production smoke check pass.

## What ships in 1.0

- Local ACORN `.ics` import and parsing; the original calendar file is not uploaded.
- Weekly and mobile-first timetable views with personal timetable items.
- Fall/Winter term switching from multi-term ACORN exports.
- Gap detection and deterministic recommendations that account for transition time and user preferences.
- UTM campus routing with verified graph data where available, route preferences, indoor transitions, and accessible written route context.
- Optional accounts through Microsoft, Google, and GitHub via Supabase Auth.
- Browser-side encryption for private cloud timetable/settings data, wrapped per-user keys, and separately encrypted friend-availability data.
- Privacy-bounded friend overlap that shares only a few rounded common windows rather than either user's timetable.
- Guest mode, responsive desktop/mobile UI, dark/light themes, and installable PWA support.

## 1.0 reliability gates

The 1.0 release adds Playwright browser testing across Chromium and WebKit on desktop and phone-sized viewports. Automated journeys cover landing, synthetic ACORN import, Fall/Winter switching, timetable rendering, gap and route navigation, malformed import handling, source-file network privacy, plaintext-persistence prevention, service-worker-controlled offline app-shell behavior, and serious/critical automated accessibility checks with axe.

Those browser checks join the existing frozen Bun install, typecheck, ESLint, application/security tests, encrypted-sync tests, production build, generated-asset verification, Prettier, isolated Supabase migrations, pgTAP/RLS/account-deletion checks, database lint, CodeQL, Snyk, CodeRabbit review, and Vercel preview/production checks.

## Security and privacy language

Gapwise is local-first and encrypts private cloud payloads in the browser before storage. Browser E2E verifies that imported calendar source bytes are not placed in request bodies and that the retired plaintext timetable persistence keys are not written; the existing encrypted-sync/security test suite covers ciphertext/key-envelope persistence and restoration behavior.

Vercel's key-broker functions remain inside the cryptographic trust boundary and can unwrap data-encryption keys when authorized. Gapwise therefore does **not** claim end-to-end encryption or zero knowledge.

Gapwise is independently built and is not affiliated with or endorsed by the University of Toronto.

## Known compatibility holds

- TypeScript 7 is intentionally deferred until the TypeScript-ESLint parser/tooling line used by Gapwise supports it.
- Vite 8.2 is intentionally deferred because it currently causes a PWA precache/bundle-size regression in this application.

These are maintenance compatibility holds, not known user-facing 1.0 defects.
