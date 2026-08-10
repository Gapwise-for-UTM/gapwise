# Architecture and operations

## System shape

Gapwise is a client-only React/Vite application. The browser parses an ACORN
calendar, calculates timetable gaps, and runs the deterministic UTM route graph.
The original file, calculated gaps, and calculated routes do not leave the
browser. Optional cloud features use the Supabase browser client for GitHub OAuth
or passwordless email magic links and explicit synchronization of normalized meetings
and route preferences.

Production is built from GitHub `main` by Vercel and served from
`https://campus-gap-finder.vercel.app`. Pushing the connected branch also syncs
the commit back to Lovable. Do not rebase, amend, squash, or force-push published
history.

| Concern                    | Owner                  | Notes                                                                        |
| -------------------------- | ---------------------- | ---------------------------------------------------------------------------- |
| UI, parsing, gaps, routing | Browser                | Guest mode is fully functional.                                              |
| Auth, normalized user data | Supabase               | RLS isolates both user-owned tables.                                         |
| Account deletion           | Supabase Edge Function | JWT required; identity comes from the verified token.                        |
| Static build and domains   | Vercel                 | SPA fallback and security headers come from `vercel.json`.                   |
| Verification               | GitHub Actions         | Locked Bun install, lint, tests, build, icons, and Prettier.                 |
| Product backlog            | Linear                 | Reserve issues for verified work not safely completed in the current change. |

## Local setup

Install Bun 1.3.14, then run:

```sh
bun install --frozen-lockfile
cp .env.example .env.local
bun run dev
```

`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are optional for guest
mode. They are the only browser configuration values. Never place a database
password, GitHub OAuth secret, Supabase secret key, or legacy service-role key in
a `VITE_` variable.

## Environment consistency

Use the same two variable names for development, preview, and production. Verify
presence and scope in Vercel without printing values. Preview authentication also
requires its exact callback origin to be present in Supabase Auth redirect URLs;
add deliberate preview patterns only when previews need sign-in. Keep the
production Site URL on the canonical Vercel domain and allow local development at
`http://localhost:8080` and `http://127.0.0.1:8080`.

The repository pins Bun 1.3.14 for contributors and CI. Vercel currently supports
the Bun `1.x` line rather than an exact patch selector, so its platform patch can
temporarily lag. `bun install --frozen-lockfile` is required in every environment
to prevent dependency drift. Node 24.x documents the Vercel project runtime
expectation even though the current output is static.

## Database and Edge Functions

Apply migrations in filename order. Never edit an already-applied migration to
change production; add a new migration instead. For the legacy `source_filename`
removal, deploy and verify the compatible frontend first, then apply the migration;
for the additive residence-preference columns, apply the migration before the new
frontend. See `docs/SUPABASE.md` for both exact sequences.

```sh
supabase db push
supabase gen types typescript --linked > src/lib/database.types.ts
supabase functions deploy delete-account
```

Review generated type changes before committing. Hosted Edge Functions provide
the Supabase URL and administrative key environment; `ALLOWED_ORIGINS` can add
exact trusted origins beyond the source-controlled production and local defaults.
Keep JWT verification enabled for `delete-account`.

## Verification

Run the same gates as CI:

```sh
bun install --frozen-lockfile
bun run format
bun run lint
bun test
bun run build
bun run typecheck
bun run format:check
bun audit
```

Then serve the production output and check desktop and narrow mobile widths:

1. Load `/` directly and confirm the split-screen hero has no horizontal scroll.
2. Try the demo, all three view tabs, both terms, and a full refresh.
3. Upload a valid, malformed, oversized, and duplicate-containing calendar.
4. Open Day Route and verify a worker asset, vector tiles, glyphs, markers, and
   written fallback directions load without console errors.
5. Block the map provider and verify a visible error plus **Retry map** replaces
   the silent rectangle.
6. With disposable accounts, verify GitHub and email magic-link sign-in, explicit sync, read-only
   restoration after refresh, sign-out, and account deletion.
7. Confirm production response headers, the canonical domain, GitHub commit SHA,
   and successful Vercel deployment.

## Troubleshooting

- **Blank map:** confirm WebGL 2, then inspect the MapLibre worker request before
  blaming CSP or OpenFreeMap. MapLibre 6's worker must be emitted through Vite;
  `CampusMap.tsx` imports it with `?worker&url`. A missing worker stalls before
  tile requests begin.
- **Map error state:** check the worker, style, TileJSON, sprite, glyph, and `.pbf`
  responses. The route timeline remains the accessible fallback.
- **Sign-in returns an error:** compare the browser origin with Supabase's Site URL
  and redirect allowlist. For GitHub, also verify the provider callback; for email,
  verify the magic-link template and delivery settings. Never loosen the allowlist to
  an unrestricted wildcard.
- **Cloud controls are disabled:** verify both public Vite variables exist for the
  current environment. Guest parsing and routing should still work.
- **Direct route is a 404:** confirm the Vercel rewrite and `public/_redirects`
  still send SPA paths to `index.html`.
- **Schema mismatch:** compare `supabase migration list`, repository filenames,
  live RLS policies, and regenerated `database.types.ts` before writing data.

## Security expectations

Treat calendar files, OAuth query parameters, local storage, cloud JSON, and map
responses as untrusted. Keep calendar size/event limits, validate deserialized
meetings, rely on RLS rather than client filters, and grant browser roles only the
table operations they use. Do not log timetable contents, tokens, emails, or raw
production records. Account deletion testing must use a disposable account.
