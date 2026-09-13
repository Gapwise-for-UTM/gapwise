<div align="center">

<img src="public/logo-mark.svg" width="116" alt="Gapwise deer mark" />

# Gapwise

### Make the time between classes count.

**A privacy-first timetable and campus-intelligence platform for University of Toronto students — with timetable support across UTM, UTSG, and UTSC and a first-party campus map, routing, and open-data layer focused on UTM.**

[![Open Gapwise](https://img.shields.io/badge/Open_Gapwise-gapwise.ca-0A84FF?style=for-the-badge&logo=vercel&logoColor=white)](https://gapwise.ca)
[![CI](https://img.shields.io/github/actions/workflow/status/Gapwise-for-UTM/gapwise/ci.yml?branch=main&style=for-the-badge&label=CI)](https://github.com/Gapwise-for-UTM/gapwise/actions/workflows/ci.yml)
[![OpenAPI 3.1](https://img.shields.io/badge/OpenAPI-3.1-6BA539?style=for-the-badge&logo=openapiinitiative&logoColor=white)](https://api.gapwise.ca/openapi.json)
[![MIT](https://img.shields.io/badge/License-MIT-111111?style=for-the-badge)](LICENSE)

<sub>React · TypeScript · TanStack · MapLibre · Supabase · Bun · Vercel · Cloudflare · OpenAPI · MCP</sub>

<br />

**[App](https://gapwise.ca)** · **[Android](https://github.com/Gapwise-for-UTM/android)** · **[iOS](https://github.com/Gapwise-for-UTM/ios)** · **[API](https://api.gapwise.ca/v1)** · **[AI](https://ai.gapwise.ca)** · **[Data](https://data.gapwise.ca)** · **[Docs](https://docs.gapwise.ca)** · **[Status](https://status.gapwise.ca)**

</div>

---

## What Gapwise is

A timetable says **when** class happens. Gapwise models the day around it: what is next, how much usable time exists between classes, where a student can realistically go, and when they need to leave.

The web app imports a University of Toronto ACORN `.ics` file locally and supports **UTM, UTSG, UTSC, and mixed-campus schedules**. Campus identity and source locations are preserved. The current first-party map, routing graph, campus-place data, and route-confidence model are deliberately **UTM-focused** rather than pretending equivalent coverage exists at the other campuses.

The original calendar file is parsed in the browser. From the normalized schedule, Gapwise builds timetable views, detects gaps, computes route-aware activity budgets, produces leave-by timing, and coordinates optional account, sync, developer-platform, native-client, data, AI, and operational surfaces.

Gapwise is now a **seven-repository product ecosystem** with explicit ownership boundaries instead of a collection of disconnected projects.

---

## Created and engineered by Andrew Muratov

Gapwise is created and led by **Andrew Muratov**, a University of Toronto Mississauga Computer Science student working across **full-stack software engineering, cybersecurity and privacy engineering, platform architecture, API and SDK design, data engineering, developer infrastructure, native Android and iOS development, systems design, and permissioned AI integration**.

The ecosystem shares one product identity and a simple architectural rule:

> **Canonical facts and deterministic calculations have an owner. Interfaces consume, expose, or explain that truth rather than silently recreating it.**

---

## The Gapwise ecosystem

| Repository | Role | Primary surface |
| --- | --- | --- |
| **[`gapwise`](https://github.com/Gapwise-for-UTM/gapwise)** | Core web/PWA, canonical timetable/gap/routing semantics, public API, OpenAPI, and SDK source | [gapwise.ca](https://gapwise.ca) / [api.gapwise.ca](https://api.gapwise.ca/v1) |
| **[`android`](https://github.com/Gapwise-for-UTM/android)** | Native Kotlin + Jetpack Compose Android client | Android app |
| **[`ios`](https://github.com/Gapwise-for-UTM/ios)** | Native Swift + SwiftUI iOS client | iOS app |
| **[`ai`](https://github.com/Gapwise-for-UTM/ai)** | OAuth/MCP layer for explicitly delegated student context and bounded actions | [ai.gapwise.ca](https://ai.gapwise.ca) |
| **[`data`](https://github.com/Gapwise-for-UTM/data)** | Canonical public UTM campus data, provenance, schemas, validation, and distribution | [data.gapwise.ca](https://data.gapwise.ca) |
| **[`docs`](https://github.com/Gapwise-for-UTM/docs)** | Canonical public developer documentation | [docs.gapwise.ca](https://docs.gapwise.ca) |
| **[`status`](https://github.com/Gapwise-for-UTM/status)** | Independent service-health monitoring and incident communication | [status.gapwise.ca](https://status.gapwise.ca) |

The organization-wide community and contribution defaults live in [`Gapwise-for-UTM/.github`](https://github.com/Gapwise-for-UTM/.github).

---

## Student product

### ACORN timetable import

- Import a University of Toronto ACORN `.ics` file directly in the browser.
- UTM (`...5`), UTSG (`...1`), UTSC (`...3`), and mixed-campus schedules are supported.
- Source-backed locations are retained instead of being collapsed into a single-campus namespace.
- The raw calendar file is not uploaded merely to build the timetable.
- Guest mode is first-class.
- A synthetic demo timetable allows exploration without personal data.

### Timetable intelligence

Gapwise treats the timetable as an input to planning, not merely something to render. It derives the spaces between classes and evaluates them using schedule boundaries, routing, preferences, protected transition buffers, setup/pack-up overhead, and explicit uncertainty.

Recommendations can distinguish transitions, reset windows, focus/study blocks, meals, longer flexible gaps, and commute/home candidates without delegating timetable arithmetic to a language model.

### Today and leave-by timing

The Today surface combines current/next-class context, gap context, deterministic recommendations, route state, travel time, protected transition buffers, leave-by timing, and direct navigation actions while handling online, TBA, unknown, approximate, or inaccessible/unverified states explicitly.

### Campus map and routing

The current first-party campus engine is UTM-focused. Gapwise separates building identity, visual geography, route evidence, and accessibility evidence instead of collapsing them into one guessed location model.

Typical route states include:

- **routed / verified or mixed**;
- **approximate / inferred**;
- **same-building**;
- **unavailable** when evidence is insufficient.

Step-free routing fails closed when verified accessible evidence is unavailable. UTSG and UTSC timetable locations remain valid timetable locations without being falsely plotted onto the UTM map.

### Day Replay

[Day Replay](https://gapwise.ca/replay) simulates a selected campus day in the browser and lets a user scrub through classes, gaps, transitions, route progression, deterministic recommendations, usable time, leave-by timing, and route-confidence states.

---

## Native clients

### Android

[`android`](https://github.com/Gapwise-for-UTM/android) is the native Kotlin + Jetpack Compose client. Its current shell already supports local `.ics` import across all three U of T campuses and keeps non-UTM locations source-backed while the native map remains UTM-scoped. Persistence, account continuity, and the full native routing experience are being layered in deliberately rather than being claimed ahead of implementation.

### iOS

[`ios`](https://github.com/Gapwise-for-UTM/ios) is the native Swift + SwiftUI client. It is currently at an early repository/bootstrap stage with the same target contract: all-campus timetable identity, local-first handling, and UTM-focused map/routing where first-party campus data exists.

Both clients are intended to feel native to their platforms while consuming canonical Gapwise semantics rather than becoming independent timetable or routing engines.

---

## Gapwise Platform: public API and SDKs

Canonical public API:

```text
https://api.gapwise.ca/v1
```

Machine-readable OpenAPI 3.1 contract:

```text
https://api.gapwise.ca/openapi.json
```

The public API exposes deterministic **campus intelligence**, not private student data.

Current platform capabilities include:

| Capability | Purpose |
| --- | --- |
| Buildings | Canonical UTM building/facility identity, aliases, coverage, accessibility state, and provenance |
| Places | Canonical UTM campus places with freshness and provenance |
| Routing | Deterministic UTM building-to-building route computation |
| Gap planning | Route-aware assessment of an explicit free interval |
| Version metadata | API/data version and privacy metadata |

Official developer surfaces:

- **Developer hub:** https://gapwise.ca/developers
- **Docs:** https://docs.gapwise.ca
- **OpenAPI:** https://api.gapwise.ca/openapi.json
- **JavaScript / TypeScript SDK:** `@gapwise/sdk@0.1.1` on npm and JSR
- **Python SDK:** `gapwise==0.1.0` on PyPI
- **Versioned compact campus snapshot:** https://gapwise.ca/data/utm-campus-v1.json

The public campus snapshot currently contains **30 canonical UTM buildings/facilities** with normalized identity, routing/accessibility state, and provenance.

---

## Gapwise Data

[Gapwise Data](https://data.gapwise.ca) is the canonical public UTM campus-data and provenance layer. It makes the data model inspectable instead of treating map facts as invisible implementation detail.

It covers campus geometry, building registries, entrances, routing evidence, source IDs, normalization, schemas, validation, attribution, reuse rules, and explicit fact-versus-inference boundaries.

The core app consumes a validated build-time snapshot so production routing does **not** depend on the Data website or GitHub being reachable at request time.

---

## Gapwise AI

[Gapwise AI](https://ai.gapwise.ca) is the provider-neutral OAuth/MCP boundary for public campus intelligence and explicitly delegated student context.

Canonical MCP endpoint:

```text
https://ai.gapwise.ca/api/mcp
```

The boundary is intentionally narrow:

```text
Gapwise deterministic truth  →  permissioned MCP  →  assistant reasoning/advice
```

Public campus tools remain deterministic and UTM-scoped. Private student context is opt-in and minimized. Raw ACORN files, friend data, precise/live location, account credentials, primary private-data encryption keys, and unrelated browser state are excluded from delegated snapshots under the current contract.

Gapwise AI is not a second timetable engine and does not make an LLM responsible for class/gap arithmetic or campus routing truth.

---

## Developer documentation and operations

[docs.gapwise.ca](https://docs.gapwise.ca) is the canonical public documentation surface for APIs, SDKs, platform architecture, provenance, security/privacy boundaries, and AI/MCP integration.

[status.gapwise.ca](https://status.gapwise.ca) is deployed independently from the main app and docs. It reports safely observable service health and operator-maintained state without turning uptime monitoring into a source of product or release semantics.

---

## Deterministic by design

Language models do not own calculations that decide whether a student can physically make the next class.

Deterministic Gapwise domain logic owns:

- calendar normalization and recurrence;
- class/gap boundary arithmetic;
- campus/course identity;
- building identity resolution;
- UTM route computation and route confidence;
- walking-time estimation;
- transition buffers;
- gap activity budgets;
- destination feasibility;
- leave-by and arrival timing;
- accessibility uncertainty.

Web and native interfaces render or consume those decisions. The API exposes them. Data explains their evidence. Docs describe their contracts. AI reasons over bounded context. Status observes the services that deliver them.

---

## Privacy and cybersecurity architecture

Gapwise is designed around data minimization, explicit trust boundaries, and defense in depth.

Key properties include:

- local-first timetable parsing;
- guest-first core functionality;
- optional cloud sync;
- browser-side encryption for supported private sync payloads;
- foreground-only, opt-in live location;
- explicit, minimized, revocable AI delegation;
- caller-scoped authenticated access;
- separate encryption domains for delegated AI state;
- OAuth-based sign-in and permission boundaries;
- Supabase/Postgres with row-level security;
- Cloudflare Turnstile protection at the auth boundary;
- dedicated security contact at `security@gapwise.ca`;
- explicit separation between public campus data and private student state;
- no claim of zero knowledge or end-to-end encryption where the architecture does not actually provide it.

Read [`PRIVACY.md`](PRIVACY.md), [`SECURITY.md`](SECURITY.md), and [`docs/PRIVATE_CLOUD_SECURITY_ARCHITECTURE.md`](docs/PRIVATE_CLOUD_SECURITY_ARCHITECTURE.md).

---

## Tech stack

Core web/platform technologies include React, TypeScript, TanStack, Vite, Tailwind CSS, MapLibre GL, Supabase/Postgres/RLS, Bun/Node tooling, OpenAPI 3.1, Playwright, Vercel, Cloudflare, Resend, and GitHub Actions.

The wider ecosystem adds **Kotlin + Jetpack Compose** for Android, **Swift + SwiftUI** for iOS, Astro/Starlight for docs/status surfaces, and Model Context Protocol + OAuth for permissioned AI integration.

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

Guest mode works without backend configuration.

Optional Supabase-backed features use browser-safe variables only:

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Never place a service-role key, OAuth client secret, SMTP/API credential, encryption key, or other privileged server secret in a `VITE_` variable.

---

## Verification

Normal release gates include typechecking, linting, unit/integration tests, production build, formatting checks, and Playwright end-to-end coverage. Database/security changes also require the isolated Supabase and operational checks documented in the repository.

`main` is production. Focused changes should pass the relevant CI and review gates before reaching it.

---

## Independent project

> **Gapwise is an independent student software project created by Andrew Muratov. It is not affiliated with, endorsed by, or an official service of the University of Toronto.**

## License

Original project code and documentation are available under the [MIT License](LICENSE). Third-party software, fonts, services, and upstream/OpenStreetMap-derived data remain subject to their own terms; see [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

<div align="center">

**Built for the spaces between classes — engineered as a platform.**

[Open Gapwise →](https://gapwise.ca)

</div>
