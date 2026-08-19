# Gapwise Platform

Gapwise exposes a small public campus-intelligence surface for University of Toronto Mississauga projects. It is the same deterministic building/routing/gap-planning layer used by Gapwise product surfaces, with no private student timetable or account data required.

## Public resources

- Developer page: `https://gapwise.ca/developers`
- OpenAPI 3.1: `https://gapwise.ca/openapi.json`
- Open UTM building snapshot: `https://gapwise.ca/data/utm-campus-v1.json`
- Zero-dependency browser/TypeScript client: `https://gapwise.ca/sdk/gapwise-utm.js`
- Type declarations: `https://gapwise.ca/sdk/gapwise-utm.d.ts`
- Visual Day Replay: `https://gapwise.ca/replay`

## API

The public v1-preview surface intentionally stays small:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/utm-buildings` | Canonical UTM building inventory, routing coverage, accessibility status, and provenance |
| `GET` | `/api/utm-building?q=MN` | Resolve a canonical building by code/name/recognized alias |
| `POST` | `/api/utm-route` | Deterministic building-to-building campus routing |
| `POST` | `/api/utm-gap-plan` | Deterministic route-aware gap assessment |

No API key is required for these public campus-data endpoints. They do not expose private timetable, friend, account, credential, or live-location data.

## JavaScript / TypeScript quick start

```js
import { gapwise } from "https://gapwise.ca/sdk/gapwise-utm.js";

const route = await gapwise.route({ from: "MN", to: "IB" });
console.log(route.route.status, route.route.estimatedSeconds);
```

```js
const plan = await gapwise.planGap({
  from: "MN",
  to: "IB",
  term: "Fall",
  weekday: "Wednesday",
  startTime: 660,
  endTime: 780,
});

console.log(plan.gapPlan.assessment.primary);
```

The client is deliberately a thin wrapper around standard `fetch`. Projects that prefer generated clients can use the OpenAPI document instead.

## Reliability and uncertainty

Gapwise does not treat every campus route as equally known. Consumers should preserve and display route `status`, `accuracy`, `routeVerification`, and `warnings`. Step-free routing fails closed when an accessible route cannot be verified. Building-level routing must not be presented as verified room-to-room indoor routing unless that coverage actually exists.

## Open UTM data

`public/data/utm-campus-v1.json` is a versioned, privacy-safe snapshot of the public building layer. It includes canonical building identity, aliases, routing-coverage status, entrance-count summaries, accessibility status, and normalized source provenance.

The richer routing source files remain in `src/data/utm/` so researchers and developers can inspect the actual graph inputs rather than relying on an opaque export.

## Licensing and attribution

Gapwise source code is licensed under MIT. That license does **not** replace upstream data licenses.

Some campus records are derived from OpenStreetMap and require OpenStreetMap attribution and compliance with the Open Database License (ODbL). Other records identify their University of Toronto Mississauga public source in provenance metadata. If you redistribute or build a derived database, review and follow the applicable upstream terms.

## Resource model

The platform is intentionally static-first and bounded:

- OpenAPI, SDK files, and the dataset snapshot are static assets.
- The live playground only calls an API after a user explicitly runs an example.
- Day Replay performs calendar parsing, schedule simulation, routing, and gap calculations in the browser.
- No new database table, storage bucket, polling worker, cron job, or hosted model is required for this release.

This keeps the public platform useful without turning every page view into backend compute.
