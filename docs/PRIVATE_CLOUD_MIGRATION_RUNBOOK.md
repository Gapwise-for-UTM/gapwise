# Private-cloud migration and KEK runbook

This runbook is intentionally staged. Production moved to `VITE_PRIVATE_CLOUD_MODE=encrypted` only
after Gates 0–5 were exercised. The current production database still contains one non-empty legacy
schedule and one legacy preference row as rollback material; both are treated as real until the
separately authorized Gate 6 cleanup.

## Rollout modes

| Mode        | Reads                                  | Writes                                            | Intended use                            |
| ----------- | -------------------------------------- | ------------------------------------------------- | --------------------------------------- |
| `off`       | Legacy owner-RLS rows                  | Legacy rows only                                  | Emergency rollback / pre-migration only |
| `shadow`    | Legacy rows                            | Explicit sync writes legacy and encrypted records | Migration observation only              |
| `encrypted` | Secure IndexedDB, then encrypted cloud | Encrypted records only                            | Current authoritative production mode   |

An invalid or missing flag becomes `off`. No mode ever uploads the original ICS file.

## Gate 0: source and history

1. Require green application and `database-security` GitHub Actions jobs.
2. Confirm hosted migration history matches the repository. The canonical production timestamp for
   `remove_schedule_source_filename` is `20260807132654`; the repository now uses that exact
   version.
3. Confirm production row counts and `pg_database_size` using aggregate queries only.
4. Keep a known rollback deployment available during migration observation and do not edit
   already-applied migration bodies.

## Gate 1: additive database phase

The following migrations are additive and have scoped rollback scripts:

- `20260811063830_encrypted_private_cloud_phase1.sql`
- `20260811063841_encrypted_key_envelope_rotation.sql`

Before applying them, run the isolated pgTAP and database linter jobs. Inspect `supabase db push
--dry-run`, then apply only the expected versions. Applying phase 1 does not copy, modify, or delete
legacy timetable/preference values and does not require a KEK.

Afterward verify:

- all three encrypted tables and the private aggregate rate-limit table exist;
- RLS is enabled and forced;
- `anon` has no table or function access;
- `authenticated` cannot update key envelopes directly;
- the intended `SECURITY DEFINER` RPCs derive identity from `auth.uid()` and have no `PUBLIC`
  execution;
- account deletion cascades to every new table;
- Security and Performance Advisors contain no unexplained finding.

Do not use a rollback script after encrypted users exist without first proving what data would be
lost. The additive rollback is safe only before the new tables contain needed encrypted records.

Production checkpoint (2026-08-11): Gate 1 is complete. Both encrypted migrations were applied
after green application and isolated database-security CI. At that checkpoint, catalog checks
confirmed RLS was enabled and forced, all new tables contained zero rows, and the one legacy schedule
and preference row remained untouched.

## Gate 2: operator KEK recovery action — mandatory pause

Production encrypted setup must not begin until the operator completes all of these steps:

1. In an approved password manager/offline vault, use its cryptographically secure generator to
   create a 43-character value from the Base64URL alphabet (`A-Z`, `a-z`, `0-9`, `-`, `_`). This is
   a 256-bit KEK encoding. Do not generate it in chat, CI, a repository file, Supabase, or a shell
   command that prints it.
2. Save that value as the offline recovery record first. Restrict access and record that it is
   `Gapwise production KEK v1`; do not attach timetable exports or database credentials.
3. In the Vercel dashboard, add the same value as the **Sensitive** production-only variable
   `GAPWISE_KEK_V1`. Never prefix it with `VITE_` and do not make it available to Preview or
   Development.
4. Add production `GAPWISE_ACTIVE_KEK_VERSION=1`. This value is a version selector, not a key.
5. Verify variable names, sensitivity and environment scope without revealing values. Confirm no
   Supabase service-role/secret key exists in Vercel.
6. Confirm the recovery entry can be retrieved by the intended operator, then close it. Do not paste
   the value into an issue, PR, terminal transcript, screenshot, or this conversation.

Preview testing must use a separately generated preview KEK and preview-only variables. Never copy
the production KEK into a preview environment.

Operational checkpoint (2026-08-11): the production v1 KEK recovery copy was stored before its
Sensitive production Vercel variable was configured, and a separately generated Preview KEK was
used for Preview testing. No KEK was placed in Supabase, browser configuration, repository files, or
Vercel browser-exposed variables.

## Gate 3: disposable end-to-end proof

With additive tables present, a separate preview KEK, and a disposable authenticated account:

