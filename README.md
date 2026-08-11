<p align="center">
  <img src="public/logo-mark.svg" width="112" alt="Gapwise route-shaped G logo">
</p>
<h1 align="center">Gapwise for UTM</h1>
<p align="center">A privacy-first timetable gap and campus route planner for University of Toronto Mississauga students.</p>
<p align="center"><a href="https://gapwise-utm.vercel.app"><strong>Open Gapwise</strong></a> · React 19 · TypeScript · MapLibre</p>
<p align="center"><a href="https://coderabbit.ai"><img src="https://img.shields.io/coderabbit/prs/github/andrewmuratov/gapwise?utm_source=oss&amp;utm_medium=github&amp;utm_campaign=andrewmuratov%2Fgapwise&amp;labelColor=171717&amp;color=FF570A&amp;link=https%3A%2F%2Fcoderabbit.ai&amp;label=CodeRabbit+Reviews" alt="CodeRabbit Pull Request Reviews"></a></p>

## What Gapwise does

Import an ACORN `.ics` export to see a readable weekly timetable, usable gaps between classes, and deterministic route guidance around UTM. The calendar is parsed locally, so the result appears quickly and guest mode works without a backend.

Gapwise exists because a free hour is only useful when travel time, buildings, and the next class are clear.

## Privacy by design

- The original `.ics` file never leaves the browser.
- Campus route calculation uses a bundled path graph and makes no routing-provider request.
- Cloud sync is optional and stores only normalized meeting fields (course, section, time, building, and room).
- **Saving is always explicit:** only pressing **Sync timetable** changes cloud data.
- After sign-in or refresh, Gapwise checks for an existing cloud timetable automatically. Automatic loading is not automatic uploading.
- Calculated gaps and routes remain browser-side. Vercel Web Analytics and Speed Insights collect operational page/performance metrics; timetable contents and auth tokens are not sent to them. There is no advertising.

## Key features

- Desktop weekly grid and comfortable mobile day list
- Fall, Winter, and Summer views with gap duration and leave-by guidance
- Bundled OpenStreetMap-derived UTM pedestrian routing with entrance-level endpoints
- Optional residence-aware day routes and real round-trip “Go home” gap suggestions
- Route confidence labelled **verified**, **inferred**, **approximate**, or **unavailable**
- Light and dark themes, keyboard navigation, reduced-motion support, and map alternatives
- Optional private sync through GitHub OAuth or email magic links and Supabase RLS

Outdoor paths cover the current mapped campus and every recognized academic/residence building has at least one routing point. “Verified” means the source contains an entrance-tagged point; “inferred” means a nearby mapped pedestrian approach is used because no public door point exists; “approximate” is a clearly labelled fallback. Indoor room routing remains incomplete, and basemap geometry alone is never treated as indoor evidence.

## Cloud sync and restoration

When both remembered local and cloud copies exist, Gapwise uses the newest safely comparable timestamp. If timestamps cannot be compared, it keeps the local copy and notes that a cloud version is available. An already loaded timetable is never replaced automatically. Manual cloud loading remains available for recovery.

GitHub or passwordless email sign-in is remembered in this browser using Supabase's persistent browser session until you sign out, the session expires, or browser storage is cleared. This is separate from **Remember on this device**, which controls only the parsed timetable. On a shared device, use **Sign out** from the account menu; it clears this browser's auth session without deleting your provider account or cloud data.

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
bun run typecheck
bun run build
bun run format:check
bun audit
bun run generate:icons
```

SVG files are canonical brand sources; the icon generator creates deterministic favicon, Apple, and PWA PNGs.

## Project structure

- `src/routes` — application screens and shell
- `src/features` — auth, restoration, sync, and routing logic
- `src/components` — timetable, gap, route, and accessible UI components
- `src/data/utm` — sourced entrances, the deterministic bundled campus graph, and reviewed indoor data
- `supabase` — migrations and the authenticated deletion Edge Function
- `tests` — parser, routing, restoration, privacy, and asset checks

## Contributing campus route data

Follow [`docs/CAMPUS_SURVEY.md`](docs/CAMPUS_SURVEY.md) and the canonical survey schema. Run `bun run routing:refresh` only when intentionally updating the dated OpenStreetMap snapshot. Contributions must describe their source and confidence; do not promote approaches or estimates to verified entrances without review.

## Deployment

Vite emits a static `dist/` directory compatible with Vercel and Cloudflare Pages. Deep-link rewrites are included. Deploy the Supabase migration and deletion function separately using the steps in [`docs/SUPABASE.md`](docs/SUPABASE.md).

## Current limitations and roadmap

Indoor coverage is limited to contributed buildings. Public map data cannot guarantee that every entrance, closure, elevator, or accessibility condition is current; inferred residence approaches are labelled accordingly. Planned work focuses on field-verifying those approaches, expanding reviewed indoor coverage, timetable edge cases, and continued accessibility testing—not paid maps or background tracking.

## Independent project

Gapwise for UTM is an independent student project. It is not affiliated with, endorsed by, or an official service of the University of Toronto.

## License

Original project code and documentation are available under the [MIT License](LICENSE). Third-party software, fonts, services, and OpenStreetMap-derived data remain subject to their own terms; see [Third-party notices](THIRD_PARTY_NOTICES.md).
