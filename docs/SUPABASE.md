# Supabase setup and security

Gapwise supports GitHub OAuth and passwordless email magic links through Supabase Auth, PostgREST
with Row Level Security, narrowly scoped database RPCs, and one account-deletion Edge Function.
The staged private-cloud path stores application-encrypted private data and encrypted lossy friend
capsules. Guest mode does not require Supabase.

## Browser configuration

Expose only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. A publishable key identifies the project but cannot bypass RLS. Never expose a secret/service-role key in frontend source, Vite variables, CI output, documentation, or browser requests.

Apply the files in `supabase/migrations` in filename order for a new environment. Every repository
version through the currently deployed friend migration, including the hosted `20260807132654`
source-filename migration, matches production history. The follow-up privilege migration removes
Supabase default grants the browser
does not need. Both user tables:

- reference `auth.users(id)` with `ON DELETE CASCADE`;
- enable RLS;
- restrict select, insert, update, and delete to `auth.uid() = user_id` (including `WITH CHECK` for writes);
- revoke access from `anon` and grant only select, insert, update, and delete to `authenticated`.

There are no `USING (true)` policies or public user-data grants. `user_schedules` and
`user_preferences` remain strictly owner-readable: accepted friends do not receive a cross-user
table policy. The friend feature adds three public tables with RLS:

- `friend_profiles`: a user-selected display label with owner-only direct reads; current
  connections receive the label only through a minimal projection RPC;
- `friendships`: an unexposed canonical pair with separate requester and recipient acceptance
  timestamps;
- `friend_invites`: a 192-bit private-code hash with no browser-readable policy or grant.

The friend mutation and overlap RPCs require `authenticated`, revoke default `PUBLIC`/`anon`
execution, set an empty `search_path`, and derive the caller only from `auth.uid()`. Their
`SECURITY DEFINER` scope is required for the unexposed invite-hash lookup and the derived
cross-user calculation; it is never used to make a table directly readable.

`public.list_friend_connections()` projects only an opaque friendship ID, status, direction,
display label, and update time. The browser receives neither participant's Supabase Auth UUID and
has no direct `SELECT` grant on `friendships`.

## Legacy friend overlap privacy boundary

While `VITE_PRIVATE_CLOUD_MODE` is `off` or `shadow`,
`public.get_friend_gap_overlaps(term)` is the only cross-user schedule path. It locks and verifies
an active friendship row with both acceptance timestamps and no revocation, then returns a fixed
contract:

- opaque friendship ID and the connected user's minimal display label;
- weekday;
- 30-minute-rounded start and end minutes;
- at most three mutual windows per friend and term.

It never returns meetings, course codes, activity types, sections, rooms, raw gap rows, either
full timetable, or availability outside the intersection. Schedule normalization treats
`courseCode + activityType` as the event-component key, so `LEC`, `TUT`, and `PRA` rows for the
same course remain separate busy events. A small private rate-limit row stores only the caller and
an aggregate count—never a friend identifier or result history. The RPC allows 30 refreshes per
caller per rolling hour; repeated calls cannot change the fixed response contract.

Friend connection does not provide an email/account directory. A user creates a single-use,
24-hour private code and shares it out of band. Entering it always shows the same generic response,
whether the code is valid, invalid, expired, used, or self-owned. A valid claim creates only a
pending request; the code owner must separately accept it. This flow neither sends nor consumes an
Auth magic link, so the two-emails-per-hour Auth limit is unrelated to friend requests.

Either participant can decline, cancel, or remove a relationship. That transaction marks the row
revoked, after which RLS hides it and the overlap RPC rejects it. A new connection requires a new
private code and fresh two-party acceptance.

The forward migration is
`supabase/migrations/20260811002848_friend_timetable_overlap.sql`. Its scoped rollback is
`supabase/rollbacks/20260811002848_friend_timetable_overlap.sql`; rollbacks are operator-run and
are not part of normal `supabase db push` ordering.

The pgTAP suite in `supabase/tests/database/friend_overlap_rls.test.sql` proves direct-query
isolation, pending/declined/revoked denial, activity-type mismatch behavior, response minimization,
and account-deletion cleanup. Run it against an isolated local database:

```sh
supabase db start
supabase test db
supabase db lint --local --level warning --fail-on error
```

## Encrypted private-cloud phase

`20260811063830_encrypted_private_cloud_phase1.sql` adds, without altering legacy values:

- one owner-RLS key-envelope row containing two Vercel-KEK-wrapped DEKs;
- one owner-RLS encrypted private payload row;
- one owner-RLS encrypted, deliberately lossy availability capsule row;
- one private aggregate caller rate-limit row;
- a friend-material RPC that derives identity from `auth.uid()` and returns only two encrypted
  capsules plus the minimum wrapped availability-key material.

`20260811063841_encrypted_key_envelope_rotation.sql` adds the only key-envelope update surface. It
compare-and-swaps the authenticated caller's wraps to a strictly higher KEK version. The browser
role has no direct envelope `UPDATE` grant. Both RPCs revoke `PUBLIC` and `anon`, use an empty
`search_path`, validate fixed inputs, and accept no user ID as authority.

The browser directly writes only its own ciphertext rows. Immutable context and an exact
`old revision + 1` trigger prevent stale-device overwrites. Friends have no direct cross-user table
policy. In authoritative encrypted mode the legacy plaintext overlap RPC is not called; Vercel
decrypts only the two bounded capsules and returns at most three rounded windows.

