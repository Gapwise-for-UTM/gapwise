# Vercel deployment

Gapwise production is deployed from GitHub `main` to Vercel. `vercel.json` pins the install/build commands, serves `dist`, defines the two Node function entry points, preserves SPA deep links, applies long-lived caching to hashed assets, and supplies the production security headers.

## Browser-safe variables

Expose only:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Private cloud is permanently encrypted-only in source. There is no `VITE_PRIVATE_CLOUD_MODE` rollout variable.

Never configure a database password, OAuth secret, Supabase secret/service-role key, KEK, or raw DEK as a Vercel frontend variable or any `VITE_*` value.

## Server-only private-cloud variables

The `/api/key-broker` and `/api/common-gap` Node functions use:

- the public Supabase URL and publishable key needed to create a caller-scoped client;
- the caller's verified bearer token; and
- server-only `GAPWISE_ACTIVE_KEK_VERSION` plus matching `GAPWISE_KEK_V<n>` Sensitive variables.

Production and Preview must never share a KEK. Vercel private-cloud functions must not receive a Supabase service-role credential. Keep an offline recovery copy of every active production KEK version before activation and follow [`PRIVATE_CLOUD_MIGRATION_RUNBOOK.md`](PRIVATE_CLOUD_MIGRATION_RUNBOOK.md) for recovery and rotation.

The account-deletion Edge Function is deployed through Supabase, not Vercel. Its production/local origins are exact and source-controlled; temporary Preview origins must be explicitly added and removed rather than replaced with an unrestricted wildcard.

## Request boundary

`vercel.json` gives each private-cloud function a ten-second ceiling. The API boundary enforces same-origin JSON POST, strict request/response size limits, fixed schemas, verified Supabase authentication, caller-scoped database access, and generic server errors.

The production CSP permits the narrow WebAssembly compilation capability required by the lazy-loaded 3D model viewer through `'wasm-unsafe-eval'`; it does not enable general JavaScript `'unsafe-eval'`.

## Production verification

After a production deployment:

1. Confirm the deployment is `READY`, targets `production`, and corresponds to the intended `main` commit.
2. Open `/` and at least one deep link directly.
3. Confirm guest import, timetable gaps, and bundled routing work without requiring signed-in cloud state.
4. With a signed-in test context, verify encrypted restore, encrypted sync, same-device local restore, sign-out cleanup, and bounded friend overlap as appropriate for the change.
5. Confirm ordinary timetable/gap/route use remains local-first and does not introduce unnecessary Vercel function calls.
6. Confirm response headers retain the restrictive CSP, HSTS, `nosniff`, strict referrer policy, restrictive permissions policy, and frame denial.
7. Review Vercel runtime errors after the deployment without logging private timetable data, ciphertext, tokens, or key material.
8. For destructive account-deletion testing, use disposable data and verify both cloud cascades and local cleanup.

Production plaintext timetable/settings storage and the legacy plaintext overlap implementation were retired in Gate 6. Do not reintroduce a plaintext fallback to recover from an outage; use the recovery procedures in [`OPERATIONS.md`](OPERATIONS.md) and the private-cloud runbook.
