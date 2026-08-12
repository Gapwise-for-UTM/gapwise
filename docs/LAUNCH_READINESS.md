# Launch readiness

Gapwise can be announced publicly only when every **launch blocker** below is satisfied. This checklist is intentionally conservative and does not claim that any internet-facing application can be made perfectly secure.

## Current production posture

- Production is served from `https://gapwise-utm.vercel.app` from GitHub `main`.
- Private cloud is authoritative in `encrypted` mode.
- The original ACORN `.ics` file is parsed locally and is not uploaded.
- Private timetable/settings payloads and the separate friend-availability capsule are encrypted in the browser before Supabase storage.
- Supabase remains inside the account/relationship trust boundary but stores timetable ciphertext rather than the private timetable payload.
- Vercel is inside the cryptographic trust boundary because the key broker can unwrap per-user data-encryption keys under the production KEK.
- Friend common-gap responses are deliberately bounded and do not expose the friend's timetable, course list, rooms, buildings, or arbitrary availability.
- Production and Preview must never share a KEK.
- Gapwise is not end-to-end encrypted or zero knowledge and must not be described that way.

## Launch blockers

Before an announcement or larger beta, verify all of the following:

- [ ] `main` CI is green: typecheck, lint, tests, build, format, generated assets, and isolated database-security checks.
- [ ] Latest production Vercel deployment is `READY` and corresponds to the intended `main` commit.
- [ ] Production has no unexplained Vercel runtime errors in the observation window.
- [ ] Production response headers retain the restrictive CSP, HSTS, `nosniff`, referrer policy, permissions policy, and frame denial.
- [ ] Supabase Security Advisor findings are reviewed and either fixed or explicitly documented as intentional.
- [ ] Supabase Performance Advisor findings are reviewed; do not add or remove indexes solely to silence low-signal notices.
- [ ] Production database migration history matches the repository.
- [ ] Encrypted private-data writes advance encrypted revisions without rewriting legacy plaintext rollback rows during the observation period.
- [ ] Fresh-device encrypted restore succeeds using normal authentication.
- [ ] Same-device reload succeeds from local encrypted state without requiring a new key-broker bootstrap.
- [ ] Sign-out clears the signed-in user's local private state.
- [ ] Account deletion removes the auth account and user-owned application records with no orphaned friend or encrypted records.
- [ ] Friend overlap requires an accepted relationship and returns no more than the documented bounded windows.
- [ ] No KEK, DEK, access token, service-role key, timetable plaintext, distinctive private fixture, or ciphertext dump appears in repository source, built assets, public logs, or analytics payloads.
- [ ] `PRIVACY.md`, `SECURITY.md`, the README, and user-facing copy describe the deployed behavior accurately.
- [ ] Guest mode still works without creating an account or depending on Supabase availability.
- [ ] A rollback path is known before any irreversible database cleanup.

## Free-plan operating limits

Gapwise should remain local-first and conservative with server work so the public beta stays within the current free plans.

- Do not poll Supabase or Vercel for timetable state.
- Do not add background location tracking.
- Do not add paid map APIs when the bundled routing graph and OpenFreeMap satisfy the use case.
- Cache/deduplicate friend-overlap refreshes and keep the existing bounded friend count until real usage data justifies a different design.
- Monitor Vercel function invocations and transfer, Supabase database size/egress, and authentication limits before raising social caps.
- Prefer aggregate operational metrics; never send timetable or relationship contents to analytics.

## Announcement wording

Safe claims include:

- "Your original timetable file stays in your browser."
- "Private cloud timetable data is encrypted in your browser before storage."
- "Gapwise is local-first for timetable, gap, and campus-route calculations."
- "Friend overlap shares only a few rounded common windows, not your timetable."

Do not claim:

- end-to-end encryption / E2EE;
- zero knowledge;
- that the server can never decrypt cloud data;
- that Gapwise is unhackable or perfectly secure;
- that Gapwise is affiliated with or endorsed by the University of Toronto.

## Gate 6

Legacy plaintext rollback rows are intentionally retained during the encrypted-mode observation period. Their destructive removal is a separate Gate 6 production change governed by `PRIVATE_CLOUD_MIGRATION_RUNBOOK.md`. Perform aggregate prechecks, verify encrypted replacements and rollback/recovery implications, obtain explicit authorization for the destructive change, then rerun CI, pgTAP/database lint, advisors, browser smoke tests, sign-out, and account-deletion proofs afterward.
