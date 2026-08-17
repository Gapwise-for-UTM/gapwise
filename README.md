<div align="center">

<img src="public/logo-mark.svg" width="116" alt="Gapwise route-shaped G logo" />

# Gapwise for UTM

### Make every gap on campus count.

**A privacy-first timetable, gap planner, and campus navigation experience built specifically for University of Toronto Mississauga students.**

[![Open Gapwise](https://img.shields.io/badge/Open_Gapwise-0A84FF?style=for-the-badge&logo=vercel&logoColor=white)](https://gapwise.ca)
[![CI](https://img.shields.io/github/actions/workflow/status/andrewmuratov/gapwise/ci.yml?branch=main&style=for-the-badge&label=CI)](https://github.com/andrewmuratov/gapwise/actions/workflows/ci.yml)
[![MIT](https://img.shields.io/badge/License-MIT-111111?style=for-the-badge)](LICENSE)

<sub>React 19 · TypeScript · TanStack Router · MapLibre · Supabase · Bun · Vercel</sub>

<br />

**[Live app](https://gapwise.ca)** · **[Privacy](PRIVACY.md)** · **[Security](SECURITY.md)** · **[Contributing](CONTRIBUTING.md)** · **[Operations](docs/OPERATIONS.md)** · **[Campus survey](docs/CAMPUS_SURVEY.md)**

</div>

---

## What Gapwise does

Gapwise turns an ACORN `.ics` timetable export into a useful UTM day-planning system: **what is next, when should I leave, where should I go, and what can I realistically do with the time between classes?**

The original calendar file is parsed locally in the browser. Gapwise builds timetable views, identifies gaps, adds route-aware context, and exposes a campus map without requiring an account.

### Current product surface

- **ACORN import and demo** — browser-local `.ics` parsing, import-first onboarding, weekly timetable, and dedicated mobile day views.
- **Today** — current/next class context, gap state, leave-by guidance, and direct navigation actions.
- **Gap Plan** — route-aware usable-time recommendations rather than a static timetable-only view.
- **Day Route / campus explorer** — a map-first MapLibre experience with time-labelled class locations, chronological route progression, a left-to-right day sequence, canonical building geometry, mapped entrances, commute origins, and conservative route confidence.
- **Map navigation tuned for phones and laptops** — north-stable interaction, collision-aware time labels, separated fit/location/zoom controls, reduced-motion support, and route fitting that respects manual pan/zoom.
- **Residence, transit, parking, and pickup origins** — model realistic campus-day starts and returns.
- **Opt-in live location** — foreground geolocation only; no background tracking.
- **Optional encrypted private sync** — restore signed-in private state across devices while keeping guest mode first-class.
- **Microsoft, Google, and GitHub OAuth** through Supabase Auth.
- **Privacy-preserving friend overlap** — limited mutual free windows without exposing either student's timetable.
- **Accessible/mobile interaction** — keyboard and screen-reader semantics, reduced-motion support, responsive phone layouts, PWA support, and light/dark themes.
- **Free and open source** — the live app links directly to this repository and the MIT License.

---

## Campus data and routing

Gapwise deliberately separates **visual geography**, **building identity**, and **navigation evidence**.

`src/data/utm/building-footprints.ts` is the canonical building-identity layer. Recognized UTM buildings/facilities own explicit `Polygon` or `MultiPolygon` geometry; basemap polygons and nearest-entrance heuristics do not silently redefine a building.

The canonical registry currently covers the complete 30-building/facility UTM inventory represented by the reviewed source data. Search, hover, click/tap selection, and map framing use that canonical geometry.

Routing is intentionally conservative:

- **Verified** — evidence-backed routing/entrance data.
- **Inferred** — a mapped approach used when a verified public door point is unavailable.
- **Approximate** — clearly labelled fallback guidance.
- **Unavailable** — Gapwise refuses to invent a route it cannot justify.

The Day Route map is a presentation of this same deterministic routing truth. Class markers show actual timetable times rather than synthetic stop numbers, route segments progress visually from earlier to later stops, and start/end commute anchors stay semantically distinct from classes.

The next campus-data milestone is not broader guessed coverage. It is a smaller **field-verified routing dataset** with provenance and verification dates, followed by a lightweight correction/reporting loop.

See [`docs/CAMPUS_MAP_GEOMETRY.md`](docs/CAMPUS_MAP_GEOMETRY.md) and [`docs/CAMPUS_SURVEY.md`](docs/CAMPUS_SURVEY.md).

### 3D architecture

`src/data/utm/campus-models.ts` preserves a clean integration seam for future georeferenced GLB/GLTF models, but 3D model production is **not current roadmap work**. Canonical footprints remain authoritative for building identity. Revisit 3D only if real user evidence shows a meaningful navigation/comprehension benefit that justifies the performance and complexity cost.

---

## Privacy and security model

The **original ACORN `.ics` file never leaves the browser**.

```text
ACORN .ics
    │
    ▼
Browser parsing ──────► timetable + gaps + routes
    │
    ├── guest mode ───► local state
    │
    └── optional signed-in sync
            │
            ▼
      browser encryption
            │
            ▼
         Supabase
       (ciphertext +
      minimal metadata)
```

Key properties:

- core timetable, gap, recommendation, and route computation is local-first;
- cloud sync is optional;
- private payloads are encrypted in the browser before Supabase storage;
- live location is opt-in and not background-tracked;
- friend availability uses a separate deliberately lossy encrypted capsule;
- account deletion removes the Supabase identity and user-owned application records and clears the current browser's private local state;
- no advertising and no raw timetable/location/friend analytics;
- production and preview environments must never share a key-encryption key.

Gapwise uses defense in depth. It does **not** claim end-to-end encryption or zero knowledge: plaintext exists in the active browser, and the production Vercel key broker is inside the cryptographic trust boundary for key unwrapping.

Read [`PRIVACY.md`](PRIVACY.md), [`SECURITY.md`](SECURITY.md), and [`docs/PRIVATE_CLOUD_SECURITY_ARCHITECTURE.md`](docs/PRIVATE_CLOUD_SECURITY_ARCHITECTURE.md).

---

## Engineering model

Gapwise's scheduling and routing engine is deterministic. React is a consumer of timetable, gap, routing, and campus-domain logic rather than the source of truth for those rules.

The same verified domain logic is intended to support the web app today and, after the launch freeze, a small public REST/OpenAPI surface and remote MCP server without duplicating routing semantics per AI platform.

AI tools accelerate implementation and review, but the architecture, privacy boundaries, UTM-specific semantics, routing model, verification policy, product decisions, and production maintenance remain deliberate project engineering decisions.

---

## Tech stack

- React 19.2 + TypeScript 5.x
- TanStack Router / Start
- Vite 8
- Tailwind CSS 4
- MapLibre GL 6
- Supabase Auth/Postgres/RLS
- Bun 1.3.14
- Playwright
- Vercel + Vercel Analytics/Speed Insights
- GitHub Actions

`package.json` and `bun.lock` are the source of truth for exact dependency versions. The project currently targets **Node 24.x** for Node-based tooling; TypeScript 6 and Node 26 typings are deliberately deferred major migrations rather than launch-period dependency hygiene.

---

## Run locally

Requirements:

- **Bun 1.3.14**
- **Node 24.x** where Node-based tooling is required

```bash
git clone https://github.com/andrewmuratov/gapwise.git
cd gapwise
bun install --frozen-lockfile
bun run dev
```

Guest mode works without backend configuration.

Optional Supabase-backed features use browser-safe variables only:

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Never place a service-role key, OAuth client secret, KEK, private key, or other server secret in a `VITE_` variable.

---

## Verification

Normal gates:

```bash
bun run typecheck
bun run lint
bun test
bun run build
bun run format:check
bun run test:e2e
```

Database/security changes also require the isolated Supabase checks documented in [`docs/OPERATIONS.md`](docs/OPERATIONS.md).

The repository includes regression coverage for ACORN parsing/restoration, onboarding, gap planning, campus routing/geometry, time-marker collision layout, encrypted sync and user isolation, OAuth/account flows, accessibility, PWA behavior, and critical browser journeys.

---

## Development and deployment discipline

`main` is production and Vercel deploys from it. Preview deployments and GitHub Actions are useful but finite resources, so **do not use pushes as a debugging loop**.

For maintainer work:

1. Start from the relevant Linear issue when one exists.
2. Make and verify the complete focused change locally first.
3. Batch coherent edits into a single deliberate branch update whenever practical.
4. Push once for remote CI/preview validation instead of sending a sequence of formatting/test-fix commits.
5. If a remote job fails for an environmental/flaky reason, rerun only the failed job/run when possible instead of creating a no-op commit.
6. Squash-merge focused PRs to keep `main` readable and production deployment churn low.

See [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`AGENTS.md`](AGENTS.md).

---

## Current direction — 2026-08-17

Gapwise is in launch stabilization for UTM Orientation. The core product is working; the remaining roadmap is deliberately bounded around first-run reliability, real-user validation, and trustworthy routing.

Already shipped during the Aug 17 owner-approved maintenance window:

- **AND-66 first-run activation** — Import ACORN is the dominant action, account decisions are post-value, local parsing is explicit, successful imports hand off to Today, and mobile auth/timetable polish is live.
- **Map-first Day Route UX** — chronological class times replace numbered map stops, route segments visually communicate progression, the map is the primary surface on mobile and desktop, and map controls are separated so zoom/fit/location actions do not overlap.
- **Launch-safe dependency maintenance** — current minor/patch updates were consolidated and validated, `@types/node` is aligned with Node 24.x, and TypeScript 6 / Node 26 typings remain explicitly deferred.

Next execution gates:

1. **Sep 2 — AND-53 re-entry smoke check**: reconcile actual GitHub/Vercel/Supabase state, run real-device ACORN import checks, and re-verify the shipped onboarding/map behavior.
2. **Sep 3 — P0 launch work**: parser compatibility hardening, five uncoached launch-gate sessions, only evidence-backed P0 fixes, then final flyer/QR output.
3. **Sep 4–11 — Orientation launch**: prioritize observing and supporting real UTM students over speculative feature coding.
4. **Sep 8–12 — tightly capped retention work**: Today hardening and, only if simple/justified, centralized `ZZ TBA` reserved-assessment handling.
5. **Sep 15 — feature freeze**: after this date, only narrow security/privacy/data-loss/core-import/auth/routing correctness work interrupts academics.

December is reserved for the first field-verified high-value routing dataset, then the transport-neutral domain/API/MCP foundation if capacity remains. Personal-schedule AI access, AI-specific OAuth, Web Push, native apps, broad social features, 3D production, multi-campus expansion, and architectural rewrites are not launch commitments.

---

## Repository map

```text
src/                 app routes, features, components, privacy/security, UTM data
api/                 same-origin Vercel server endpoints
supabase/            migrations and authenticated server functions
e2e/                 Playwright browser release/regression coverage
tests/               unit/integration/regression coverage
docs/                architecture, operations, deployment, campus-data docs
scripts/             deterministic generation/import/review tooling
```

---

## Independent student project

> [!IMPORTANT]
> **Gapwise for UTM is an independent student project. It is not affiliated with, endorsed by, or an official service of the University of Toronto.**

## License

Original project code and documentation are available under the **[MIT License](LICENSE)**. Third-party software, fonts, services, and OpenStreetMap-derived data remain subject to their own terms; see [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

<div align="center">

**Built for the spaces between classes.**

[Open Gapwise →](https://gapwise.ca)

</div>
