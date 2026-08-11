# Gapwise private cloud security architecture

Status: implemented on the dedicated security branch behind a fail-safe rollout gate. The additive
schema is applied and empty, production remains `off`, and legacy tables remain authoritative until
every remaining cutover gate in this document has passed.

## Security claim and limits

The target guarantee is deliberately narrow:

> A compromise of the Gapwise application database alone does not reveal private timetable
> contents, private custom events, residence/private routing settings, or detailed friend
> availability.

Supabase Auth necessarily retains account and authentication metadata. The application database
also retains minimal relationship, ciphertext size, revision, update-time, key-version, and opaque
identifier metadata. This design is defense in depth, not a claim that the system is unhackable or
zero knowledge.

The design does not protect plaintext currently in application memory from a compromised device,
operating system, browser extension, injected script, stolen authenticated session, or malicious
application deployment. A sufficiently broad simultaneous compromise of Supabase and the Vercel
runtime can also expose data.

## Current-state findings (2026-08-11)

- Production runs on one healthy Supabase PostgreSQL 17 project and one Vercel project. The live
  database currently occupies 11,390,099 bytes (reported as 11 MB).
- Production has one Auth user, one non-empty plaintext `user_schedules` row, one plaintext
  `user_preferences` row, one friend profile, no friendship rows, and no accepted friendships.
- The schedule JSON occupies 1,543 bytes. This inspection read aggregates and sizes only, not its
  contents.
- `user_schedules.meetings`, residence fields, remembered timetables, personal events, and routing
  preferences are currently plaintext at rest.
- PostgreSQL currently computes cross-user gaps from plaintext schedules inside a
  `SECURITY DEFINER` function.
- Current RLS is enabled on all application tables. The 2026-08-11 additive deployment also forces
  RLS on the encrypted tables and legacy schedule/preference tables. A post-deploy Security Advisor
  refresh reports the expected intentional `SECURITY DEFINER` warnings plus private tables with
  intentionally no readable policy. Performance Advisor additionally flags the composite parent
  FKs on the two one-row-per-user encrypted tables; their `user_id` primary keys already narrow a
  cascade to at most one row, so separate composite indexes would add write/storage cost without a
  meaningful lookup benefit. The prior low-value revoked-by FK and unused friendship indexes remain
  informational and are not migration blockers.
- The hosted migration ledger records `20260811063830_encrypted_private_cloud_phase1` and
  `20260811063841_encrypted_key_envelope_rotation`. All four new tables contain zero rows; the one
  legacy schedule and preference row remain unchanged. No KEK exists and no encrypted migration has
  begun.
- The active production deployment is the merge of PR #55 on canonical branch `main`; CI is green.

The single production row is treated as real until its owner explicitly classifies it otherwise.
No destructive migration may rely on its small count.

## Trust split

### Browser

The browser parses ICS, owns interactive plaintext while the app is open, creates a non-extractable
RSA-OAEP device private key, receives only device-wrapped data keys, and performs all routine data
encryption/decryption. It renders schedules, routes days, finds personal gaps, and derives the
lossy friend capsule locally. Normal reloads use IndexedDB and do not call a crypto function.

The browser is not trusted to assert a user ID or friendship authorization. It never receives the
Vercel key-encryption key (KEK), another user's data key, capsule, timetable, or complete
availability.

### Supabase

Supabase Auth issues user sessions. PostgreSQL stores encrypted private payloads, encrypted lossy
friend capsules, KEK-wrapped data-encryption keys (DEKs), and minimal relationships. Owner RLS
protects ordinary encrypted sync. A narrowly scoped RPC derives its caller from `auth.uid()`,
checks mutual acceptance, and returns only the two encrypted capsules and their wrapped
availability-key material.

Supabase does not store the KEK or plaintext private application data. A database reader can see
Auth/account metadata and application metadata listed above.

### Vercel

Two narrow Node.js functions hold access to versioned KEKs through sensitive, server-only
environment variables:

- The key broker verifies the Supabase access token with `supabase.auth.getClaims()`, uses the same
  user token for RLS-scoped database access, unwraps or creates only that user's DEKs, and wraps
  them to the submitted device public key.
- The common-gap function verifies the token, calls the authenticated RPC as that caller, unwraps
  only availability DEKs, decrypts only lossy capsules, and returns at most three canonical rounded
  windows.

Neither function has a database password, Supabase secret key, or service-role credential. The
publishable project key is not a secret and cannot bypass RLS.

### Operator

The operator creates the first 256-bit KEK, stores it as a Vercel Sensitive Environment Variable,
and keeps one offline recovery copy in an appropriate password manager or secure offline vault.
The copy is never committed, pasted into chat, stored in Supabase, placed in a `VITE_*` variable,
or printed by CI/tooling. Production activation pauses until that recovery action is confirmed.

