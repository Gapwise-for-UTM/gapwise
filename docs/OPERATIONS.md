# Architecture and operations

## System shape

Gapwise is a local-first React/Vite application. The browser parses an ACORN calendar, calculates timetable gaps, runs the deterministic UTM route graph, and encrypts private state before optional cloud synchronization. The original file, calculated gaps, and calculated routes do not leave the browser. GitHub OAuth and passwordless email links use Supabase Auth.

Production is built from GitHub `main` by Vercel and served from `https://gapwise-utm.vercel.app`. Private cloud is permanently encrypted-only in source; the legacy plaintext cloud tables and overlap helpers have been retired.

| Concern                                        | Owner                  | Notes                                                                                        |
| ---------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------- |
| UI, parsing, gaps, routing, private encryption | Browser                | Guest mode works without Supabase; signed-in private cloud data is encrypted before storage. |
| Auth, ciphertext, wrapped keys, relationships  | Supabase               | Owner RLS; no Vercel KEK in the database.                                                    |
| Device key broker and common gap               | Vercel Functions       | Verified JWT, caller-scoped Supabase client, KEK; no service role.                           |
| Account deletion                               | Supabase Edge Function | JWT required; identity comes from the verified token.                                        |
| Static build and domains                       | Vercel                 | SPA fallback, CSP and security headers come from repository configuration.                   |
| Verification                                   | GitHub Actions         | App checks, browser E2E, accessibility, PWA, and isolated PostgreSQL security checks.        |

## Local setup

Install Bun 1.3.14, then run:

```sh
bun install --frozen-lockfile
cp .env.example .env.local
bun run dev
```

`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are optional for guest mode. There is no private-cloud rollout-mode variable anymore. Never place a database password, OAuth secret, Supabase secret/service-role key, KEK or raw DEK in a `VITE_` variable.

## Environment consistency

Use the same public Supabase variable names for development, preview and production. Private functions require server-only `GAPWISE_ACTIVE_KEK_VERSION` plus matching `GAPWISE_KEK_V<n>` Sensitive variables. Preview and production must never share a KEK. Verify names and scopes without printing values.

Keep the production Site URL and redirect allowlists exact. Preview authentication should be enabled only for explicitly trusted preview origins. The production account-deletion Edge Function uses exact-origin CORS; temporary preview origins must be removed immediately after disposable testing.

## Database and Edge Functions

Apply migrations in filename order. Never edit an already-applied migration; add a new migration instead.

```sh
supabase db push
supabase gen types typescript --linked > src/lib/database.types.ts
supabase functions deploy delete-account
```

Review generated type changes before committing. Keep JWT verification enabled for `delete-account`. The hosted Edge Function owns its administrative Supabase credential; Vercel private-cloud functions must not receive a service-role key.

The completed private-cloud migration and KEK recovery/rotation procedures are documented in [`PRIVATE_CLOUD_MIGRATION_RUNBOOK.md`](PRIVATE_CLOUD_MIGRATION_RUNBOOK.md).

## Verification

Run the same application gates as CI:

```sh
bun install --frozen-lockfile
bun run typecheck
bun run lint
bun test
bun run build
bun run format:check
bunx playwright install chromium webkit
bun run test:e2e
```

The Playwright release suite covers Chromium and WebKit at desktop and phone-sized viewports, including import, timetable, gap/route navigation, malformed input, privacy persistence, PWA/offline-shell behavior, and automated accessibility checks.

For database changes also run the isolated Supabase suite:

```sh
supabase db start
supabase test db
supabase db lint --local --level warning --fail-on error
```

After a production deployment verify the canonical domain, intended GitHub commit, response security headers, Vercel runtime errors, Supabase advisors, fresh-device encrypted restore, same-device local restore, sign-out cleanup, bounded common-gap behavior and account deletion with disposable data where destructive testing is required.

Use [`LAUNCH_READINESS.md`](LAUNCH_READINESS.md) before a stable release or major announcement.

## Production monitoring

Keep monitoring lightweight and privacy-preserving:

- review Vercel runtime errors and function status codes after deployments;
- monitor Vercel function invocations/transfer and Supabase database size/egress;
- review Supabase Security and Performance Advisors after migrations;
- watch encrypted revision health with aggregate queries only;
- never dump production ciphertext, timetable plaintext, keys, tokens, emails or relationship contents to logs/analytics;
- do not add polling or background location tracking merely for monitoring.

## Troubleshooting

- **Blank map:** confirm WebGL 2 and inspect MapLibre worker/style/tile requests. The written route remains the accessible fallback.
- **Sign-in error:** compare the browser origin with Supabase Site URL and exact redirect allowlist. Never use unrestricted wildcards.
- **Cloud controls disabled:** verify the public Supabase variables exist. Guest parsing/routing should still work.
- **Private-cloud API 503:** verify server-only KEK variable names/scopes without revealing values. Never add a Supabase service-role key to Vercel.
- **Encrypted conflict:** keep the valid local record; revision failures are intentional stale-write protection.
- **Direct route 404:** confirm the Vercel SPA rewrite remains configured.
- **Schema mismatch:** compare migration history, live RLS/privileges and regenerated database types before writing data.

## Security expectations

Treat calendar files, OAuth parameters, browser storage, cloud JSON, device public keys and map responses as untrusted. Keep size/count limits, validate decrypted payloads, rely on RLS rather than client filters and grant browser roles only the operations they use.

Gapwise is defense in depth, not E2EE or zero knowledge. A malicious same-origin deployment, compromised browser/device, stolen authenticated session or sufficiently broad simultaneous Supabase/Vercel compromise can expose data in memory or through the trusted key-broker boundary.
