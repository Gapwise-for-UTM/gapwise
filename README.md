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
- Cloud sync is optional. The new private-cloud path encrypts the full private payload and a separate,
  deliberately lossy friend-availability capsule in the browser before either reaches the database.
- Full timetable contents, custom events, residence choice, and private routing preferences use a
  key that normal server flows do not decrypt. The friend service can decrypt only the lossy capsule.
- Friends receive at most three mutual rounded windows for a selected term. They never receive a
  timetable, capsule, arbitrary availability probe, course, room, building, or event label.
- A valid encrypted local copy restores before the network path. Routine reloads make no server
  crypto request, and edits are saved locally before any cloud write.
- Cloud persistence remains opt-in. Deleting the cloud copy disables future automatic uploads until
  the user opts in again; signing out clears that user's local keys and decrypted UI state.
- Calculated gaps and routes remain browser-side. Vercel Web Analytics and Speed Insights collect operational page/performance metrics; timetable contents and auth tokens are not sent to them. There is no advertising.

The encrypted architecture is shipped behind a fail-safe rollout flag. Production remains on the
known-good legacy path until the additive schema, disposable-account proof, operator KEK recovery
copy, and verified migration gates pass. Legacy plaintext is preserved throughout that process; see
the [migration runbook](docs/PRIVATE_CLOUD_MIGRATION_RUNBOOK.md). This is defense in depth against a
database-only compromise, not a claim of end-to-end encryption or zero knowledge: plaintext still
exists in the active browser, and the narrowly scoped common-gap function can decrypt only the lossy
friend capsule.

## Key features

- Desktop weekly grid and comfortable mobile day list
- Fall, Winter, and Summer views with gap duration and leave-by guidance
- Bundled OpenStreetMap-derived UTM pedestrian routing with entrance-level endpoints
- Optional residence-aware day routes and real round-trip “Go home” gap suggestions
- Route confidence labelled **verified**, **inferred**, **approximate**, or **unavailable**
- Light and dark themes, keyboard navigation, reduced-motion support, and map alternatives
- Optional private sync through GitHub OAuth or email magic links and Supabase RLS

Outdoor paths cover the current mapped campus and every recognized academic/residence building has at least one routing point. “Verified” means the source contains an entrance-tagged point; “inferred” means a nearby mapped pedestrian approach is used because no public door point exists; “approximate” is a clearly labelled fallback. Indoor room routing remains incomplete, and basemap geometry alone is never treated as indoor evidence.

## Private cloud sync and restoration

In encrypted mode, the browser keeps non-extractable data keys and encrypted private records in
IndexedDB when the platform supports durable `CryptoKey` cloning. A normal reload decrypts that local
record without calling the key broker. After browser storage is cleared or on a new device, ordinary
sign-in lets a narrow broker wrap the user's existing data keys to a new non-extractable device key;
the browser then downloads ciphertext directly under Supabase Row Level Security and decrypts it
locally. If durable key storage is unavailable, Gapwise uses page-lifetime non-extractable keys and
does not persist raw key material.

Encrypted sync uses authenticated revisions and rejects stale writes rather than silently replacing a
newer cloud value. It writes the encrypted local transaction first, so a Supabase or Vercel outage
does not discard the valid local copy. The legacy restoration path remains authoritative while the
production rollout flag is `off`.

GitHub or passwordless email sign-in is remembered in this browser using Supabase's persistent browser session until you sign out, the session expires, or browser storage is cleared. This is separate from **Remember on this device**, which controls only the parsed timetable. On a shared device, use **Sign out** from the account menu; it clears this browser's auth session without deleting your provider account or cloud data.

## Account and data deletion

Open the signed-in account menu and choose **Delete account and cloud data**. One confirmation
permanently removes the Supabase authentication account and every user-owned legacy, encrypted,
key-envelope, availability, profile, invite, friendship, and rate-limit record through database
cascades. The client also removes that user's local keys, ciphertext, remembered timetable, and
decrypted state. The original `.ics` was never uploaded. **Account deletion is permanent.**

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

The private-cloud rollout additionally uses server-only versioned KEKs on Vercel. Do not create or
activate a production KEK from ordinary development instructions; follow the operator gate in the
[private-cloud migration runbook](docs/PRIVATE_CLOUD_MIGRATION_RUNBOOK.md). The detailed threat model
and measured free-tier capacity are documented in
[PRIVATE_CLOUD_SECURITY_ARCHITECTURE.md](docs/PRIVATE_CLOUD_SECURITY_ARCHITECTURE.md) and
[PRIVATE_CLOUD_CAPACITY.md](docs/PRIVATE_CLOUD_CAPACITY.md).

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
