# Gapwise UTM

Gapwise UTM turns an ACORN `.ics` calendar into a weekly timetable, a route-aware
gap plan, and an interactive day route for University of Toronto Mississauga. It is
an independent student project and is not affiliated with the University of Toronto.

## Privacy model

The calendar file is parsed entirely in the browser. The original `.ics` file is
never uploaded. Guest mode needs no account and works when Supabase is absent.

Cloud sync is optional and opt-in. If a signed-in user presses **Sync timetable**,
the app stores only normalized meeting fields (course/section labels, times,
weekday, term, building, room, and optional source filename) in that user's private
row. Calculated gaps and routes are always recreated in the browser and are never
stored. Supabase auth persistence uses `sessionStorage`, not `localStorage`.

The optional **Remember on this device** control still governs local timetable
persistence independently of cloud sync.

## Architecture

- React 19, TypeScript, Vite, TanStack Router, and Bun
- `ical.js` for browser-side ACORN calendar normalization
- MapLibre GL JS with a keyless OpenFreeMap/OpenStreetMap vector style
- Deterministic browser-side Dijkstra routing over one indoor/outdoor graph
- Per-building location/floor rules that distinguish verified, inferred, and unknown
- Optional browser-side Supabase Auth and PostgREST sync protected by row-level security
- A client-only `dist/` deployment with a Cloudflare Pages SPA fallback

The routing data model supports a continuous room → hallway → vertical circulation →
entrance → outdoor path → entrance → hallway → room route. Current production campus
data is intentionally conservative: MN, DH, and IB have OSM-backed entrance points,
but detailed paths and indoor geometry are not yet published. The UI therefore labels
cross-building dashed lines as approximate and does not claim they are optimal. The
algorithm's full behavior is covered by synthetic graph tests.

The map provider is isolated in `src/config/map.ts`; routing delays and defaults live
in `src/config/routing.ts`. See
[`src/data/utm/indoor/README.md`](src/data/utm/indoor/README.md) before contributing
campus or indoor data.

## Local development

```sh
bun install
bun run dev
bun test
bun run build
```

`bun run build` produces a static site in `dist/`. No server runtime or route API is
required.

## Optional Supabase setup

Copy `.env.example` to `.env.local` and add only the browser-safe publishable key:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_BROWSER_SAFE_PUBLISHABLE_KEY
```

Never use a service-role key. Apply the SQL migration in `supabase/migrations/`, then
follow [`docs/SUPABASE.md`](docs/SUPABASE.md) for Google OAuth redirect setup. With
both variables blank, the app starts normally in guest mode and disables cloud controls.

## Deployment

See [`docs/CLOUDFLARE_PAGES.md`](docs/CLOUDFLARE_PAGES.md). The required Pages values
are:

- Build command: `bun run build`
- Output directory: `dist`
- Framework preset: none / Vite

## Data sources and attribution

The vector basemap is provided by [OpenFreeMap](https://openfreemap.org/) using
[OpenStreetMap](https://www.openstreetmap.org/copyright) data. Campus records carry
source URLs, verification dates, and verification status alongside the data. Map
attribution remains visible in the MapLibre control.

This project was originally built with [Lovable](https://lovable.dev). Keep published
Git history linear and do not force-push the Lovable-connected branch.
