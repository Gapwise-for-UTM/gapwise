<div align="center">

<img src="public/logo-mark.svg" width="120" alt="Gapwise route-shaped G logo" />

# Gapwise for UTM

### Your timetable, your campus, your gaps — understood as one system.

**A privacy-first timetable, gap-planning, campus-navigation, and AI-delegation platform built specifically for University of Toronto Mississauga students.**

[![Open Gapwise](https://img.shields.io/badge/Open_Gapwise-0A84FF?style=for-the-badge&logo=vercel&logoColor=white)](https://gapwise.ca)
[![CI](https://img.shields.io/github/actions/workflow/status/andrewmuratov/gapwise/ci.yml?branch=main&style=for-the-badge&label=CI)](https://github.com/andrewmuratov/gapwise/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-111111?style=for-the-badge)](LICENSE)
[![UTM](https://img.shields.io/badge/Campus-UTM-203B62?style=for-the-badge)](https://www.utm.utoronto.ca/)

<sub>React 19 · TypeScript · TanStack Router · MapLibre · Supabase · Bun · Vercel · MCP</sub>

<br />

**[Live app](https://gapwise.ca)** · **[Privacy](https://gapwise.ca/privacy.html)** · **[Terms](https://gapwise.ca/terms.html)** · **[Support](https://gapwise.ca/support.html)** · **[Security](SECURITY.md)** · **[Contributing](CONTRIBUTING.md)**

</div>

---

## What Gapwise is

Gapwise turns an ACORN `.ics` timetable export into a UTM-specific day-planning system that can answer four practical questions:

> **What is next? Where do I need to go? How much of this gap is actually usable? What is the best feasible thing to do with it?**

The original calendar file is parsed locally in the browser. From that source-backed timetable, Gapwise builds weekly/day views, identifies real bounded gaps, applies deterministic route and transition logic, and surfaces conservative recommendations without requiring an account.

Signed-in users can optionally add encrypted private sync, friend-overlap features, and **explicit AI delegation** to compatible assistants through the separate provider-neutral Gapwise AI MCP service.

### At a glance

| Layer | What it does |
| --- | --- |
| **Timetable** | Parses ACORN locally and normalizes classes, sections, times, dates, rooms, and recurrence. |
| **Gap engine** | Finds real bounded openings and computes usable activity time, setup/pack-up, travel, buffers, leave-by, arrival, recommendations, alternatives, and confidence. |
| **Campus model** | Maintains canonical UTM building identity, geometry, entrances, provenance, and conservative routing semantics. |
| **Day Route** | Turns the schedule into a chronological map-first campus journey. |
| **Private sync** | Optionally encrypts user-owned private state before Supabase storage. |
| **AI delegation** | Lets the user explicitly share a minimized, permissioned schedule/planning snapshot with MCP-capable assistants. |
| **Public campus intelligence** | Exposes stateless building, routing, and gap-planning capabilities without exposing any student's timetable. |

---

## Product surface

- **ACORN import and demo** — browser-local `.ics` parsing, import-first onboarding, weekly timetable, and dedicated mobile day views.
- **Today** — current/next class context, gap state, leave-by guidance, and direct navigation actions.
- **Gap Plan** — route-aware usable-time recommendations instead of treating every calendar opening as equally valuable.
- **Day Route / campus explorer** — MapLibre-based chronological class stops, canonical buildings, mapped entrances, route evidence, commute origins, and conservative confidence states.
- **Residence, transit, parking, and pickup origins** — model realistic campus-day starts and returns.
- **Personal timetable items** — add non-academic blocks without mutating imported academic meetings.
- **Optional encrypted private sync** — restore signed-in private state across devices while guest mode remains first-class.
- **Microsoft, Google, and GitHub OAuth** through Supabase Auth.
- **Privacy-preserving friend overlap** — intentionally lossy mutual free-window comparison rather than schedule sharing.
- **Opt-in foreground live location** — no background tracking.
- **Accessible/mobile interaction** — responsive layouts, safe areas, keyboard and screen-reader semantics, reduced-motion support, PWA behavior, and light/dark themes.
- **Provider-neutral AI delegation** — use the same Gapwise MCP boundary from compatible assistants rather than building provider-specific timetable logic.

---

## Gapwise AI — grounded planning, not timetable hallucination

Gapwise's AI architecture deliberately separates **deterministic truth** from **model reasoning**.

```text
Gapwise / UTM truth                      Assistant reasoning
────────────────────                     ───────────────────
class times + recurrence                 understand the user's goal
canonical buildings                     compare trade-offs
route engine                             choose which tools to call
gap assessment                           explain the result
permission model                         propose bounded changes
write validation
```

A model should not estimate whether a student can make a transition or invent how much of a gap is usable when Gapwise can compute it.

### Private delegated intelligence

A signed-in user can explicitly enable AI access from Gapwise account settings. Delegation is separate from ordinary OAuth/login and remains least-privilege.

Depending on the user's chosen permissions, the AI service can receive:

- source-backed academic timetable facts (**always read-only**);
- explicitly delegated personal timetable items;
- deterministic Gapwise gap plans;
- selected gap-planning preferences;
- selected routing preferences;
- bounded permission to queue personal-item or gap-preference changes.

The AI delegation boundary excludes raw ACORN `.ics`, friend data, precise live location, account credentials, OAuth secrets, Gapwise's primary private-data DEK/KEK, and unrelated browser state.

Writes are typed, revision-checked, idempotency-bounded, and independently revalidated before Gapwise applies them. There is **no academic-class mutation tool**.

### Public deterministic campus intelligence — live

Gapwise exposes a small anonymous/stateless production capability surface:

```text
GET  /api/utm-buildings
GET  /api/utm-building?q=...
POST /api/utm-route
POST /api/utm-gap-plan
```

These endpoints power first-party consumers such as Gapwise AI and preserve Gapwise's existing route semantics:

- canonical building resolution;
- deterministic building-to-building routing using the existing engine;
- `routed` / `approximate` / `unavailable` distinctions;
- step-free fail-closed behavior;
- verification/accessibility warnings and provenance;
- deterministic gap-window assessment using the same Gapwise gap logic rather than model arithmetic;
- no raw routing graph nodes/edges;
- no user timetable, account, friend, sync, OAuth, raw `.ics`, or live-location data.

The production MCP service composes this public data plane with explicitly delegated private schedule context without sending a student's timetable into the stateless routing API. A Claude end-to-end regression on August 19, 2026 verified that the public route/gap tools and private precomputed gap plan agree on deterministic timing and recommendation output while preserving different warning granularity where room-level data exists only on the private side.

See [`docs/CLAUDE_CONNECTOR.md`](docs/CLAUDE_CONNECTOR.md) for connector setup, troubleshooting, and example prompts.

---

## Campus data and routing

Gapwise deliberately separates **visual geography**, **building identity**, and **navigation evidence**.

The canonical UTM registry covers the 30-building/facility inventory represented by the reviewed source data. Building identity is explicit; basemap polygons and nearest-entrance heuristics do not silently redefine a building.

Routing is intentionally conservative:

| State | Meaning |
| --- | --- |
| **Verified** | Evidence-backed routing/entrance data. |
| **Inferred** | A mapped approach used when a verified public door point is unavailable. |
| **Approximate** | Clearly labelled conservative fallback guidance. |
| **Unavailable** | Gapwise refuses to invent a route it cannot justify. |

Step-free requests are stricter: if the available graph cannot justify an accessible path, Gapwise reports the route as unavailable instead of silently falling back to stairs or an unverified approximation.

The next major campus-data quality milestone is a smaller **field-verified routing dataset** with provenance and verification dates, followed by a lightweight correction/reporting loop.

See [`docs/CAMPUS_MAP_GEOMETRY.md`](docs/CAMPUS_MAP_GEOMETRY.md) and [`docs/CAMPUS_SURVEY.md`](docs/CAMPUS_SURVEY.md).

---

## Privacy and security model

The **original ACORN `.ics` file never leaves the browser**.

```text
                         ┌──────────────────────────┐
ACORN .ics ──local──────►│     Gapwise browser     │
                         │ canonical private state  │
                         └───────────┬──────────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              │                      │                      │
              ▼                      ▼                      ▼
        guest/local             encrypted sync       explicit AI delegation
                                   │                      │
                                   ▼                      ▼
                                Supabase             minimized snapshot
                              ciphertext               separate crypto
                                                         domain
```

Key properties:

- timetable import and normalization are local-first;
- cloud sync is optional;
- private sync payloads are encrypted in the browser before Supabase storage;
- friend availability uses a separate deliberately lossy encrypted capsule;
- live location is opt-in and foreground-only;
- AI delegation is an independent opt-in boundary with its own minimized schema and encryption domain;
- imported academic meetings remain immutable to AI writes;
- no advertising and no raw timetable/location/friend analytics;
- production and preview environments must never share a key-encryption key.

Gapwise does **not** claim zero knowledge or end-to-end encryption. Plaintext exists in the active browser, and trusted production services sit inside documented cryptographic boundaries where necessary.

Read the public **[Privacy Notice](https://gapwise.ca/privacy.html)**, [`SECURITY.md`](SECURITY.md), and [`docs/PRIVATE_CLOUD_SECURITY_ARCHITECTURE.md`](docs/PRIVATE_CLOUD_SECURITY_ARCHITECTURE.md).

---

## Claude connector

The canonical remote MCP endpoint is:

```text
https://ai.gapwise.ca/api/mcp
```

Claude can connect to that endpoint through a custom remote connector. OAuth authenticates the exact client, while timetable access remains separately controlled by the user's Gapwise Account → AI permissions. The production connector currently exposes 17 tools: 13 read-only tools and 4 write/delete tools. Public campus tools work independently of private timetable delegation; private timetable tools fail closed when delegation is disabled.

The connector is provider-neutral: Claude is a validated client, not a special scheduling backend. Other compatible MCP clients can use the same canonical service subject to their own client and publication requirements.

---

## Engineering model

Gapwise's schedule, gap, campus, and routing behavior is deterministic. React presents that logic; it is not the source of truth for it.

The project follows three rules:

1. **Do not duplicate deterministic logic per interface.** Web UI, public API, and MCP consumers should converge on the same Gapwise semantics.
2. **Uncertainty is data.** Approximate/unavailable/accessibility-unknown states must survive through every layer instead of being polished into false certainty.
3. **Privacy is architectural.** A reusable function or API capability does not imply permission to expose private student inputs.

AI tools accelerate implementation and review, but UTM-specific semantics, privacy boundaries, verification policy, product decisions, and production maintenance remain explicit engineering decisions.

---

## Tech stack

- React 19.2 + TypeScript 5.x
- TanStack Router / Start
- Vite 8 + Tailwind CSS 4
- MapLibre GL 6
- Supabase Auth / Postgres / RLS
- Bun 1.3.14
- Playwright
- Vercel + Analytics / Speed Insights
- GitHub Actions
- Model Context Protocol integration through the separate Gapwise AI service

`package.json` and `bun.lock` are the source of truth for exact dependency versions. The project targets **Node 24.x** where Node-based tooling is required.

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

Optional Supabase-backed browser features use browser-safe variables only:

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Never place a service-role key, OAuth client secret, KEK, private key, or other server secret in a `VITE_` variable.

---

## Verification

Normal release gates:

```bash
bun run typecheck
bun run lint
bun test
bun run build
bun run format:check
bun run test:e2e
```

Database/security changes also require the isolated Supabase checks documented in [`docs/OPERATIONS.md`](docs/OPERATIONS.md).

The CI workflow deliberately treats documentation-only changes as non-runtime changes: expensive browser and database suites are skipped, while formatting/document integrity still gets checked. Runtime changes continue through the complete release gates.

---

## Development discipline

`main` is production and Vercel deploys from it. Remote CI and preview capacity are finite, so pushes are not a debugging loop.

For maintainer work:

1. Start from the relevant Linear issue when one exists.
2. Inspect the current production/repository state before editing.
3. Verify coherent work locally first.
4. Prefer one focused branch update over chains of formatting/fix commits.
5. Rerun failed remote jobs instead of creating no-op commits when possible.
6. Squash-merge focused PRs and keep production deployment churn low.

See [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`AGENTS.md`](AGENTS.md).

---

## Current direction — August 2026

Gapwise remains in launch stabilization for UTM Orientation. The Aug 18–19 AI work was an explicit, bounded exception because real MCP clients were available and the work could preserve the existing privacy model rather than redesign the product.

Production-verified now:

- ACORN-first activation and mobile launch hardening;
- map-first chronological Day Route and integrated mobile surfaces;
- encrypted private sync and privacy-preserving friend overlap;
- explicit private AI delegation with OAuth, minimized encrypted snapshots, scoped permissions, read-only academic meetings, and revision-safe queued personal changes;
- provider-neutral AI decision tools for day/week context, availability, weekly opportunities, and plan-feasibility checking;
- public/stateless campus intelligence for buildings, routing, and deterministic gap simulation;
- the shared Gapwise AI MCP adapter and its four public campus tools;
- Claude discovery of the full 17-tool surface and end-to-end composition of private timetable facts with public deterministic routing/gap computation.

The immediate publication work is narrow: public support/legal documentation, reviewer fixtures, and connector-directory submission. The orientation plan still takes precedence over speculative feature expansion. After that release work, the project returns to launch validation, trustworthy campus data, and the Sep 15 maintenance-focused freeze.

---

## Repository map

```text
src/                 app routes, features, components, privacy/security, UTM data
src/server/          server-safe first-party capability adapters
api/                 same-origin Vercel endpoints, including public campus intelligence
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

### Built for the spaces between classes.

[**Open Gapwise →**](https://gapwise.ca)

</div>
