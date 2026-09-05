# Supabase setup and security

Gapwise uses Supabase Auth, PostgREST with Row Level Security, narrowly scoped database RPCs, and one account-deletion Edge Function. Guest mode does not require Supabase.

## Browser configuration

Expose only:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

The publishable key identifies the project but cannot bypass RLS. Never expose a database password, OAuth secret, Supabase secret/service-role key, KEK or raw DEK in frontend source, Vite variables, CI output, documentation or browser requests.

## Current production schema

Production is encrypted-only. The Gate 6 migration `20260812022934_retire_legacy_plaintext_cloud.sql` removed the legacy plaintext `user_schedules` and `user_preferences` tables plus the legacy plaintext overlap helpers after a fail-closed replacement precheck passed.

Current private-cloud tables are:

- `crypto_key_envelopes`: one owner-scoped wrapped-key envelope per user;
- `encrypted_private_data`: browser-encrypted timetable, custom events and private preferences;
- `encrypted_friend_availability`: separately encrypted deliberately lossy availability capsule;
- private aggregate rate-limit tables used only through security-definer RPCs.

Friend/social tables are:

- `friend_profiles`: owner-readable display label;
- `friendships`: unexposed participant pair and consent/revocation state;
- `friend_invites`: private invite-code hash with no browser-readable policy/grant.

The browser has no direct cross-user read path. Friend common-gap authorization is derived from `auth.uid()` and accepted relationship state. Vercel decrypts only the two bounded availability capsules and returns at most three rounded windows.

## RLS and privileges

User-owned encrypted tables use forced RLS. Browser roles receive only the table privileges required for owner-scoped ciphertext sync. Key-envelope update is restricted to the compare-and-swap rotation RPC. Friend mutation/read RPCs revoke default `PUBLIC`/`anon` execution, derive the caller from `auth.uid()`, validate fixed inputs and use controlled `SECURITY DEFINER` scope where access to unexposed relationship/invite data is required.

Security Advisor intentionally reports some `SECURITY DEFINER` functions as callable by `authenticated`; these are the documented public RPC boundary, not accidental grants. It also reports no-policy notices on tables intentionally inaccessible by direct browser policy. These findings are reviewed rather than silenced by weakening the design.

Gapwise uses Microsoft, Google, and GitHub OAuth. It does not offer passwordless email links or an email/password flow merely to clear Supabase's leaked-password advisory.

## Encrypted private cloud

The browser encrypts private payloads and friend-availability capsules with AES-256-GCM and non-extractable Web Crypto keys. Vercel Functions hold only server-side versioned KEKs. Neither Vercel private-cloud function has a Supabase service-role credential.

Server-only variables:

- `GAPWISE_ACTIVE_KEK_VERSION`
- `GAPWISE_KEK_V1` and future `GAPWISE_KEK_V<n>` values

Never store a KEK in Supabase or a `VITE_*` variable. Keep an offline recovery copy before activating a KEK. Preview and production must use different KEKs.

See [`PRIVATE_CLOUD_MIGRATION_RUNBOOK.md`](PRIVATE_CLOUD_MIGRATION_RUNBOOK.md) for recovery and rotation procedures and [`PRIVATE_CLOUD_SECURITY_ARCHITECTURE.md`](PRIVATE_CLOUD_SECURITY_ARCHITECTURE.md) for the trust boundary.

## Account deletion

`supabase/functions/delete-account/index.ts` accepts authenticated `POST` requests only, verifies the bearer token, derives identity from the verified user and uses exact-origin CORS. Deleting the Auth user cascades through user-owned encrypted rows, key envelopes, friend profile/invite/relationship state and private rate-limit state.

Vercel does not receive the account-deletion service-role capability.

## Verification

For schema/security changes run:

```sh
supabase db start
supabase test db
supabase db lint --local --level warning --fail-on error
```

Then review both Supabase advisors and inspect each notice. Run application CI as well:

```sh
bun run typecheck
bun run lint
bun test
bun run build
bun run format:check
```

Regenerate linked database types after hosted schema changes:

```sh
supabase gen types typescript --linked > src/lib/database.types.ts
```

Never edit an already-applied migration body. Add a new migration for future production changes.

## Advisor disposition at launch

The final Gate 6 advisor review contains no unaccounted launch blocker. Security notices are the intentional no-direct-policy/security-definer RPC design plus leaked-password protection for a product that does not use passwords. Performance notices are unused friendship indexes on an effectively empty/low-volume social table; do not remove useful defensive indexes merely to silence an early usage statistic.

Re-run advisors after every DDL/security change.