1. Deploy `shadow`, sync a distinctive fixture, and verify browser decryption after upload.
2. Reload the same device and prove IndexedDB restore performs no `/api/key-broker` request.
3. Clear site storage, sign in normally, and prove one broker bootstrap plus encrypted cloud restore.
4. Use a second disposable account to prove direct cross-user selects/updates fail.
5. Mutually connect the accounts and prove `/api/common-gap` returns at most three rounded fields and
   neither browser receives a capsule or timetable.
6. Tamper with ciphertext, nonce, AAD context and revisions; every case must fail closed while an
   existing valid local record remains usable.
7. Delete one disposable account and prove key envelopes, both ciphertext rows, profile, invites,
   friendships and rate limits cascade; sign-out must clear IndexedDB keys and decrypted UI state.
8. Search browser storage, network bodies, preview logs and built assets for distinctive fixture
   strings and all server secret names. Database rows may contain only ciphertext and allowed
   metadata.

Record counts, hashes and pass/fail evidence—not tokens, plaintext, ciphertext dumps, or keys.

Operational checkpoint (2026-08-11): live Preview proof exercised both `shadow` and `encrypted`
modes with distinctive disposable fixtures. Encrypted cloud restore succeeded on a fresh browser
context; a normal same-device reload made no additional `/api/key-broker` request; mutual friend
availability used the real `/api/common-gap` path and returned only the expected rounded windows;
and deleting the disposable account removed its auth-linked encrypted rows, key envelope, friend
profile, friendship/invite state, legacy rows and rate-limit state while the retained owner account
remained intact. The owner's real timetable was restored after fixture testing. The isolated RLS and
crypto suites cover cross-user access denial, ciphertext/nonce/AAD tampering, revision conflicts and
fail-closed behavior.

## Gate 4: migrate the existing legacy row

The KEK must never enter PostgreSQL. Preserve each legacy row until its encrypted replacement is
verified. For the current single row, prefer a user-scoped migration through the real application:

1. Keep `shadow` reads active.
2. The existing owner signs in through the ordinary flow and performs private-data sync; the browser
   reads only that owner's legacy row under RLS, encrypts locally, uploads ciphertext, reads it back,
   decrypts it, and compares the canonical payload.
3. Verify an encrypted private row, availability row and key envelope exist for the same owner.
4. Verify the decrypted canonical schedule and applicable preferences equal the legacy source
   without logging either representation.
5. Record only owner-independent migration status/counts.

Production checkpoint (2026-08-11): the existing owner's real timetable was migrated through the
real application in `shadow` mode and the encrypted replacement was read back and verified before
cutover. The legacy rows were intentionally retained as rollback material.

If an operator tool is later required for users who cannot return, it must run on a trusted operator
machine, process one row at a time, hold direct database credentials and the KEK only in memory,
emit no plaintext, leave no dumps, verify before marking success, and be independently reviewed.
Do not put a service-role key or KEK into Vercel to simplify this one-time task.

## Gate 5: authoritative cutover

Cut over only when all intended legacy rows have verified encrypted replacements and the disposable
proof is green:

1. Deploy `encrypted` to Preview and repeat the browser smoke path.
2. Set production `VITE_PRIVATE_CLOUD_MODE=encrypted` and deploy without changing the KEK.
3. Verify local-first reload, new-device restore, edit/sync, friend common gap, cloud deletion,
   sign-out and account deletion.
4. Observe errors, database size, egress, function invocations and active CPU. Roll back the
   deployment/flag to `off` on any unexplained migration failure while rollback rows still exist.
5. Keep plaintext tables during an explicit observation period.

Production checkpoint (2026-08-11): Gate 5 is complete. Production is authoritative `encrypted`.
A fresh Incognito/new-device flow restored the real timetable through the production key broker;
subsequent encrypted writes advanced the encrypted private revision while the legacy plaintext
schedule timestamp remained unchanged. The post-hardening production deployment is `READY`, and the
checked Vercel runtime window contained no unexplained errors. The legacy rows remain only for the
explicit observation/rollback period.

## Gate 6: later destructive cleanup

This is a separate, explicitly authorized production change. Recount every legacy row, prove every
intended replacement, verify rollback/recovery and obtain authorization before dropping plaintext
columns/tables or the legacy overlap functions. Regenerate types and rerun pgTAP, advisors, secret
scans, production browser checks and deletion proofs afterward.

Latest aggregate precheck (2026-08-11): one legacy schedule, one legacy preference, one key envelope,
one encrypted private row and one encrypted availability row remain; the encrypted private revision
has advanced beyond the migration copy while the legacy schedule has not been rewritten. This is
supporting evidence only and is not itself authorization to destroy rollback data.

Never infer that a small row count means disposable data. Never use a database migration that has
access to the Vercel KEK. Never retire a KEK version until every envelope has been rewrapped,
decrypt-verified, observed through the safe overlap period, and the replacement KEK has its own
offline recovery copy.
