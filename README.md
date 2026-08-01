# ![Gapwise route G](public/favicon.svg) Gapwise UTM

**Smarter campus gaps.** Gapwise turns an ACORN `.ics` calendar into a weekly timetable, route-aware gap plan, and interactive day route for University of Toronto Mississauga. Gapwise UTM is an independent student project and is not affiliated with the University of Toronto.

## Privacy model

The calendar file is parsed entirely in the browser; the original `.ics` file is never uploaded. Guest mode needs no account or environment variables. Cloud sync is explicit and opt-in: only normalized meeting fields and an optional source filename are stored after **Sync timetable** is pressed. Signing in never uploads data. Calculated gaps and routes stay in the browser. Authentication uses `sessionStorage`, not `localStorage`, and sign-out is local to the browser session.

## Stack and development

React 19, TypeScript, Vite, TanStack Router, Bun, `ical.js`, MapLibre/OpenFreeMap, and optional Supabase Auth/PostgREST. Routing uses a deterministic in-browser graph and conservatively labels inferred routes.

```sh
bun install
bun run dev
bun run lint
bun test
bun run build
bunx prettier --check .
```

## Optional GitHub authentication and cloud sync

Copy `.env.example` to `.env.local` and add the browser-safe values if wanted:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_BROWSER_SAFE_PUBLISHABLE_KEY
```

The publishable key is browser-safe. Never expose a database password, GitHub OAuth secret, or Supabase secret/service-role key in Vite variables. Apply the migration under `supabase/migrations/` and follow [`docs/SUPABASE.md`](docs/SUPABASE.md).

## Deployment

The static `dist/` build supports both [Vercel](docs/VERCEL.md) and [Cloudflare Pages](docs/CLOUDFLARE_PAGES.md). Vercel Production and Preview environments need the same two variables when cloud features are enabled.

## Original brand assets

`public/favicon.svg` is the canonical, transparent-background Gapwise mark: an original geometric route-shaped **G** with connected stops. It does not use university artwork. `scripts/generate-icons.ts` reproducibly creates `favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png`, `icon-192.png`, and `icon-512.png` without an image dependency:

```sh
bun run generate:icons
```

## Data attribution

The basemap is [OpenFreeMap](https://openfreemap.org/) with [OpenStreetMap](https://www.openstreetmap.org/copyright) data; attribution remains visible. Campus records retain source and verification metadata. See `src/data/utm/indoor/README.md` before contributing routing data.

Originally built with [Lovable](https://lovable.dev); do not rewrite published Lovable-connected history.
