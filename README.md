<div align="center">

<img src="public/logo-mark.svg" width="116" alt="Gapwise deer mark" />

# Gapwise

### Make the time between classes count.

**Privacy-first timetable intelligence for University of Toronto students — with timetable support across UTM, UTSG, and UTSC and a first-party campus map, routing, and open-data layer focused on UTM.**

[![Open Gapwise](https://img.shields.io/badge/Open_Gapwise-gapwise.ca-0A84FF?style=for-the-badge&logo=vercel&logoColor=white)](https://gapwise.ca)
[![CI](https://img.shields.io/github/actions/workflow/status/Gapwise-for-UTM/gapwise/ci.yml?branch=main&style=for-the-badge&label=CI)](https://github.com/Gapwise-for-UTM/gapwise/actions/workflows/ci.yml)
[![OpenAPI 3.1](https://img.shields.io/badge/OpenAPI-3.1-6BA539?style=for-the-badge&logo=openapiinitiative&logoColor=white)](https://api.gapwise.ca/openapi.json)
[![MIT](https://img.shields.io/badge/License-MIT-111111?style=for-the-badge)](LICENSE)

<sub>React · TypeScript · TanStack · MapLibre · Supabase · Bun · Vercel · OpenAPI · MCP</sub>

<br />

**[App](https://gapwise.ca)** · **[Android](https://github.com/Gapwise-for-UTM/android)** · **[iOS](https://github.com/Gapwise-for-UTM/ios)** · **[API](https://api.gapwise.ca/v1)** · **[AI](https://ai.gapwise.ca)** · **[Data](https://data.gapwise.ca)** · **[Docs](https://docs.gapwise.ca)** · **[Status](https://status.gapwise.ca)**

</div>

---

## What Gapwise is

A timetable says **when** class happens. Gapwise models the day around it: what is next, how much time is actually usable between classes, where a student can realistically go, and when they need to leave.

The web app imports a University of Toronto ACORN `.ics` file locally and supports **UTM, UTSG, UTSC, and mixed-campus schedules**. Campus identity and source-backed locations are preserved. The current first-party map, routing graph, campus-place data, and public campus-data layer are deliberately **UTM-focused** rather than pretending equivalent coverage exists at every campus.

The original calendar file is parsed locally. From normalized schedule state, Gapwise builds timetable views, detects gaps, computes route-aware activity budgets, produces leave-by timing, and coordinates optional account, sync, developer-platform, native-client, data, AI, and operational surfaces.

---

## Created and engineered by Andrew Muratov

Gapwise is created and led by **Andrew Muratov**, a University of Toronto Mississauga Computer Science student working across full-stack software engineering, cybersecurity/privacy engineering, platform architecture, API and SDK design, data engineering, native Android and iOS development, systems design, and permissioned AI integration.

The ecosystem follows one architectural rule:

> **Canonical facts and deterministic calculations have an owner. Interfaces consume, expose, or explain that truth rather than silently recreating it.**

---

## The Gapwise ecosystem

Gapwise currently has **seven first-party product repositories**:

| Repository | Role | Primary surface |
| --- | --- | --- |
| **[`gapwise`](https://github.com/Gapwise-for-UTM/gapwise)** | Core web/PWA, canonical timetable/gap/routing semantics, public API, OpenAPI, and SDK source | [gapwise.ca](https://gapwise.ca) · [api.gapwise.ca](https://api.gapwise.ca/v1) |
| **[`android`](https://github.com/Gapwise-for-UTM/android)** | Native Kotlin + Jetpack Compose Android client | Android app |
| **[`ios`](https://github.com/Gapwise-for-UTM/ios)** | Native Swift + SwiftUI iOS client | iOS app |
| **[`ai`](https://github.com/Gapwise-for-UTM/ai)** | OAuth/MCP layer for public UTM intelligence and explicitly delegated student context | [ai.gapwise.ca](https://ai.gapwise.ca) |
| **[`data`](https://github.com/Gapwise-for-UTM/data)** | Canonical public UTM campus data, provenance, schemas, validation, and distribution | [data.gapwise.ca](https://data.gapwise.ca) |
| **[`docs`](https://github.com/Gapwise-for-UTM/docs)** | Canonical public developer documentation | [docs.gapwise.ca](https://docs.gapwise.ca) |
| **[`status`](https://github.com/Gapwise-for-UTM/status)** | Independent service-health monitoring and incident communication | [status.gapwise.ca](https://status.gapwise.ca) |

Organization-wide GitHub defaults live in **[`.github`](https://github.com/Gapwise-for-UTM/.github)**.

---

## Student product

### Timetable import

- Import a U of T ACORN `.ics` file locally.
- Preserve UTM (`...5`), UTSG (`...1`), UTSC (`...3`), and mixed-campus identity.
- Keep source-backed locations intact instead of remapping them to UTM.
- Treat reserved assessment windows distinctly from ordinary lectures/classes.
- Keep guest mode first-class.

### Today, timetable, and gap planning

Gapwise treats the timetable as input to planning, not merely something to render. It derives the spaces between classes and evaluates them using schedule boundaries, routing, preferences, protected transition buffers, setup/pack-up overhead, and explicit uncertainty.

The Today experience combines current/next-class context, useful gaps, leave-by timing, and route state while keeping online, TBA, unknown, approximate, and unavailable states explicit.

### UTM map and routing

The current first-party campus engine is UTM-focused. Gapwise separates building identity, visual geography, route evidence, entrance evidence, and accessibility evidence instead of collapsing them into a guessed location model.

UTSG and UTSC timetable locations remain valid timetable locations without being falsely plotted onto the UTM map.

### Day Replay

[Day Replay](https://gapwise.ca/replay) simulates a selected campus day and exposes classes, gaps, transitions, route progression, deterministic recommendations, usable time, leave-by timing, and route-confidence state.

---

## Native clients

### Android

[`android`](https://github.com/Gapwise-for-UTM/android) is the active native Kotlin + Jetpack Compose client. It currently includes:

- local `.ics` import across UTM, UTSG, UTSC, and mixed-campus schedules;
- Keystore-backed encrypted on-device timetable/session storage;
- Today, Timetable, Gap Plan, Map, and More navigation;
- light/dark appearance;
- a native UTM MapLibre/OpenFreeMap map with building search and imported-class context;
- optional Google, Microsoft, or GitHub sign-in through Supabase Auth PKCE;
- optional encrypted Gapwise account sync and cloud/account deletion controls.

The native UTM map is functional but does **not** yet claim full parity with the complete web routing/entrance/geometry stack.

### iOS

[`ios`](https://github.com/Gapwise-for-UTM/ios) is the native Swift + SwiftUI client. It is currently at an early repository/bootstrap stage. Its intended contract matches the wider product: local-first timetable handling, all-campus timetable identity, optional account continuity, and UTM-focused native map/routing where first-party campus evidence exists.

Both native clients are separate platform implementations, not a shared `gapwise-mobile` repository.

---

## Public developer platform

Canonical API:

```text
https://api.gapwise.ca/v1
```

OpenAPI 3.1 contract:

```text
https://api.gapwise.ca/openapi.json
```

Current public capabilities include:

- canonical UTM building/facility identity and coverage;
- campus places with freshness/provenance;
- deterministic UTM routing;
- route-aware gap planning;
- version and data metadata.

Official SDKs:

```bash
npm install @gapwise/sdk@0.1.1
python -m pip install gapwise==0.1.0
```

Developer surfaces:

- [Developer hub](https://gapwise.ca/developers)
- [Documentation](https://docs.gapwise.ca)
- [OpenAPI](https://api.gapwise.ca/openapi.json)
- [Gapwise Data](https://data.gapwise.ca)

---

## Gapwise Data

[Gapwise Data](https://data.gapwise.ca) owns canonical public UTM campus facts: geometry, building registries, entrances, routing evidence, provenance, schemas, validation, attribution, reuse rules, and fact-vs-inference boundaries.

The core product consumes a validated build-time snapshot rather than depending on the Data website or GitHub at runtime.

---

## Gapwise AI

[Gapwise AI](https://ai.gapwise.ca) is the provider-neutral OAuth/MCP boundary for deterministic public campus intelligence and explicitly delegated student context.

Canonical MCP endpoint:

```text
https://ai.gapwise.ca/api/mcp
```

Public campus tools remain deterministic and UTM-scoped. Private student context is opt-in and minimized. Gapwise AI is not a second timetable or routing engine.

---

## Privacy and security

Gapwise is designed around data minimization and explicit trust boundaries.

Key properties include:

- local-first timetable parsing;
- useful guest mode without an account;
- optional private cloud sync;
- browser-side encryption for supported web private-sync payloads;
- Keystore-backed encrypted local storage in the Android client;
- foreground-only, opt-in live location on supported surfaces;
- explicit, minimized, revocable AI delegation;
- Supabase/Postgres with row-level security;
- OAuth-based identity boundaries;
- public campus data separated from private student state;
- no claim of zero-knowledge or end-to-end encryption where the implementation does not provide it.

Read [`PRIVACY.md`](PRIVACY.md), [`SECURITY.md`](SECURITY.md), and the architecture material in [Gapwise Docs](https://docs.gapwise.ca).

---

## Tech stack

Core web/platform technologies include **React, TypeScript, TanStack, Vite, Tailwind CSS, MapLibre GL, Supabase/Postgres/RLS, Bun/Node, OpenAPI 3.1, Playwright, Vercel, Cloudflare, Resend, and GitHub Actions**.

The wider ecosystem adds **Kotlin + Jetpack Compose** for Android, **Swift + SwiftUI** for iOS, Astro/Starlight for documentation/status surfaces, and Model Context Protocol + OAuth for permissioned AI integration.

---

## Run locally

Requirements:

- Bun 1.3.x
- Node 24.x where Node-based tooling is required

```bash
git clone https://github.com/Gapwise-for-UTM/gapwise.git
cd gapwise
bun install --frozen-lockfile
bun run dev
```

Typical validation:

```bash
bun run typecheck
bun run lint
bun test
bun run build
bun run format:check
```

---

## Contributing

Choose the repository that owns the behavior you want to change. Shared organization defaults live in [`.github`](https://github.com/Gapwise-for-UTM/.github).

- product/domain behavior → [`gapwise`](https://github.com/Gapwise-for-UTM/gapwise)
- Android implementation → [`android`](https://github.com/Gapwise-for-UTM/android)
- iOS implementation → [`ios`](https://github.com/Gapwise-for-UTM/ios)
- public campus facts → [`data`](https://github.com/Gapwise-for-UTM/data)
- AI/MCP boundary → [`ai`](https://github.com/Gapwise-for-UTM/ai)
- developer documentation → [`docs`](https://github.com/Gapwise-for-UTM/docs)
- service health/incident communication → [`status`](https://github.com/Gapwise-for-UTM/status)

---

## Independent project

> **Gapwise is an independent student software project created by Andrew Muratov. It is not affiliated with, endorsed by, or an official service of the University of Toronto.**

## License

[MIT](LICENSE) © 2026 Andrew Muratov.

<div align="center">

**Built for the spaces between classes.**

[Open Gapwise →](https://gapwise.ca)

</div>
