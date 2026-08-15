# Launch readiness

Gapwise is approved for public use under the production-hardening standard below. This document records the launch baseline and the current operating posture; it does not claim that any internet-facing application can be made perfectly secure.

## Current production posture — 2026-08-15

Status: **READY / ON TRACK**.

The canonical production domain is `https://gapwise.ca`, built from GitHub `main` by Vercel.

The original encrypted-only launch sign-off completed on 2026-08-12. Subsequent production work remained narrow and reviewed:

- PR #103 made `gapwise.ca` the canonical production domain across documentation, tests, GitHub links, and account-deletion CORS configuration.
- PR #104 polished timetable/map controls, added visible GitHub/MIT links in the app footer, and updated the affected browser-level regression.
- At the start of the Aug 15 documentation synchronization, the current **application-behavior baseline** was `f25fdd5d6b3b4c5e0e1ed57eac53e05740b0db75` (PR #104). A documentation-only merge may advance `main` without changing that application behavior baseline.

Private cloud remains encrypted-only in source; the legacy plaintext timetable/settings tables and plaintext overlap implementation remain retired.

## Required production properties

- The original ACORN `.ics` file is parsed locally and is not uploaded.
- Guest mode remains a first-class path.
- Private timetable/settings payloads are encrypted in the browser before Supabase storage.
- Friend availability is stored separately as a deliberately lossy encrypted capsule.
- Supabase remains in the account/relationship trust boundary but stores timetable ciphertext rather than the private timetable payload.
- Vercel remains inside the cryptographic trust boundary because the key broker can unwrap per-user data-encryption keys under the production KEK.
- Production and Preview never share a KEK.
- Common-gap responses are bounded and do not expose a friend's timetable/course/room/building history.
- Gapwise does not claim E2EE, zero knowledge, or perfect security.
- Live location is opt-in and not background-tracked.
- Campus route/accessibility claims remain conservative when evidence is not verified.
- The app states that it is an independent student project and not affiliated with or endorsed by the University of Toronto.

## Launch/security gates — completed

- [x] Typecheck, lint, tests, production build, generated assets/format checks, and isolated database-security checks were green at launch.
- [x] Production Vercel deployment was `READY` and matched the intended `main` commit at the release checks.
- [x] Production runtime errors were reviewed during release observation windows.
- [x] Restrictive CSP/HSTS/nosniff/referrer/permissions/frame protections were verified.
- [x] Supabase Security and Performance Advisor findings were reviewed.
- [x] Production database migration state matched the encrypted-only repository architecture.
- [x] Legacy plaintext timetable/settings storage and plaintext overlap helpers were removed.
- [x] Fresh-device encrypted restore and same-device local restore were exercised/covered.
- [x] Sign-out cleanup, account deletion, user isolation, and bounded friend-overlap authorization were exercised/covered.
- [x] Security review found no production KEK/DEK, service-role key, token, private timetable fixture, or ciphertext dump in public source/log/analytics paths.
- [x] Privacy/security docs describe browser-side encryption and the trusted Vercel key-broker boundary without E2EE/zero-knowledge claims.
- [x] Recovery and incident procedures are documented.

## Release verification for future behavior changes

Before a major release/announcement or after a meaningful production behavior change:

1. Confirm the intended `main` SHA and matching production deployment.
2. Run/confirm required GitHub application and database-security checks.
3. Verify the relevant desktop/mobile browser journeys and accessibility behavior.
4. Check Vercel production status/runtime errors and response headers.
5. Check Supabase health/advisors/logs when backend/auth/database behavior changed.
6. Exercise destructive auth/data paths only with disposable accounts/data when the change affects them.
7. Reconcile Linear and documentation with what is actually deployed.

Documentation-only changes should not trigger unrelated feature work. They may advance the production SHA while leaving the application behavior baseline unchanged.

## Free-plan operating limits

Gapwise remains local-first and conservative with server work so it can stay free for students and within practical free infrastructure limits.

- Do not poll Supabase/Vercel for timetable state.
- Do not add background location tracking.
- Do not add a paid map API when reviewed bundled/open routing data satisfies the product need.
- Cache/deduplicate bounded social work.
- Monitor Vercel invocation/transfer and Supabase size/egress before raising backend-heavy caps.
- Prefer aggregate operational metrics; never send timetable/relationship contents to analytics.
- Keep core timetable, gap, recommendation, and route computation in the browser.
- Prefer optimization/client-side work/open-source substitutes over charging students for the core product.

## CI/deployment discipline

Correctness gates stay strict, but remote churn should stay low:

- verify locally before pushing;
- batch coherent changes into one intentional branch update where practical;
- avoid push-based formatting/test debugging loops;
- rerun failed jobs/runs instead of no-op commits when appropriate;
- use focused PRs and squash-merge to `main`;
- never bypass a real required-check failure merely to save CI time.

## Safe public wording

Safe claims include:

- “Your original timetable file stays in your browser.”
- “Private cloud timetable data is encrypted in your browser before storage.”
- “Gapwise is local-first for timetable, gap, and campus-route calculations.”
- “Friend overlap shares only a few rounded common windows, not your timetable.”
- “Gapwise is independently built and is not affiliated with or endorsed by the University of Toronto.”

Do not claim end-to-end encryption, zero knowledge, server-inability to decrypt, unhackability, perfect security, or official U of T affiliation.

## Current roadmap gate

The pre-vacation hardening milestone is complete. After the Aug 15 domain/UI/doc sync, no further planned feature expansion is required before the Sep 3 re-entry verification unless a critical production issue appears. On Sep 3, verify the actual GitHub/Vercel/Supabase state before beginning the remaining evidence-driven roadmap.
