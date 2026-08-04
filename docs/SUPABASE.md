# Supabase setup and security

Gapwise supports GitHub OAuth and passwordless email magic links through Supabase Auth, PostgREST with Row Level Security, and one narrowly scoped Edge Function. Guest mode does not require Supabase.

## Browser configuration

Expose only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. A publishable key identifies the project but cannot bypass RLS. Never expose a secret/service-role key in frontend source, Vite variables, CI output, documentation, or browser requests.

Apply the files in `supabase/migrations` in filename order for a new environment. The repository's
initial migration version matches the connected project's migration history, and
the follow-up privilege migration removes Supabase default grants the browser
does not need. Both user tables:

- reference `auth.users(id)` with `ON DELETE CASCADE`;
- enable RLS;
- restrict select, insert, update, and delete to `auth.uid() = user_id` (including `WITH CHECK` for writes);
- revoke access from `anon` and grant only select, insert, update, and delete to `authenticated`.

There are no `USING (true)` policies, public user-data grants, or security-definer functions. The current schema has two user-owned tables: `user_schedules` and `user_preferences`.

### Safe `source_filename` removal order

The `20260804040016_remove_schedule_source_filename.sql` migration permanently removes a legacy metadata column. For an existing deployment, use this order:

1. Deploy the frontend version that no longer sends `source_filename`.
2. Verify guest import, explicit cloud sync, and cloud restoration against the existing schema.
3. Only then run `supabase db push` to apply the column-removal migration.
4. Verify sync/restoration again and regenerate linked database types if the project schema differs.

Do not apply the migration before the compatible frontend is serving users. The migration does not alter RLS policies, ownership checks, cascading account deletion, or table grants. This repository change does not apply the migration to the hosted database.

## Browser auth sessions

The browser client uses Supabase's supported persistent-session configuration: `persistSession`, automatic token refresh, OAuth URL detection, and a `localStorage` adapter. A signed-in user therefore remains signed in across reloads and normal browser restarts. If browser privacy settings block storage, auth falls back to memory for the current page instead of crashing; that fallback is intentionally not durable.

The app owns one page-lifetime `onAuthStateChange` subscription. Auth initialization does not make a second `getSession` request, cloud restoration is single-flight per user, and sign-out aborts/invalidates stale restoration work before clearing the local Supabase session. **Remember on this device** remains a separate opt-in timetable setting and does not control authentication.

Use **Sign out** on shared devices. It clears the local browser auth session only; it does not delete the GitHub/email identity, synced schedule, or preferences. Use **Delete account and cloud data** for permanent server-side deletion.

## Account deletion Edge Function

`supabase/functions/delete-account/index.ts` accepts only authenticated `POST` requests. It verifies the bearer token with Supabase, derives the ID from that verified user, and ignores all browser-supplied identity. The Admin API runs only inside the function. Deleting `auth.users` cascades to every current user-owned row.

Deletion order is authentication user first with database cascades in the same database operation. A failure returns a generic error and the UI does not claim success. If infrastructure interrupts the request, retrying is safe: no cross-user identifier is accepted, and already-cascaded rows cannot become orphans.

The canonical production and local origins are source-controlled. Add any other
exact trusted origins through the optional server-side secret (names only; never
commit values):

```sh
supabase secrets set ALLOWED_ORIGINS=https://campus-gap-finder.vercel.app,http://localhost:8080
# SUPABASE_URL and administrative keys are supplied by hosted Edge Functions.
supabase functions deploy delete-account
```

Test with a disposable authenticated account:

```sh
curl -i -X POST "$SUPABASE_URL/functions/v1/delete-account" \
  -H "Authorization: Bearer <disposable-user-access-token>" \
  -H "apikey: <publishable-key>" \
  -H "Origin: http://localhost:8080" \
  -H "Content-Type: application/json" -d '{}'
```

Confirm a request without a bearer token is rejected, an origin outside `ALLOWED_ORIGINS` is rejected, a forged `user_id` body cannot affect the verified identity, all owned rows disappear, and the auth user can no longer sign in. Use disposable data only.

## Manual production checklist

- Enable GitHub and email magic-link authentication; disable unused phone and password authentication.
- Configure the email template and exact redirect allowlist for passwordless links. Do not add an email/password flow merely to clear the leaked-password warning.
- Set the exact production Site URL and localhost development redirect.
- Keep Vercel redirects narrow; avoid broad production wildcards.
- Verify only the publishable key is configured in Vercel.
- Keep the service-role key confined to hosted server-side secrets.
- Run Security Advisor and verify RLS remains enabled on every user-data table.
- Exercise read/write/delete with two test users and verify neither can access the other's rows.
- Re-run the account-deletion check whenever a user-owned table is added, and add a cascading foreign key.

## Free-plan limitations

Supabase's leaked-password protection may be unavailable or disabled depending on plan and Auth configuration. Gapwise uses GitHub OAuth and single-use email magic links; it does not add a password flow to silence that advisory. Dashboard advisories and provider settings require manual review; repository code cannot prove the deployed dashboard state.
