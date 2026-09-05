# Private-cloud migration and KEK runbook

## Status

The staged migration is complete in production as of 2026-08-11. Gates 0–6 passed. Production is permanently encrypted-only in source, the legacy plaintext `user_schedules` and `user_preferences` tables are gone, and the legacy plaintext overlap helpers are gone. The original ICS file is never uploaded.

This document now serves as the recovery/rotation record for the deployed architecture rather than an active rollout guide.

## Completed production gates

- **Gate 0 — source/history:** application CI and isolated database-security checks were green; hosted migration history was reconciled with the repository.
- **Gate 1 — additive schema:** encrypted private data, encrypted friend availability, wrapped-key envelopes and key rotation surfaces were deployed with forced RLS and bounded RPCs.
- **Gate 2 — KEK recovery:** the production v1 KEK was stored as a Vercel Sensitive production variable only after an offline recovery copy existed. Preview used a separate KEK.
- **Gate 3 — disposable proof:** encrypted restore, local-key reload, common-gap minimization, account deletion, tamper failure and cross-user isolation were exercised with disposable data.
- **Gate 4 — legacy migration:** the remaining production owner migrated through the real application and the encrypted replacement was read back and verified.
- **Gate 5 — authoritative cutover:** production restored the real timetable from encrypted cloud state on a fresh browser context and subsequent encrypted revisions advanced without rewriting the legacy rollback rows.
- **Gate 6 — plaintext retirement:** the fail-closed precheck found zero incomplete replacements. Migration `20260812022934_retire_legacy_plaintext_cloud.sql` then removed the legacy plaintext schedule/preferences tables and plaintext overlap helpers. Post-apply checks confirmed the encrypted private row, key envelope and encrypted availability row remained present.

## Production trust boundary

- The browser parses ICS and encrypts private application state with non-extractable Web Crypto keys.
- Supabase stores ciphertext, wrapped per-user data keys, Auth/account metadata and minimal friend/relationship metadata under RLS.
- Vercel Functions hold the versioned KEK and can unwrap per-user DEKs after verifying a Supabase session. Vercel has no Supabase service-role credential.
- The common-gap function decrypts only the deliberately lossy friend-availability capsules and returns at most three rounded windows.

Do not describe Gapwise as E2EE, zero knowledge or unhackable.

## KEK recovery and rotation

Production secrets are server-only:

- `GAPWISE_ACTIVE_KEK_VERSION`
- `GAPWISE_KEK_V1` and future versioned KEKs

Never put a KEK in Supabase, source control, logs, screenshots, analytics, browser configuration or a `VITE_*` variable. Keep at least one offline/operator recovery copy for every active KEK version.

For rotation:

1. Generate and store the replacement KEK in the recovery vault first.
2. Add the new KEK as a Vercel Sensitive production-only variable.
3. Keep the previous KEK available during the rewrap window.
4. Set the active version selector to the new version.
5. Let the broker compare-and-swap each authenticated user's envelope strictly forward.
6. Verify every envelope can be unwrapped with the new version and that private ciphertext itself was not rewritten merely for rotation.
7. Observe production before retiring the previous KEK.
8. Remove the old KEK only after every envelope has migrated and the new recovery copy has been independently confirmed.

Loss of every copy of an active KEK makes the corresponding encrypted cloud data unrecoverable.

## Recovery procedures

### Vercel/key-broker outage

Keep the last known-good deployment available. Users with valid local non-extractable keys can continue from encrypted local state. Do not introduce a plaintext fallback. Restore the correct server-only KEK variables or roll back application code to a known-good encrypted deployment.

### Supabase outage

Do not weaken RLS or add a privileged browser credential. Existing local state remains usable; cloud sync should fail non-destructively and retry later.

### Suspected KEK exposure

Treat the affected KEK as compromised. Create a new version, preserve the old one only long enough to rewrap every envelope, verify the new wraps, then retire the compromised version. Do not re-encrypt full timetable ciphertext unless the data-encryption keys themselves are believed compromised.

### Corrupt local browser state

Clear the affected site's local private state and sign in normally. The broker can re-wrap the existing cloud DEKs to a newly generated device public key. Do not export raw DEKs to repair a browser.

### Database restore

Restore only from an approved Supabase backup/recovery path. After restoration, verify encrypted-table counts, envelope/ciphertext context consistency, RLS/privileges, migration history and the absence of retired plaintext tables before serving writes.

## Required verification after security/schema changes

Run:

```sh
bun install --frozen-lockfile
bun run typecheck
bun run lint
bun test
bun run build
bun run format:check
supabase db start
supabase test db
supabase db lint --local --level warning --fail-on error
```

Then verify production deployment state, Vercel runtime errors, Supabase Security/Performance Advisors, fresh-device encrypted restore, same-device local restore, sign-out cleanup, account deletion and bounded friend common-gap behavior.

Never edit an already-applied migration. Add a new migration for future production schema changes.
