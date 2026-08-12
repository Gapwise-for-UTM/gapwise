# Gapwise private cloud security architecture

Status: deployed in production, encrypted-only. The legacy plaintext timetable/preferences tables and plaintext friend-overlap helpers were retired after the fail-closed Gate 6 replacement check passed.

## Security claim and limits

The intended guarantee is deliberately narrow:

> A compromise of the Gapwise application database alone does not reveal private timetable contents, private custom events, residence/private routing settings, or detailed friend availability.

Supabase Auth necessarily retains account/authentication metadata. The application database also retains minimal relationship, ciphertext size, revision, update-time, key-version and opaque identifier metadata. This design is defense in depth, not E2EE, zero knowledge or a claim that Gapwise is unhackable.

The design does not protect plaintext currently in application memory from a compromised device, operating system, browser extension, injected same-origin script, stolen authenticated session or malicious application deployment. A sufficiently broad simultaneous compromise of Supabase and the trusted Vercel runtime can also expose data.

## Trust split

### Browser

The browser parses the ICS file, owns interactive plaintext while the app is open, creates non-extractable device/private-data keys, performs normal private-data encryption/decryption, derives the lossy friend-availability capsule locally and runs timetable/gap/route calculations locally. The original ICS bytes, ordinary gap results and calculated routes are not uploaded.

### Supabase

Supabase Auth issues user sessions. PostgreSQL stores encrypted private payloads, encrypted lossy friend capsules, KEK-wrapped per-user data-encryption keys and minimal friend/relationship metadata under RLS. Supabase does not store the Vercel KEK.

### Vercel

The key-broker and common-gap Functions hold versioned server-only KEKs. They verify Supabase sessions and use caller-scoped Supabase access. The broker unwraps only the authenticated user's DEKs and re-wraps them to the submitted device public key. The common-gap path decrypts only bounded lossy availability capsules and returns at most three rounded common windows.

Neither private-cloud Vercel function has a Supabase service-role credential.

### Operator

The operator keeps an offline recovery copy of every active production KEK and configures matching Vercel Sensitive production variables. Preview and production must never share a KEK.

## Cryptographic domains

Each signed-in user has independent AES-256-GCM domains for:

- `private-data`: timetable, custom events, residence and private routing/preferences;
- `friend-availability`: deliberately lossy bounded candidate windows.

Every encryption uses a fresh 96-bit nonce and authenticated context (AAD) binding the purpose, versions, subject and opaque record/key identifiers. Authentication failure, malformed input, unsupported version or AAD mismatch fails closed. Keys are non-extractable in the normal browser path.

## Local-first flow

- Normal reload with valid local encrypted state: decrypt locally without a broker request.
- Edit/import: update memory, encrypt locally, persist encrypted local state, then sync ciphertext under owner RLS.
- New device/storage reset: authenticate, call the key broker, download ciphertext and decrypt locally.
- Cloud outage: valid local state remains usable; sync fails non-destructively.
- Concurrent writes: authenticated revisions and compare-and-swap protection prevent stale silent overwrites.

## Friend availability privacy

The published capsule contains no course, section, activity, room, building, event label, reason or complete free/busy grid. It includes only a small deterministic set of internal daytime gaps after buffering, inward 30-minute rounding, minimum-duration filtering and caps.

The common-gap API accepts only an opaque friendship ID and term, requires a mutually accepted relationship and returns at most three canonical objects containing only `weekday`, `startMinute` and `endMinute`.

## Plaintext classification

Plaintext retained because the system must query it:

- Supabase Auth/account/session metadata;
- opaque ownership/record/key/relationship identifiers;
- user-selected friend display name;
- invite hashes/expiry;
- friendship consent/revocation state;
- crypto/schema/key/KEK versions, revisions and timestamps;
- aggregate rate-limit counters.

Encrypted before cloud storage:

- full timetable and normalized meeting metadata;
- private/custom events and notes;
- residence choice/building and routing preferences;
- the lossy friend-availability capsule itself.

## Browser and supply-chain boundary

The application avoids application-authored raw-HTML sinks for untrusted content, validates decrypted/cloud payloads, keeps client error telemetry generic and uses a restrictive production CSP/security-header configuration. GitHub Actions dependencies are pinned to immutable revisions and no cryptography dependency replaces Web Crypto.

## KEK lifecycle

Server configuration uses versioned names such as `GAPWISE_ACTIVE_KEK_VERSION` and `GAPWISE_KEK_V1`. Rotation re-wraps DEKs under a newer KEK without re-encrypting full timetable ciphertext. The previous KEK remains available until every envelope has migrated and the replacement recovery copy is verified.

Loss of every copy of an active KEK makes associated cloud ciphertext unrecoverable. Suspected KEK exposure requires forward rotation; never copy the KEK into PostgreSQL or browser code.

## Production migration result

The staged rollout used additive encrypted tables first, disposable preview proof, real-user shadow migration, encrypted authoritative cutover and a separate explicit Gate 6 cleanup. Before Gate 6, production had one legacy schedule/preference owner with complete encrypted replacement material. The final precheck found zero incomplete replacements. The destructive migration then removed `public.user_schedules`, `public.user_preferences`, `public.get_friend_gap_overlaps(text)`, `private.schedule_gap_windows(uuid,text)` and `private.is_valid_schedule_meeting(jsonb,text)` while preserving the encrypted private row, key envelope and encrypted friend-availability row.

Recovery and rotation procedures are in [`PRIVATE_CLOUD_MIGRATION_RUNBOOK.md`](PRIVATE_CLOUD_MIGRATION_RUNBOOK.md). Launch verification is tracked in [`LAUNCH_READINESS.md`](LAUNCH_READINESS.md).
