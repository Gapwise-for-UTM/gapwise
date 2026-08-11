# Vercel deployment

Import the repository, use Bun, run `bun run build`, and publish `dist`.
`vercel.json` enforces `bun install --frozen-lockfile`, preserves client-side deep
links, and supplies security headers. Vercel supports the Bun 1.x line; CI and
local development use the repository's exact 1.3.14 pin.

Set only these browser-safe variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_PRIVATE_CLOUD_MODE` (`off` until the migration runbook authorizes another mode)

Never configure a Supabase secret or legacy service-role key as a Vercel frontend
or `VITE_` variable. Deploy the account-deletion Edge Function through Supabase.
Its canonical production/local origins are source-controlled; add preview origins
deliberately through `ALLOWED_ORIGINS` rather than using an unrestricted wildcard.

The `/api/key-broker` and `/api/common-gap` Node functions use only:

- the same public Supabase URL and publishable key needed to create a caller-scoped client;
- the caller's verified bearer token;
- server-only `GAPWISE_ACTIVE_KEK_VERSION` and `GAPWISE_KEK_V<n>` values.

KEKs must be Vercel **Sensitive** variables and must never be exposed to the frontend. Vercel must
not have a Supabase service-role/secret key. Generate a separate Preview KEK; never copy the
production KEK to Preview. Production KEK creation is paused until the operator completes the
offline recovery action in
[`PRIVATE_CLOUD_MIGRATION_RUNBOOK.md`](PRIVATE_CLOUD_MIGRATION_RUNBOOK.md).

`vercel.json` gives each function a ten-second ceiling. Both enforce same-origin JSON POST, strict
8 KB request/response boundaries, exact schemas, verified Supabase JWT claims and generic errors.
The SPA catch-all does not override filesystem `/api` routes.

Production verification:

1. Open `/` and a deep link directly.
2. Confirm guest import works with Supabase variables absent.
3. With mode `off`, sign in, explicitly sync, refresh and confirm the known-good legacy path.
4. After the additive schema and preview-only KEK exist, use disposable users to verify encrypted
   sync, local IndexedDB restore without a broker request, storage-reset bootstrap and common gap.
5. Verify a routine edit calls no Vercel/Edge crypto function and makes only direct RLS ciphertext
   requests; verify the metadata preflight does not return ciphertext twice.
6. Open Day Route and confirm its code, worker, MapLibre tiles and markers load only then.
7. Confirm CSP has no wildcard Supabase origin, `unsafe-eval`, frames or object source; verify HSTS,
   the exact Supabase connection origin and OpenFreeMap still work without console violations.
8. Delete a disposable account and verify both cloud cascades and local key/state cleanup.
