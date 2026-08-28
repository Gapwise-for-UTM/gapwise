# Gapwise Platform

Gapwise exposes a small public campus-intelligence surface for University of Toronto Mississauga projects. It is the same deterministic building/routing/gap-planning layer used by Gapwise product surfaces, with no private student timetable or account data required.

## Public resources

- Developer page: `https://gapwise.ca/developers`
- API base URL: `https://api.gapwise.ca/v1`
- OpenAPI 3.1: `https://api.gapwise.ca/openapi.json`
- Open UTM building snapshot: `https://gapwise.ca/data/utm-campus-v1.json`
- JavaScript/TypeScript SDK source: [`../sdk/javascript`](../sdk/javascript)
- Python SDK source: [`../sdk/python`](../sdk/python)
- Visual Day Replay: `https://gapwise.ca/replay`

## API

The canonical public v1 surface intentionally stays small:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/v1` | API/data versions, capabilities, and privacy metadata |
| `GET` | `/v1/buildings` | Canonical UTM building inventory, routing coverage, accessibility status, and provenance |
| `GET` | `/v1/buildings/MN` | Resolve a canonical building by code/name/recognized alias |
| `GET` | `/v1/places` | Discover source-backed campus places and availability |
| `GET` | `/v1/places/utm-library` | Resolve a canonical campus place |
| `POST` | `/v1/routes` | Deterministic building-to-building campus routing |
| `POST` | `/v1/gaps/plan` | Deterministic route-aware gap assessment |

No API key is required for these public campus-data endpoints. They do not expose private timetable, friend, account, credential, or live-location data.

## JavaScript / TypeScript quick start

The package names below are release targets and are **not yet published** to npm or PyPI. Run the JavaScript SDK from its repository source until the human registry-release gates complete.

```ts
import { Gapwise } from "@gapwise/sdk";

const gapwise = new Gapwise();
const route = await gapwise.routes.calculate({ from: "MN", to: "IB" });
console.log(route.status, route.estimatedSeconds);
```

```js
const plan = await gapwise.gaps.plan({
  from: "MN",
  to: "IB",
  term: "Fall",
  weekday: "Wednesday",
  startTime: 660,
  endTime: 780,
});

console.log(plan.assessment.primary);
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

- OpenAPI, SDK source, and the dataset snapshot are versioned repository artifacts.
- The live playground only calls an API after a user explicitly runs an example.
- Day Replay performs calendar parsing, schedule simulation, routing, and gap calculations in the browser.
- No new database table, storage bucket, polling worker, cron job, or hosted model is required for this release.

This keeps the public platform useful without turning every page view into backend compute.
