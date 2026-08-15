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

- **ACORN import and demo** — browser-local `.ics` parsing, first-run guidance, weekly timetable, and dedicated mobile day views.
- **Today** — current/next class context, gap state, leave-by guidance, and direct navigation actions.
- **Gap Plan** — route-aware usable-time recommendations rather than a static timetable-only view.
- **Day Route / campus explorer** — MapLibre-based UTM map, canonical building geometry, mapped entrances, commute origins, and conservative route confidence.
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

## Tech stack

- React 19.2 + TypeScript 5.8
- TanStack Router / Start
- Vite 8
- Tailwind CSS 4
- MapLibre GL 6
- Supabase Auth/Postgres/RLS
- Bun 1.3.14
- Playwright
- Vercel + Vercel Analytics/Speed Insights
- GitHub Actions

`package.json` is the source of truth for exact dependency versions.

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

The repository includes regression coverage for ACORN parsing/restoration, gap planning, campus routing/geometry, encrypted sync and user isolation, OAuth/account flows, accessibility, PWA behavior, and critical browser journeys.

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

## Current direction — 2026-08-15

The pre-vacation product hardening milestone is complete. The live product has since received two narrow follow-ups: `gapwise.ca` became the canonical production domain (PR #103), and timetable/map/footer UI polish shipped in PR #104.

Planned feature work remains intentionally small and evidence-driven:

1. **Sep 3 re-entry verification** — re-check the actual GitHub/Vercel/Supabase state before carrying August assumptions forward.
2. **Mobile Gap Plan polish** — only if the re-entry check or real-user evidence still shows a material result-first usability gap.
3. **Five uncoached UTM student sessions** — convert critical/high-friction findings into focused work.
4. **First verified campus routing dataset** — approximately 5–10 high-value transitions with provenance and verification status.
5. **Campus-data correction flow** — only after verified routing data exists to improve.

Generic feature expansion, speculative analytics, standing performance work without measurements, and 3D model production are not current roadmap commitments.

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
