# Vercel deployment

Import the repository, use Bun, run `bun run build`, and publish `dist`.
`vercel.json` enforces `bun install --frozen-lockfile`, preserves client-side deep
links, and supplies security headers. Vercel supports the Bun 1.x line; CI and
local development use the repository's exact 1.3.14 pin.

Set only these browser-safe variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Never configure a Supabase secret or legacy service-role key as a Vercel frontend
or `VITE_` variable. Deploy the account-deletion Edge Function through Supabase.
Its canonical production/local origins are source-controlled; add preview origins
deliberately through `ALLOWED_ORIGINS` rather than using an unrestricted wildcard.

Production verification:

1. Open `/` and a deep link directly.
2. Confirm guest import works with Supabase variables absent.
3. Sign in through GitHub, explicitly sync, refresh, and confirm automatic restoration.
4. Verify refresh made no write request.
5. Open Day Route and confirm its code, worker, MapLibre tiles, and markers load only then.
6. Delete a disposable account and verify the selected local-data behavior.
