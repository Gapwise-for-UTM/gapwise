# Launch readiness

Gapwise is approved for public announcement under the production-hardening standard below. This sign-off is intentionally conservative and does not claim that any internet-facing application can be made perfectly secure.

## Production launch sign-off — 2026-08-12

Status: **READY TO ANNOUNCE**.

The release candidate for PR #60 passed all required checks before squash-merge to `main`: typecheck, lint, 242 application/security tests, production build, generated-asset verification, Prettier, isolated database migrations, pgTAP/database-security checks, Supabase database lint, Snyk, CodeRabbit, and Vercel Preview. Production now serves merge commit `719d86daaf695b4bf7cc68e02ed7649ee152e64a` from the canonical domain.

Gate 6 is complete. The legacy plaintext `user_schedules` and `user_preferences` tables and the legacy plaintext overlap helpers are removed from production. The encrypted private-data row, wrapped-key envelope, and separately encrypted friend-availability row remain present.

## Current production posture

- Production is served from `https://gapwise.ca` from GitHub `main`.
- Private cloud is permanently encrypted-only in source; there is no deploy-time plaintext fallback.
- The original ACORN `.ics` file is parsed locally and is not uploaded.
- Private timetable/settings payloads and the separate friend-availability capsule are encrypted in the browser before Supabase storage.
- Supabase remains inside the account/relationship trust boundary but stores timetable ciphertext rather than the private timetable payload.
- Vercel is inside the cryptographic trust boundary because the key broker can unwrap per-user data-encryption keys under the production KEK.
- Friend common-gap responses are deliberately bounded and do not expose the friend's timetable, course list, rooms, buildings, or arbitrary availability.
- Production and Preview must never share a KEK.
- Gapwise is not end-to-end encrypted or zero knowledge and must not be described that way.

## Launch blockers — completed

- [x] Release-candidate CI is green: typecheck, lint, tests, build, format, generated assets, and isolated database-security checks.
- [x] Latest production Vercel deployment is `READY` and corresponds to the intended `main` commit.
- [x] Production has no unexplained Vercel runtime errors in the final observation window.
- [x] Production response headers retain the restrictive CSP, HSTS, `nosniff`, referrer policy, permissions policy, and frame denial.
- [x] Supabase Security Advisor findings were reviewed. Remaining notices are understood design choices: private rate-limit tables intentionally have no browser policies; authenticated `SECURITY DEFINER` RPCs are narrow caller-facing capabilities covered by authorization tests; leaked-password protection is not part of the deployed Microsoft/Google/GitHub OAuth authentication path.
- [x] Supabase Performance Advisor findings were reviewed. The remaining unused friendship-index notices are low-signal on the current small dataset and are retained until real usage justifies removal.
- [x] Production database migration state matches the encrypted-only repository architecture.
- [x] Gate 6 permanently removed intentional plaintext timetable/settings cloud storage and the plaintext overlap implementation after the fail-closed replacement precheck.
- [x] Fresh-device encrypted restore succeeded using normal authentication during production cutover validation.
- [x] Same-device reload succeeds from local encrypted state; regression coverage verifies local restore without networking.
- [x] Sign-out clears the signed-in user's local private state; automated coverage verifies cross-account cleanup and stale-callback protection.
- [x] Account deletion was exercised with a disposable account and removes user-owned encrypted/application records; database cascade coverage remains green.
- [x] Friend overlap requires an accepted relationship and returns no more than the documented bounded rounded windows; authorization/non-enumeration/revocation coverage is green.
- [x] Security tests and release review found no KEK, DEK, access token, service-role key, timetable plaintext, distinctive private fixture, or ciphertext dump in repository source, built assets, public logs, or analytics payloads.
- [x] `PRIVACY.md`, `SECURITY.md`, README/security architecture, operations guidance, and user-facing terminology describe browser-side encryption and the trusted Vercel key-broker boundary without E2EE/zero-knowledge claims.
- [x] Guest mode remains supported without creating an account; routing and timetable calculations remain local-first.
- [x] Recovery and incident procedures are documented in `OPERATIONS.md` and `PRIVATE_CLOUD_MIGRATION_RUNBOOK.md`, including KEK recovery/rotation and database-restore implications.

## Final production evidence

- Canonical production deployment for merge commit `719d86daaf695b4bf7cc68e02ed7649ee152e64a`: `READY`.
- Final production runtime error/fatal query: no matching errors in the observation window.
- Production database post-Gate-6 aggregate check:
  - `public.user_schedules`: removed;
  - `public.user_preferences`: removed;
  - legacy plaintext overlap helpers: removed;
  - encrypted private-data records: present;
  - wrapped-key envelopes: present;
  - encrypted friend-availability records: present.
- Production response headers include restrictive CSP (`script-src 'self' 'wasm-unsafe-eval'` without JavaScript `unsafe-eval`), HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, restrictive `Permissions-Policy`, `frame-ancestors 'none'`, and `X-Frame-Options: DENY`.

## Free-plan operating limits

Gapwise should remain local-first and conservative with server work so it can remain free for students and fit current free infrastructure tiers as long as practical.

- Do not poll Supabase or Vercel for timetable state.
- Do not add background location tracking.
- Do not add paid map APIs when the bundled routing graph and OpenFreeMap satisfy the use case.
- Cache/deduplicate friend-overlap refreshes and keep bounded social work until real usage data justifies a different design.
- Monitor Vercel function invocations and transfer, Supabase database size/egress, and authentication limits before raising social caps.
- Prefer aggregate operational metrics; never send timetable or relationship contents to analytics.
- Keep core timetable, gap, recommendation, and route computation in the browser so ordinary use has near-zero marginal backend work.
- If a vendor changes its free tier, prefer optimization, client-side work, open-source/self-hostable substitutes, or bounded features over charging students for the core product.

## Announcement wording

Safe claims include:

- "Your original timetable file stays in your browser."
- "Private cloud timetable data is encrypted in your browser before storage."
- "Gapwise is local-first for timetable, gap, and campus-route calculations."
- "Friend overlap shares only a few rounded common windows, not your timetable."
- "Gapwise is independently built and is not affiliated with or endorsed by the University of Toronto."

Do not claim:

- end-to-end encryption / E2EE;
- zero knowledge;
- that the server can never decrypt cloud data;
- that Gapwise is unhackable or perfectly secure;
- that Gapwise is affiliated with or endorsed by the University of Toronto.

## Ongoing maintenance is not a launch blocker

A production app is never permanently finished. Dependency updates, newly disclosed vulnerabilities, vendor free-tier changes, capacity growth, browser changes, and real-world usage can require future maintenance. Those are normal operational responsibilities, not known blockers to the 2026-08-12 launch posture documented here.
