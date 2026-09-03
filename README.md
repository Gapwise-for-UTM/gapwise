<div align="center">

<img src="public/logo-mark.svg" width="116" alt="Gapwise deer mark" />

# Gapwise

### A privacy-first campus-intelligence ecosystem for UTM.

**Gapwise is a connected software platform for understanding and acting on a student's day: timetable intelligence, gap planning, campus routing, leave-by timing, open campus data, public APIs and SDKs, native mobile, permissioned AI, developer documentation, and independent service monitoring.**

[![Open Gapwise](https://img.shields.io/badge/Open_Gapwise-gapwise.ca-0A84FF?style=for-the-badge&logo=vercel&logoColor=white)](https://gapwise.ca)
[![CI](https://img.shields.io/github/actions/workflow/status/andrewmuratov/gapwise/ci.yml?branch=main&style=for-the-badge&label=CI)](https://github.com/andrewmuratov/gapwise/actions/workflows/ci.yml)
[![OpenAPI 3.1](https://img.shields.io/badge/OpenAPI-3.1-6BA539?style=for-the-badge&logo=openapiinitiative&logoColor=white)](https://api.gapwise.ca/openapi.json)
[![MIT](https://img.shields.io/badge/License-MIT-111111?style=for-the-badge)](LICENSE)

<sub>React · TypeScript · TanStack · MapLibre · Supabase · Bun · Vercel · Cloudflare · Resend · OpenAPI · MCP</sub>

<br />

**[App](https://gapwise.ca)** · **[API](https://api.gapwise.ca/v1)** · **[Data](https://data.gapwise.ca)** · **[AI](https://ai.gapwise.ca)** · **[Docs](https://docs.gapwise.ca)** · **[Status](https://status.gapwise.ca)** · **[Trust](https://gapwise.ca/trust)** · **[OpenAPI](https://api.gapwise.ca/openapi.json)**

</div>

---

## What Gapwise is

Gapwise began with a simple student problem: a timetable says **when** class happens, but not what to do with the time around it.

The platform turns a UTM ACORN `.ics` timetable export into a local-first model of a student's day and answers practical questions such as:

- What is next?
- Where do I need to go?
- When should I leave?
- How much usable time do I actually have between classes?
- Can I go somewhere and still make the next class?
- Which campus places are realistic given route time, transition buffers, and uncertainty?

The original calendar file is parsed in the browser. From that normalized schedule, Gapwise builds timetable views, detects gaps, computes route-aware activity budgets, produces leave-by timing, renders campus navigation, and coordinates optional account, sync, mobile, API, data, and AI surfaces.

But Gapwise is now broader than the student web app: it is a **six-repository campus-intelligence ecosystem** with shared product semantics and deliberately separated trust boundaries.

---

## Created and engineered by Andrew Muratov

Gapwise is created and led by **Andrew Muratov**, a University of Toronto Mississauga Computer Science student working across **full-stack software engineering, cybersecurity and privacy engineering, platform architecture, API and SDK design, data engineering, developer infrastructure, mobile engineering, systems design, and permissioned AI integration**.

The project is designed as an integrated software ecosystem rather than a collection of disconnected demos. Product, API, mobile, data, AI, docs, and status surfaces share one source-of-truth hierarchy, one security model, one brand, and one set of deterministic campus semantics.

---

## The Gapwise ecosystem

| Repository | Role | Primary surface |
| --- | --- | --- |
| **[`gapwise`](https://github.com/andrewmuratov/gapwise)** | Core web/PWA product, canonical student-state behavior, deterministic campus engine, public API, OpenAPI contract, and SDK source | [gapwise.ca](https://gapwise.ca) / [api.gapwise.ca](https://api.gapwise.ca/v1) |
| **[`gapwise-mobile`](https://github.com/andrewmuratov/gapwise-mobile)** | Native iOS and Android client consuming canonical Gapwise contracts | Native mobile app |
| **[`gapwise-ai`](https://github.com/andrewmuratov/gapwise-ai)** | OAuth-protected MCP layer for explicitly delegated student context and bounded AI-facing actions | [ai.gapwise.ca](https://ai.gapwise.ca) |
| **[`gapwise-data`](https://github.com/andrewmuratov/gapwise-data)** | Open campus-data, provenance, schema, validation, and reuse portal | [data.gapwise.ca](https://data.gapwise.ca) |
| **[`gapwise-docs`](https://github.com/andrewmuratov/gapwise-docs)** | Canonical public developer documentation for platform, SDKs, security, data, and AI/MCP integration | [docs.gapwise.ca](https://docs.gapwise.ca) |
| **[`gapwise-status`](https://github.com/andrewmuratov/gapwise-status)** | Independently deployed service-health monitoring and incident communication | [status.gapwise.ca](https://status.gapwise.ca) |

The architectural rule across every surface is simple:

> **Gapwise owns the facts and deterministic calculations. Interfaces consume, expose, or explain that truth rather than silently recreating it.**

---

## Student product

### ACORN timetable import

- Import a UTM ACORN `.ics` file directly in the browser.
- The raw calendar file is not uploaded merely to build the timetable.
- Guest mode is first-class.
- A synthetic demo timetable allows exploration without personal data.
- Course-title enrichment is privacy-minimized and retains local fallback behavior.

### Timetable intelligence

Gapwise treats the timetable as an input to planning, not just something to render. It derives the spaces between classes and evaluates them using schedule boundaries, routing, preferences, protected transition buffers, setup/pack-up overhead, and explicit uncertainty.

Recommendations can distinguish transitions, reset windows, focus/study blocks, meals, longer flexible gaps, and commute/home candidates without delegating timetable arithmetic to an LLM.

### Today and leave-by timing

The Today surface combines:

- current and next class context;
- active gap context;
- deterministic recommendations;
- route state and travel time;
- protected transition buffers;
- leave-by and arrival timing;
- direct navigation actions;
- safe handling of online, TBA, unknown, approximate, or inaccessible/unverified states.

### “Can I go there?”

During a bounded gap, a student can choose a canonical campus destination and ask whether the visit is feasible before the next class.

Gapwise evaluates both legs:

```text
previous class → chosen destination → next class
```

The result accounts for travel time, transition protection, setup/pack-up overhead, usable destination time, latest leave time, confidence, and warnings.

### Campus map and routing

Gapwise separates building identity, visual geography, route evidence, and accessibility evidence instead of collapsing them into one guessed location model.

Typical route states include:

- **routed / verified or mixed**;
- **approximate / inferred**;
- **same-building**;
- **unavailable** when evidence is insufficient.

Step-free routing fails closed when verified accessible evidence is unavailable.

Walking times are deterministic planning estimates, not guarantees. Actual travel time can vary with walking speed, accessibility needs, entrances, elevators, congestion, construction, temporary closures, weather, and route choice. Gapwise keeps route confidence and evidence visible rather than presenting uncertain routes as exact facts.

### Day Replay

[Day Replay](https://gapwise.ca/replay) simulates a selected campus day entirely in the browser and lets a user scrub through classes, gaps, transitions, route progression, deterministic recommendations, usable time, leave-by timing, and route-confidence states.

---

## Gapwise Platform: public API and SDKs

The canonical public API is:

```text
https://api.gapwise.ca/v1
```

Machine-readable contract:

```text
https://api.gapwise.ca/openapi.json
```

The public API exposes deterministic **campus intelligence**, not private student data.

Current platform capabilities include:

| Capability | Purpose |
| --- | --- |
| Buildings | Canonical UTM building/facility identity, aliases, coverage, accessibility state, and provenance |
| Places | Canonical campus places with freshness and provenance |
| Routing | Deterministic building-to-building route computation |
| Gap planning | Route-aware assessment of an explicit free interval |
| Version metadata | API/data version and privacy metadata |

The platform shares the same deterministic domain logic used by the student product rather than maintaining an independent implementation.

Official developer surfaces include:

- **Developer hub:** https://gapwise.ca/developers
- **Docs:** https://docs.gapwise.ca
- **OpenAPI:** https://api.gapwise.ca/openapi.json
- **JavaScript/TypeScript SDK:** `@gapwise/sdk`
- **Python SDK source:** [`sdk/python`](sdk/python)
- **Versioned public campus snapshot:** https://gapwise.ca/data/utm-campus-v1.json

The current public snapshot contains **30 canonical UTM buildings/facilities** with normalized identity, routing/accessibility state, and provenance.

---

## Gapwise Data

[Gapwise Data](https://data.gapwise.ca) makes the campus-data layer inspectable instead of treating it as invisible implementation detail.

It documents and explores:

- campus geometry;
- building registries;
- entrance and routing evidence;
- provenance and source IDs;
- normalization and validation workflows;
- schemas;
- attribution and reuse rules;
- fact-versus-inference boundaries;
- uncertainty and coverage limitations.

This matters because campus software should be able to explain **why** it believes a location or route is correct, not merely return coordinates with false confidence.

---

## Gapwise AI

[Gapwise AI](https://ai.gapwise.ca) is a separately deployed provider-neutral OAuth/MCP service for explicitly delegated student context.

Canonical MCP endpoint:

```text
https://ai.gapwise.ca/api/mcp
```

The AI layer is designed around a strict distinction:

```text
Gapwise deterministic truth  →  permissioned MCP  →  assistant reasoning/advice
```

AI access is opt-in and minimized. The delegated boundary excludes raw ACORN files, friend data, precise/live location, credentials, primary private-data encryption keys, and unrelated browser state.

Academic meetings remain read-only to AI. Bounded personal-item or preference mutations are typed, permission-checked, revision-bound, and queued for Gapwise rather than granting an assistant arbitrary timetable-write access.

Gapwise AI is not presented as a second timetable engine or as a universal LLM backend. It exists so compatible assistants can reason over exact Gapwise context while the platform remains the source of truth.

---

## Mobile

[`gapwise-mobile`](https://github.com/andrewmuratov/gapwise-mobile) is the native iOS and Android client built with Expo and React Native.

It brings canonical Gapwise semantics to phone-native interaction patterns including Today, timetable, campus, routing, exports, account continuity, settings, diagnostics, accessibility, and permissioned AI surfaces.

It is intentionally not a WebView wrapper and should not fork timetable, routing, gap-planning, or campus truth from the main platform.

---

## Developer documentation

[docs.gapwise.ca](https://docs.gapwise.ca) is the canonical public documentation surface for:

- platform quickstarts;
- API endpoints and response semantics;
- OpenAPI;
- SDKs;
- integration guides;
- provenance and uncertainty;
- privacy/security architecture;
- AI/MCP OAuth and permission boundaries;
- source-of-truth and versioning rules.

Documentation follows released contracts; it should not become an independent source of product behavior.

---

## Status and operations

[status.gapwise.ca](https://status.gapwise.ca) is deployed independently from the main app and docs so an outage in those surfaces does not automatically remove the incident-communication channel.

It tracks safely observable public services through automated checks and retains operator-maintained state for services that cannot be responsibly validated by a public HTTP probe alone.

Stale monitoring becomes visibly **unknown / monitoring delayed** rather than silently remaining green.

---

## Deterministic by design

LLMs do not own the calculations that determine whether a student can physically make the next class.

Deterministic Gapwise domain logic owns:

- calendar normalization and recurrence;
- class/gap boundary arithmetic;
- building identity resolution;
- campus routing;
- walking-time estimation;
- transition buffers;
- gap activity budgets;
- destination feasibility;
- leave-by and arrival timing;
- route and accessibility uncertainty.

React renders those decisions. Mobile consumes them. The public API exposes them. Data explains their evidence. Docs describe their contracts. AI reasons over them. Status monitors the surfaces that serve them.

---

## Privacy, trust, and cybersecurity architecture

Gapwise is designed around data minimization, explicit trust boundaries, and defense in depth.

Key properties include:

- local-first timetable parsing;
- guest-first core functionality;
- optional cloud sync;
- browser-side encryption for private sync payloads;
- foreground-only, opt-in live location;
- explicit, minimized, revocable AI delegation;
- caller-scoped authenticated access;
- separate encryption domains for delegated AI state;
- OAuth-based sign-in and permission boundaries;
- Supabase/Postgres with row-level security;
- Cloudflare Turnstile protection at the auth boundary;
- explicit separation between public campus data and private student state;
- no claim of zero knowledge or end-to-end encryption where the architecture does not actually provide it.

The public [Trust Center](https://gapwise.ca/trust) is the canonical user-facing summary of these boundaries and links to the detailed privacy, security, accessibility, data provenance, incident-response, and operational surfaces.

### Contact

- **General support, privacy questions, account help, and non-security bugs:** `support@gapwise.ca`
- **Security vulnerabilities and sensitive security reports:** `security@gapwise.ca`

Do not place vulnerability details, credentials, tokens, private student data, or cryptographic material in public issues.

Read the [Trust Center](https://gapwise.ca/trust), [`PRIVACY.md`](PRIVACY.md), [`SECURITY.md`](SECURITY.md), and [`docs/PRIVATE_CLOUD_SECURITY_ARCHITECTURE.md`](docs/PRIVATE_CLOUD_SECURITY_ARCHITECTURE.md).

---

## Tech stack

Core technologies across the main platform include:

- React + TypeScript;
- TanStack Router / Start;
- Vite;
- Tailwind CSS;
- MapLibre GL;
- Supabase Auth / Postgres / RLS;
- Bun and Node tooling;
- OpenAPI 3.1;
- Playwright + accessibility coverage;
- Vercel;
- Cloudflare DNS, Email Routing, and Turnstile;
- Resend for transactional auth email;
- GitHub Actions.

The wider ecosystem adds Expo/React Native, Astro/Starlight, Model Context Protocol, OAuth, and separate status/data deployment surfaces.

---

## Run locally

Requirements:

- Bun 1.3.x
- Node 24.x where Node-based tooling is required

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