## Cryptographic domains and formats

Two independent random 256-bit AES keys exist per user:

| Domain                | Contents                                                | Server may decrypt?      |
| --------------------- | ------------------------------------------------------- | ------------------------ |
| `private-data`        | timetable, custom events, sensitive routing/preferences | No normal server flow    |
| `friend-availability` | bounded, deliberately lossy candidate windows           | Common-gap function only |

Content and key-envelope encryption use AES-256-GCM with a fresh 96-bit random nonce for every
operation. Authentication failure, malformed input, an unknown version, or an AAD mismatch is a
hard failure. There is no plaintext fallback.

AAD is a canonical UTF-8 JSON tuple, not free-form concatenation. Version 1 contexts are:

- KEK envelope: `['gapwise','key-envelope',1,purpose,subjectId,keyId,keyVersion,kekVersion]`
- private payload: `['gapwise','private-data',1,schemaVersion,subjectId,recordId,keyId,revision]`
- availability capsule:
  `['gapwise','friend-availability',1,schemaVersion,subjectId,capsuleId,keyId,revision]`

`subjectId`, record IDs, capsule IDs, and key IDs are random opaque UUIDs. Auth user IDs remain in
RLS ownership columns but are not required in the friend-material RPC output. Revision is
authenticated and supports optimistic concurrency. New formats require new explicit versions;
old formats are never guessed.

Ciphertext, nonces, and wrapped DEKs use PostgreSQL `bytea`. The client converts the Data API's
hex representation at the boundary and otherwise uses `Uint8Array`/`ArrayBuffer`.

## Key lifecycle

1. On first encrypted setup, the browser creates a 2048-bit RSA-OAEP/SHA-256 key pair. The private
   key is non-extractable. The public JWK is sent to the broker.
2. If no envelope exists, the broker creates two DEKs using the runtime CSPRNG, wraps each with
   the active KEK, and inserts the envelope using the verified user's token under RLS.
3. The broker RSA-OAEP-wraps each DEK to the device public key. The response contains only wrapped
   key bytes and public metadata.
4. The browser uses `SubtleCrypto.unwrapKey` so ordinary application code does not receive raw DEK
   bytes. Resulting AES keys are non-extractable and stored using IndexedDB structured cloning after
   a feature test.
5. A normal reload reads the CryptoKeys and encrypted local payload from IndexedDB and decrypts
   locally. Clearing browser storage causes an automatic broker bootstrap after ordinary sign-in.
6. Sign-out deletes the signed-in user's local DEKs, device private key, local ciphertext, and
   decrypted state. Signing in again transparently bootstraps again.

Cloud opt-in is persisted alongside the non-extractable key record only after a verified cloud
save/load. Explicit cloud deletion changes it to disabled while retaining the current in-memory and
encrypted local copy, so a later reload cannot silently resurrect deleted cloud ciphertext.

If durable CryptoKey cloning is unavailable, Gapwise uses page-lifetime non-extractable keys and
reports that secure persistent restore is unavailable rather than storing raw keys. It never puts a
raw DEK in localStorage or sessionStorage.

## KEK versioning, rotation, and recovery

Server configuration names only versions, never values in source:

- `GAPWISE_ACTIVE_KEK_VERSION`
- `GAPWISE_KEK_V1` (and later `GAPWISE_KEK_V2`, etc.)

During rotation, Vercel temporarily loads current and previous KEKs. A broker/common-gap request can
unwrap either version. The broker re-wraps each DEK with the active KEK and updates only the envelope
after verifying the new wrap. Full private ciphertext is unchanged. After an operator-controlled
overlap period and verification, the old KEK may be retired.

Loss of every copy of an active KEK makes cloud ciphertext unrecoverable. The mandatory offline
operator copy is therefore a production cutover gate. End users do not handle recovery material.

## Local-first data flow

- App open with valid local state: zero Vercel crypto calls, zero Edge Functions, no blocking cloud
  read; decrypt locally and render.
- Edit/import: update memory immediately, encrypt private payload and capsule locally, persist
  encrypted IndexedDB state, then write ciphertext directly to Supabase under owner RLS.
- New device/storage reset: one broker request, then direct ciphertext download and local decrypt.
- Supabase/Vercel outage: keep valid local state and show a non-destructive sync error.
- Concurrent cloud writes use an authenticated monotonically increasing revision and compare-and-
  swap conditional PostgREST update plus a database trigger that requires exactly `old + 1`; a
  stale client cannot silently overwrite a newer revision. A metadata-only preflight avoids
  downloading ciphertext twice, and the final cloud value is always read, decrypted, and compared
  before sync success is reported.

The original ICS bytes, calculated routes, ordinary gap results, overlap history, and old payload
versions are never uploaded.

