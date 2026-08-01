# Optional Supabase and Google OAuth setup

Supabase is an optional enhancement. An unconfigured deployment is a complete guest
application; it must not be treated as an error state.

## 1. Create and migrate a free project

1. Create a Supabase project on the free plan.
2. Open the SQL editor and run
   `supabase/migrations/20260801000000_user_sync.sql`.
3. Confirm Row Level Security is enabled on `user_schedules` and `user_preferences`.
4. Confirm each table has separate SELECT, INSERT, UPDATE, and DELETE policies scoped
   to `auth.uid() = user_id`.
5. Confirm `anon` has no table grants and `authenticated` has only SELECT, INSERT,
   UPDATE, and DELETE grants.

The app has no Edge Functions, route server, database service key, or public schedule
table. Do not add a service-role key to a Vite environment variable: every `VITE_*`
value is visible to the browser.

## 2. Configure Google OAuth

In Google Cloud Console, create an OAuth web client and add Supabase's callback URL as
an authorized redirect URI:

```text
https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
```

Add the Google client ID and secret under **Supabase → Authentication → Providers →
Google**.

Under **Supabase → Authentication → URL Configuration**:

- Set the Site URL to the production Cloudflare Pages origin.
- Add the exact local origin shown by `bun run dev` (normally
  `http://localhost:8080`) to Redirect URLs.
- Add the production Pages origin and any intentional preview origin patterns.

Gapwise passes `window.location.origin` as `redirectTo`, so every origin used for the
app must be allow-listed in Supabase. Avoid a broad wildcard for production if exact
preview origins are known.

## 3. Configure browser-safe environment values

Create `.env.local` locally or set the same names in Cloudflare Pages:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

The modern publishable key is preferred. A legacy browser-safe anon key also works if
the project has not migrated key types, but it must still be placed in the publishable
variable. Never copy the secret/service-role key.

## 4. Verify the privacy boundary

1. Load the app with no variables and confirm guest import, timetable, gaps, and routes
   work while cloud controls are disabled.
2. Sign in with Google and inspect browser storage. The Supabase session should be in
   `sessionStorage`, not `localStorage`.
3. Import a synthetic calendar, press **Sync timetable**, and inspect your own row.
   Only the normalized meetings array and optional filename should exist.
4. Confirm a second account cannot read, update, or delete the first account's rows.
5. Press **Delete cloud timetable** and confirm only the cloud schedule row is removed;
   the local browser copy remains until the user removes it.

Preferences can be saved and loaded separately. Routes, route warnings, calculated
gaps, and the raw ICS body are never written to Supabase.
