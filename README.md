<p align="center">
  <img src="public/logo-mark.svg" width="112" alt="Gapwise route-shaped G logo">
</p>
<h1 align="center">Gapwise UTM</h1>
<p align="center">A private timetable gap and campus route planner for University of Toronto Mississauga students.</p>
<p align="center"><a href="https://campus-gap-finder.vercel.app"><strong>Open Gapwise</strong></a> · React 19 · TypeScript · MapLibre</p>

## What Gapwise does

Import an ACORN `.ics` export to see a readable weekly timetable, usable gaps between classes, and deterministic route guidance around UTM. The calendar is parsed locally, so the result appears quickly and guest mode works without a backend.

Gapwise exists because a free hour is only useful when travel time, buildings, and the next class are clear.

## Privacy by design

- The original `.ics` file never leaves the browser.
- Cloud sync is optional and stores only normalized meeting fields (course, section, time, building, and room).
- **Saving is always explicit:** only pressing **Sync timetable** changes cloud data.
- After sign-in or refresh, Gapwise checks for an existing cloud timetable automatically. Automatic loading is not automatic uploading.
- Calculated gaps and routes remain browser-side. Vercel Web Analytics and Speed Insights collect operational page/performance metrics; timetable contents and auth tokens are not sent to them. There is no advertising.

## Key features

- Desktop weekly grid and comfortable mobile day list
- Fall and Winter views with gap duration and leave-by guidance
- Free OpenFreeMap/OpenStreetMap basemap with textual routes
- Route confidence labelled **verified**, **approximate**, or **unavailable**
- Light and dark themes, keyboard navigation, reduced-motion support, and map alternatives
- Optional private sync through GitHub OAuth and Supabase RLS

Campus route coverage is incomplete. “Verified” refers to reviewed campus routing data; “approximate” is a clearly labelled estimate; “unavailable” means Gapwise will not invent a route. Basemap geometry is not evidence that an indoor path has been verified.

## Cloud sync and restoration

When both remembered local and cloud copies exist, Gapwise uses the newest safely comparable timestamp. If timestamps cannot be compared, it keeps the local copy and notes that a cloud version is available. An already loaded timetable is never replaced automatically. Manual cloud loading remains available for recovery.

GitHub sign-in is remembered in this browser using Supabase's persistent browser session until you sign out, the session expires, or browser storage is cleared. This is separate from **Remember on this device**, which controls only the parsed timetable. On a shared device, use **Sign out** from the account menu; it clears this browser's auth session without deleting your GitHub account or cloud data.

## Account and data deletion

Open the signed-in account menu and choose **Delete account and cloud data**. One confirmation permanently removes the Supabase authentication account, normalized timetable, preferences, and all other user-owned server records. You may also clear this browser's remembered timetable; it remains in guest mode when that option is unchecked. The original `.ics` was never uploaded. **Account deletion is permanent.**

## Local development

```sh
bun install --frozen-lockfile
bun run dev
```

Browser-safe configuration only:

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Never put the service-role key in a `VITE_` variable. Without these values, guest mode remains fully functional. See [architecture and operations](docs/OPERATIONS.md), [Supabase setup](docs/SUPABASE.md), [Vercel deployment](docs/VERCEL.md), and [Cloudflare Pages notes](docs/CLOUDFLARE_PAGES.md).

## Testing and assets

```sh
bun run lint
bun test
bun run build
bunx prettier --check .
bun run generate:icons
```

SVG files are canonical brand sources; the icon generator creates deterministic favicon, Apple, and PWA PNGs.

## Project structure

- `src/routes` — application screens and shell
- `src/features` — auth, restoration, sync, and routing logic
- `src/components` — timetable, gap, route, and accessible UI components
- `src/data/utm` — deterministic campus graph and reviewed indoor data
- `supabase` — migrations and the authenticated deletion Edge Function
- `tests` — parser, routing, restoration, privacy, and asset checks

## Contributing campus route data

Follow [`src/data/utm/indoor/README.md`](src/data/utm/indoor/README.md). Contributions must describe their source and confidence; do not promote estimates to verified routes without review.

## Deployment

Vite emits a static `dist/` directory compatible with Vercel and Cloudflare Pages. Deep-link rewrites are included. Deploy the Supabase migration and deletion function separately using the steps in [`docs/SUPABASE.md`](docs/SUPABASE.md).

## Current limitations and roadmap

Indoor coverage is limited to contributed buildings and cannot guarantee that every entrance, closure, elevator, or accessibility condition is current. Planned work focuses on reviewed route coverage, timetable edge cases, and continued accessibility testing—not paid maps or background tracking.

## Independent project

Gapwise UTM is an independent student project. It is not affiliated with, endorsed by, or an official service of the University of Toronto.
