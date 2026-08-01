# Optional Supabase and GitHub OAuth setup

Supabase is optional: with no environment variables, Gapwise remains a complete guest application.

## Database and privacy

Create a Supabase project and run `supabase/migrations/20260801000000_user_sync.sql`. Confirm Row Level Security and the per-user policies are enabled. The frontend has no service key or public schedule table. The original ICS body is never uploaded; only whitelisted, normalized meeting fields are stored after the user explicitly chooses **Sync timetable**. Signing in never triggers an upload. Sessions persist in `sessionStorage` and sign-out has local scope.

## GitHub OAuth

1. In GitHub, create an OAuth App. Set its authorization callback URL to:
   `https://olrtvbblxbgcxbhvujaw.supabase.co/auth/v1/callback`.
2. In **Supabase → Authentication → Providers → GitHub**, enable GitHub and enter the OAuth App client ID and client secret. These values belong in Supabase, never in frontend code.
3. In **Supabase → Authentication → URL Configuration**, add:

```text
http://localhost:8080/**
https://*-andrew-muratov-s-projects.vercel.app/**
```

Also add the exact final production URL after Vercel assigns it. Gapwise passes the current application origin as `redirectTo`; every deployed origin must therefore be allowed. Use the final production origin as the Site URL.

## Browser-safe environment values

Set these locally in `.env.local` and in both Vercel Production and Preview environments:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

The publishable key is designed to be browser-visible. A database password, GitHub OAuth secret, and Supabase secret/service-role key must **never** appear in a `VITE_*` variable. Guest mode requires neither variable.

## Verification

Verify guest import without variables; then verify GitHub sign-in, `sessionStorage` persistence, local-only sign-out, explicit schedule sync, row isolation, and deletion. Inspect a cloud row to confirm it has normalized meetings and optional filename only—never raw ICS, calculated gaps, routes, or route warnings.