The encrypted pgTAP suite has 50 assertions covering grants, forced RLS, cross-user reads/writes,
accepted/pending/revoked friend material, identity substitution, rotation CAS, revision/context
guards and cascading deletion. Run it only against the isolated CI/local database.

Both migrations were applied to production on 2026-08-11 after the isolated database-security and
application CI jobs passed. Post-apply checks found RLS enabled and forced on every new table and
both legacy private-data tables, with zero key-envelope or ciphertext rows. The one legacy schedule
and preference row remain unchanged and authoritative. Follow
[`PRIVATE_CLOUD_MIGRATION_RUNBOOK.md`](PRIVATE_CLOUD_MIGRATION_RUNBOOK.md); production remains `off`
until disposable preview proof and operator KEK recovery both pass.

### Safe `source_filename` removal order

The `20260807132654_remove_schedule_source_filename.sql` migration permanently removes a legacy metadata column. For an existing deployment, use this order:

1. Deploy the frontend version that no longer sends `source_filename`.
2. Verify guest import, explicit cloud sync, and cloud restoration against the existing schema.
3. Only then run `supabase db push` to apply the column-removal migration.
4. Verify sync/restoration again and regenerate linked database types if the project schema differs.

Do not apply the migration before the compatible frontend is serving users. The migration does not alter RLS policies, ownership checks, cascading account deletion, or table grants. This repository change does not apply the migration to the hosted database.

### Residence-preference migration order

`20260810200438_add_residence_preferences.sql` adds constrained `day_origin` and nullable
`residence_building_code` columns to the existing owner-scoped preference row. It does not create a
location-history table, infer a residence, or change RLS/grants. For an existing deployment:

1. Run `supabase db push` before deploying the residence-aware frontend. The old frontend remains
   compatible because both columns have safe commuter defaults.
2. Deploy the new frontend and verify guest local persistence first.
3. With a disposable signed-in user, save/load both commuter mode and one residence, then confirm a
   second user cannot read that row.
4. Regenerate linked database types if the hosted schema differs from `src/lib/database.types.ts`.

## Browser auth sessions

The browser client uses Supabase's supported persistent-session configuration: `persistSession`, automatic token refresh, OAuth URL detection, and a `localStorage` adapter. A signed-in user therefore remains signed in across reloads and normal browser restarts. If browser privacy settings block storage, auth falls back to memory for the current page instead of crashing; that fallback is intentionally not durable. Authentication session storage is separate from private application data: raw DEKs and private timetable JSON never enter localStorage/sessionStorage in encrypted mode.

The app owns one page-lifetime `onAuthStateChange` subscription. Auth initialization does not make a second `getSession` request, cloud restoration is single-flight per user, and sign-out aborts/invalidates stale restoration work before clearing the local Supabase session. **Remember on this device** remains a separate opt-in timetable setting and does not control authentication.

Use **Sign out** on shared devices. It clears the local auth session and the signed-in user's
non-extractable device key, DEKs, encrypted local records and decrypted application state; it does
not delete the provider identity or cloud ciphertext. Use **Delete account and cloud data** for
permanent server-side deletion.

## Account deletion Edge Function

`supabase/functions/delete-account/index.ts` accepts only authenticated `POST` requests. It verifies the bearer token with Supabase, derives the ID from that verified user, and ignores all browser-supplied identity. The Admin API runs only inside the function. Deleting `auth.users` cascades to every current user-owned row, including encrypted private data, capsules, both wrapped keys and private capsule-rate state after phase 1 is applied.

Deletion order is authentication user first with database cascades in the same database operation.
Foreign keys from both friendship participants, request metadata, friend profiles, invite hashes,
and the private rate-limit row all use `ON DELETE CASCADE`. Consequently a deleted account is
removed from every other user's friend/request list in the same transaction, and no overlap or
relationship history is retained. A failure returns a generic error and the UI does not claim
success. If infrastructure interrupts the request, retrying is safe: no cross-user identifier is
accepted, and already-cascaded rows cannot become orphans.

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
- Verify that only the publishable key is exposed to browser-facing configuration; keep server-only KEK variables confined to Vercel Sensitive function variables.
- Keep the service-role key confined to the existing Supabase-hosted account-deletion function;
  neither Vercel private-cloud function may possess it.
- Keep production on `VITE_PRIVATE_CLOUD_MODE=off` until the migration runbook gates pass.
- Store KEKs only in Vercel Sensitive production variables and an operator recovery vault. Never
  place a KEK in Supabase or a `VITE_*` variable.
- Run Security Advisor and verify RLS remains enabled on every user-data table.
- Exercise read/write/delete with two test users and verify neither can access the other's rows.
- Re-run the account-deletion and friend-overlap pgTAP checks whenever a user-owned or
  relationship table is added, and add cascading foreign keys for every participant reference.

## Advisor and free-plan limitations

The 2026-08-11 production Security Advisor results contain two intentional no-policy notices for
tables that have no browser grants, warnings for deliberately callable friend `SECURITY DEFINER`
functions, and leaked-password protection disabled. The password warning does not apply to
Gapwise's GitHub/magic-link flow. The Performance Advisor reports an unindexed `revoked_by` FK and
two unused indexes on the currently empty friendship table; changing those indexes is not justified
without real query evidence. Re-run both advisors after additive migration and account for every
new notice.

Supabase's leaked-password protection may be unavailable or disabled depending on plan and Auth configuration. Gapwise uses GitHub OAuth and single-use email magic links; it does not add a password flow to silence that advisory. Dashboard advisories and provider settings require manual review; repository code cannot prove the deployed dashboard state.