## Friend availability capsule

The capsule is derived locally from fixed academic and private events. It contains no course,
section, activity, room, building, event label, reason, exact busy interval, or complete free/busy
grid.

For each term it includes only internal gaps between merged busy events. Candidates are clamped to
09:00–18:00, buffered by 15 minutes on each busy boundary, rounded inward to 30-minute boundaries,
and retained only when at least 60 minutes remain. Selection is deterministic, favors larger useful
windows, permits at most two candidates per weekday, and caps a term at eight candidates. There are
no before-first-class or after-last-class windows.

Even full disclosure of this capsule reveals only those few deliberately shareable rounded windows,
not a complete timetable or availability representation. This is the primary malicious-friend
defense; rate limits are secondary.

The common-gap API accepts only an opaque friendship ID and enumerated term. It intersects the two
stored capsules, deterministically sorts valid intersections, and returns at most three objects with
only `weekday`, `startMinute`, and `endMinute`. It offers no arbitrary slot/mask query. A fixed pair
of capsule revisions and term has a fixed response.

## Plaintext data classification

Plaintext retained because the server must query it:

- Auth/account/session metadata managed by Supabase Auth;
- opaque ownership UUIDs and opaque record/key/relationship IDs;
- friend display name (user-selected social label);
- invite hashes and expiry;
- friendship state and mutual-acceptance/revocation timestamps;
- crypto/schema/key/KEK versions, revision, update time, and ciphertext length;
- aggregate per-caller rate-limit counter and window start.

Encrypted because the server does not need to query it:

- full timetable and normalized meeting metadata;
- private/custom events and notes;
- residence choice/building and routing preferences;
- the lossy availability capsule itself.

## Browser and supply-chain boundary

The application has no application-authored raw-HTML insertion sink. The unused shadcn chart helper
that contained one was removed. Imported ICS fields, friend labels, route/building text, OAuth error
parameters and cloud JSON are rendered through React text nodes after validation/sanitization.
Client error telemetry receives only a fixed generic error, never the caught error value.

The production CSP permits scripts and workers only from the application origin, allows network
connections only to the exact Supabase project and OpenFreeMap tile origin, blocks frames, objects,
media and framing ancestors, and includes HSTS, MIME sniffing, referrer and permissions policies.
Inline styles remain allowed because the current React/MapLibre component stack applies runtime
styles; inline scripts and `unsafe-eval` remain forbidden. If the Supabase project changes, both
`vercel.json` and `public/_headers` must be updated deliberately.

No cryptography dependency was added; Web Crypto provides AES-GCM, RSA-OAEP and randomness. GitHub
Actions remain pinned to immutable commit SHAs, and no remote JavaScript is loaded.

## Staged migration and rollback

1. Add encrypted tables/RPCs and application code without changing legacy reads or deleting data.
2. Verify crypto, local restore, key bootstrap, RLS, common gaps, deletion, tamper failure, and a
   database-leak fixture with disposable accounts.
3. After the operator backs up the KEK, migrate each legacy row outside PostgreSQL through the
   user-scoped application path or independently reviewed trusted tooling: read one row, encrypt,
   upload, decrypt/compare, and mark verified without logging plaintext.
4. Enable encrypted reads/writes only after every intended row verifies. Keep a rollback deployment
   and the legacy rows during the observation period.
5. In a later destructive migration, after explicit production-data authorization, remove plaintext
   columns/functions/grants and regenerate types. Never copy the KEK into PostgreSQL.

If any gate fails, production remains on the existing known-good architecture. No intermediate
deployment may require an incomplete key system or delete plaintext before a verified replacement
exists.

Exact rollout, operator recovery and rollback steps are in
[`PRIVATE_CLOUD_MIGRATION_RUNBOOK.md`](PRIVATE_CLOUD_MIGRATION_RUNBOOK.md). The measured free-tier
model is in [`PRIVATE_CLOUD_CAPACITY.md`](PRIVATE_CLOUD_CAPACITY.md): 20,000 fully provisioned users
fit with planning headroom, while the 500 MB database limit becomes the first real boundary near
30,000 accounts.

## Current documentation anchors

- Supabase JWT signing keys and `getClaims()`:
  <https://supabase.com/docs/guides/auth/signing-keys>
- Supabase RLS: <https://supabase.com/docs/guides/database/postgres/row-level-security>
- Supabase billing quotas: <https://supabase.com/docs/guides/platform/billing-on-supabase>
- Vercel Sensitive Environment Variables:
  <https://vercel.com/docs/environment-variables/sensitive-environment-variables>
- Vercel Function usage: <https://vercel.com/docs/functions/usage-and-pricing>
- Web Crypto API: <https://developer.mozilla.org/docs/Web/API/Web_Crypto_API>
