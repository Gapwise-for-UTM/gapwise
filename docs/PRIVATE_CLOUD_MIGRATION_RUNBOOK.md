# Private-cloud migration and KEK runbook

This runbook is intentionally staged. Production remains on `VITE_PRIVATE_CLOUD_MODE=off` until
every applicable gate is checked. The current production database contains one non-empty legacy
schedule and one legacy preference row; both are treated as real.

## Rollout modes

| Mode        | Reads                                  | Writes                                            | Intended use                              |
| ----------- | -------------------------------------- | ------------------------------------------------- | ----------------------------------------- |
| `off`       | Legacy owner-RLS rows                  | Legacy rows only                                  | Current safe production default           |
| `shadow`    | Legacy rows                            | Explicit sync writes legacy and encrypted records | Disposable-user and migration observation |
| `encrypted` | Secure IndexedDB, then encrypted cloud | Encrypted records only                            | Final authoritative mode                  |

An invalid or missing flag becomes `off`. No mode ever uploads the original ICS file.

## Gate 0: source and history

1. Require green application and `database-security` GitHub Actions jobs.
2. Confirm hosted migration history matches the repository. The canonical production timestamp for
   `remove_schedule_source_filename` is `20260807132654`; the repository now uses that exact
   version.
3. Confirm production row counts and `pg_database_size` using aggregate queries only.
4. Keep a rollback deployment at `off` and do not edit already-applied migration bodies.

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
- the two intended `SECURITY DEFINER` RPCs derive identity from `auth.uid()` and have no `PUBLIC`
  execution;
- account deletion cascades to every new table;
- Security and Performance Advisors contain no unexplained finding.

Do not use a rollback script after encrypted users exist without first proving what data would be
lost. The rollback is safe only while production remains `off` and the new tables contain no needed
records.

Production checkpoint (2026-08-11): Gate 1 is complete. Both migrations were applied after green
application and isolated database-security CI. Post-apply catalog checks confirm RLS is enabled and
forced, all new tables contain zero rows, and the one legacy schedule and preference row remain
untouched. Production mode is still `off`; this checkpoint does not satisfy Gate 2 or Gate 3.

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
   deployment/flag to `off` on any unexplained failure; legacy rows still exist.
5. Keep plaintext tables during an explicit observation period.

## Gate 6: later destructive cleanup

This is a separate, explicitly authorized production change. Recount every legacy row, prove every
intended replacement, verify rollback/recovery and obtain authorization before dropping plaintext
columns/tables or the legacy overlap functions. Regenerate types and rerun pgTAP, advisors, secret
scans, production browser checks and deletion proofs afterward.

Never infer that a small row count means disposable data. Never use a database migration that has
access to the Vercel KEK. Never retire a KEK version until every envelope has been rewrapped,
decrypt-verified, observed through the safe overlap period, and the replacement KEK has its own
offline recovery copy.
