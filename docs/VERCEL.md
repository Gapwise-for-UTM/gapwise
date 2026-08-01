# Vercel deployment

Import the repository, use Bun, run `bun run build`, and publish `dist`. `vercel.json` preserves client-side deep links and security headers.

Set only these browser-safe variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Never configure `SUPABASE_SERVICE_ROLE_KEY` as a Vercel frontend or `VITE_` variable. Deploy the account-deletion Edge Function through Supabase, then set its `ALLOWED_ORIGINS` secret to the exact production origin. Add preview origins deliberately rather than using an unrestricted wildcard.

Production verification:

1. Open `/` and a deep link directly.
2. Confirm guest import works with Supabase variables absent.
3. Sign in through GitHub, explicitly sync, refresh, and confirm automatic restoration.
4. Verify refresh made no write request.
5. Open Day Route and confirm its code and MapLibre load only then.
6. Delete a disposable account and verify the selected local-data behavior.
