# Architecture and operations

## System shape

Gapwise is a local-first React/Vite application. The browser parses an ACORN calendar, calculates timetable gaps, runs the UTM route graph, and encrypts private state before optional cloud synchronization. The original file, calculated gaps, and calculated routes do not leave the browser. Microsoft, Google, and GitHub OAuth use Supabase Auth.

Production is built from GitHub `main` by Vercel and served from `https://gapwise.ca`. Private cloud is encrypted-only in source; legacy plaintext timetable/settings storage and overlap helpers have been retired.

| Concern | Owner | Notes |
| --- | --- | --- |
| UI, parsing, gaps, routing, private encryption | Browser | Guest mode works without Supabase; signed-in private data is encrypted before storage. |
| Auth, ciphertext, wrapped keys, relationships | Supabase | Owner RLS; no Vercel KEK in the database. |
| Device key broker and common gap | Vercel Functions | Verified JWT, caller-scoped Supabase client, KEK; no service role. |
| Account deletion | Supabase Edge Function | JWT required; identity comes from the verified token. |
| Static build, canonical domain, security headers | Vercel | `main` is production. |
| Verification | GitHub Actions | App checks, browser E2E/accessibility/PWA, and isolated PostgreSQL security checks. |

## Local setup

Use Bun 1.3.14 and Node 24.x where Node tooling is required:

```sh
bun install --frozen-lockfile
cp .env.example .env.local
bun run dev
```

`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are optional for guest mode. Never place a database password, OAuth secret, Supabase service-role credential, KEK, or raw DEK in a `VITE_` variable.

## Environment consistency

Use the same public Supabase variable names for development, preview, and production. Private functions require server-only `GAPWISE_ACTIVE_KEK_VERSION` plus matching `GAPWISE_KEK_V<n>` sensitive variables. Preview and production must never share a KEK. Verify names/scopes without printing values.

Keep Supabase Site URL and redirect allowlists exact. The production account-deletion Edge Function uses exact-origin CORS for the canonical production domain; temporary preview origins must be deliberately added for disposable testing and removed immediately afterward.

## Database and Edge Functions

Apply migrations in filename order. Never edit an already-applied migration; add a new migration.

```sh
supabase db push
supabase gen types typescript --linked > src/lib/database.types.ts
supabase functions deploy delete-account
```

Review generated type changes before committing. Keep JWT verification enabled for `delete-account`. The hosted Edge Function owns its administrative Supabase credential; Vercel private-cloud functions must not receive a service-role key.

Private-cloud migration and KEK recovery/rotation procedures are documented in [`PRIVATE_CLOUD_MIGRATION_RUNBOOK.md`](PRIVATE_CLOUD_MIGRATION_RUNBOOK.md).

## Verification

Typical application gates:

```sh
bun install --frozen-lockfile
bun run typecheck
bun run lint
bun test
bun run build
bun run format:check
bun run test:e2e
```

The Playwright release suite covers Chromium and WebKit at desktop and phone-sized viewports, including import, timetable, gap/route navigation, malformed input, privacy persistence, PWA/offline behavior, and automated accessibility checks.

For database changes also run:

```sh
supabase db start
supabase test db
supabase db lint --local --level warning --fail-on error
```

After a production deployment, verify the canonical domain, intended GitHub commit, security headers, Vercel runtime errors, Supabase health/advisors, and the user journeys materially affected by the release. Destructive auth/data tests must use disposable accounts/data.

Use [`LAUNCH_READINESS.md`](LAUNCH_READINESS.md) for stable release/major-announcement verification.

## GitHub/Vercel release discipline

`main` is production. A branch push can create both CI work and a Vercel preview, and a merge creates production validation/deployment work. Keep that fan-out deliberate.

1. **Verify locally first.** Do not use GitHub Actions as the first place to discover formatting, type, or obvious test failures.
2. **Batch coherent work.** Prefer one complete branch update over multiple tiny fixup pushes.
3. **One focused PR.** Avoid splitting tightly coupled documentation/code correctness into multiple PRs just to create activity.
4. **Rerun instead of repush.** For flaky/environmental CI, rerun failed jobs/runs when possible; do not create a no-op commit.
5. **Squash-merge.** Keep `main` concise and minimize production deployment churn.
6. **No speculative deploys.** Do not push merely to see whether Vercel/CI will catch something local tooling can answer.
7. **Do not bypass real required-check failures.** Minimize CI cost by reducing pushes, not by weakening correctness gates.

For docs-only changes, still check Markdown/link consistency and any repository formatting rules, but do not create unrelated source edits just to justify heavyweight validation.

## Production monitoring

Keep monitoring lightweight and privacy-preserving:

- review Vercel runtime errors/function status after deployments;
- monitor Vercel invocations/transfer and Supabase database size/egress;
- review Supabase Security/Performance Advisors after migrations;
- use aggregate operational metrics only;
- never dump ciphertext, timetable plaintext, keys, tokens, emails, or relationship contents to logs/analytics;
- do not add polling or background location tracking merely for monitoring.

## Troubleshooting

- **Blank map:** confirm WebGL 2 and inspect MapLibre worker/style/tile requests. Written route guidance remains the accessible fallback.
- **Sign-in error:** compare browser origin with Supabase Site URL/exact redirect allowlist; avoid unrestricted wildcards.
- **Cloud controls disabled:** verify public Supabase variables. Guest parsing/routing must still work.
- **Private-cloud API 503:** verify server-only KEK names/scopes without exposing values; never add a service-role key to Vercel.
- **Encrypted conflict:** keep the valid local record; revision failures are intentional stale-write protection.
- **Direct route 404:** confirm the Vercel SPA rewrite remains configured.
- **Schema mismatch:** compare migration history, live RLS/privileges, and regenerated types before writing data.

## Security expectations

Treat calendar files, OAuth parameters, browser storage, cloud JSON, device public keys, and map responses as untrusted. Keep size/count limits, validate decrypted payloads, rely on RLS rather than client filters, and grant browser roles only required operations.

Gapwise is defense in depth, not E2EE or zero knowledge. A malicious same-origin deployment, compromised browser/device, stolen authenticated session, or sufficiently broad simultaneous Supabase/Vercel compromise can expose data in memory or through the trusted key-broker boundary.
