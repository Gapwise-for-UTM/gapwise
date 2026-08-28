# Gapwise disaster recovery

Gapwise currently runs its production database on the Supabase Free plan. Treat database recovery as an operator procedure rather than a provider-managed guarantee: Free projects do not have the managed daily backup/PITR posture available on paid plans.

This runbook covers a **logical Postgres backup and a restore drill into a disposable non-production target**. It does not turn a logical dump into a complete clone of production. OAuth provider configuration, Vercel environment variables, DNS/domains, external logs, deploy credentials, and Gapwise key-encryption keys (KEKs) remain separate recovery concerns.

## Security rules

A logical dump is sensitive even when application payloads are encrypted. It can contain account/auth rows, encrypted private-cloud rows, metadata, relationships, and operational state.

- Never commit backup artifacts, checksums that reveal private filenames, connection strings, database passwords, service-role keys, OAuth secrets, KEKs, DEKs, bearer tokens, or Vercel secrets to Git.
- Run backup/restore commands only on a trusted operator machine. Use environment variables for connection strings so secrets are not written into scripts or documentation.
- `backups/` is intentionally gitignored. The helper script creates files with owner-only permissions, but the files are still plaintext until the operator encrypts them.
- Encrypt the backup bundle before copying it to off-site storage. Keep the encryption key outside the same storage location.
- Keep active/recoverable KEK material separately from database backups. A database dump without the matching KEK may preserve ciphertext that cannot be decrypted; a database dump stored beside the KEK defeats that separation.
- Never use production as the target of a restore drill. A restore test must target a disposable project/database whose hostname/project ref has been positively identified as non-production.
- Do not paste backup contents, connection strings, or restore logs containing secrets into GitHub, Linear, chat, or public issue trackers.

## Prerequisites

You need:

1. Supabase CLI and Docker, as required by `supabase db dump`.
2. `psql` for restore verification.
3. A trusted machine with enough disk space for the logical dump.
4. The production **session-pooler or direct database connection string** supplied at runtime as `SUPABASE_DB_URL`.
5. For a drill, a separate disposable target supplied as `RESTORE_DB_URL`.
6. A secure encrypted destination for the completed backup bundle.

Do not store either database URL in the repository or shell profile.

## Create a logical backup

The repository helper follows Supabase's documented portable dump pattern and intentionally does not upload anything. Invoke it through Bash so the procedure does not depend on the Git executable bit being preserved by every checkout or file-management path:

```bash
export SUPABASE_DB_URL='postgresql://...'
bash scripts/backup-database.sh
unset SUPABASE_DB_URL
```

An optional output directory may be supplied:

```bash
bash scripts/backup-database.sh /secure/local/path/gapwise-backup
```

The helper creates:

- `roles.sql` — portable role definitions;
- `schema.sql` — database schema/functions/policies supported by the Supabase dump path;
- `data.sql` — data-only dump using `COPY`;
- `SHA256SUMS` — integrity checksums for those three files;
- `EVIDENCE.md` — a secret-free worksheet for the operator to finish after storage and restore verification.

The script uses `umask 077`, refuses to overwrite a non-empty destination, validates required executables, and never prints `SUPABASE_DB_URL`.

### Encrypt and move off-site

Before copying the bundle anywhere off the trusted machine, encrypt it with the organization's chosen encryption tool. The repository does not prescribe or automate a storage provider because that would create a new credential/retention surface.

After the encrypted copy is verified at the off-site destination, securely remove or otherwise protect the plaintext working copy according to the operator machine's storage model. Do not claim secure deletion on storage where the OS/filesystem cannot guarantee it.

Record the encrypted artifact location by a non-secret identifier in `EVIDENCE.md`; do not record decryption keys.

## Restore drill

Perform this only against a disposable non-production Postgres/Supabase target.

### 1. Positively identify the target

Set the target URL at runtime and inspect the hostname/project reference yourself before proceeding:

```bash
export RESTORE_DB_URL='postgresql://...non-production-target...'
```

Do not automate production-host detection as the only safety control. The operator must independently confirm that the target is disposable.

### 2. Verify backup integrity

From the backup directory:

```bash
sha256sum --check SHA256SUMS
```

Stop if any checksum fails.

### 3. Prepare the target

Create a fresh disposable target and enable any non-default Postgres extensions used by the source project before restore. Provider/project configuration outside Postgres must be recreated separately.

### 4. Restore roles, schema, and data

Supabase's documented logical restore order is roles, schema, then data. `session_replication_role = replica` prevents restore-time triggers from transforming data again.

```bash
psql \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file roles.sql \
  --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file data.sql \
  --dbname "$RESTORE_DB_URL"
```

If the restore reports a provider-version incompatibility, stop and document the failure. Do not edit the only backup copy in place; work from a duplicate and record every compatibility adjustment.

### 5. Verify the restored database

At minimum, verify all of the following against the disposable target:

```bash
psql "$RESTORE_DB_URL"
```

Then inspect:

```sql
select version();
select extname from pg_extension order by extname;
select count(*) from auth.users;
select schemaname, tablename
from pg_tables
where schemaname in ('public', 'private')
order by schemaname, tablename;
select schemaname, tablename, policyname
from pg_policies
where schemaname in ('public', 'private')
order by schemaname, tablename, policyname;
```

Also verify:

- the current migration/schema state is present;
- expected `SECURITY DEFINER` functions and grants exist with the same caller-scoped restrictions;
- RLS is enabled on private/tenant-scoped tables that require it;
- representative row counts for critical private-cloud and relationship tables are plausible relative to the source evidence recorded at backup time;
- encrypted private-cloud rows remain ciphertext at rest;
- with a separately supplied **non-production copy of the matching KEK material**, the application can restore/decrypt a disposable test account's encrypted state;
- without KEK material, the database alone does not silently fall back to plaintext recovery.

Never use another user's private data as a manual inspection sample. Prefer aggregate counts and a disposable operator-owned test account.

### 6. Verify what the database restore does not recover

A successful SQL restore is not enough to call the service recovered. Re-establish and independently verify as applicable:

- Google/OAuth provider configuration and redirect allowlists;
- Supabase project/API configuration not represented in the logical dump;
- Vercel environment variables and deployment settings;
- Gapwise KEKs and their rotation/recovery records;
- custom domains and DNS;
- external provider logs/retention configuration;
- Storage objects/buckets if Gapwise begins depending on them;
- deployed Edge Functions or other code artifacts not reconstructed by the database dump.

## Evidence record

Complete `EVIDENCE.md` after each backup and drill. It may contain:

- UTC backup date/time;
- core repository `main` SHA and latest migration identifier;
- non-secret source project reference label;
- SHA-256 checksums of the dump files;
- encrypted off-site artifact identifier/location label;
- UTC restore-drill date/time;
- disposable target label/project ref;
- restore result and verification checklist;
- operator name;
- cleanup confirmation for the disposable target and plaintext working files.

It must **not** contain connection strings, database passwords, user data, tokens, OAuth secrets, KEKs/DEKs, or decrypted application payloads.

## Recovery status

Having this runbook in the repository means the procedure is defined, not that disaster recovery is proven. Checklist item 44 remains **Review required** until an actual backup has been produced, encrypted/stored off-site, restored into a disposable target, verified, and recorded without secrets.
