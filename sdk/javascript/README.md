# `@gapwise/sdk`

Official dependency-free TypeScript client for the unauthenticated Gapwise Public Campus API v1. It works in modern browsers and Node 20+ and defaults to `https://api.gapwise.ca/v1`.

```bash
# Not published to npm yet. From a checkout of this repository:
npm install ./sdk/javascript
```

```ts
import { Gapwise, GapwiseApiError } from "@gapwise/sdk";
const gapwise = new Gapwise();

const info = await gapwise.info();
const mn = await gapwise.buildings.get("MN");
const buildings = await gapwise.buildings.list({ q: "instructional", category: "academic" });
const places = await gapwise.places.list({ building: "HM", kind: "library" });
const route = await gapwise.routes.calculate({ from: "MN", to: "IB" });
const plan = await gapwise.gaps.plan({ from: "MN", to: "IB", term: "Fall", weekday: "Wednesday", startTime: 660, endTime: 780 });

// Unknown availability is not closed. Preserve this distinction in your UI.
for (const place of places.data) console.log(place.name, place.availability.state);
```

Collections return `{ data, meta }`; `meta.pagination.nextOffset` is `null` on the last page. Every operation accepts `{ signal, timeoutMs }`. Configure `new Gapwise({ baseUrl, fetch, timeoutMs, headers })` for tests, proxies, or other runtimes.

HTTP failures throw `GapwiseApiError` with `status`, stable `code`, optional `details`, and `requestId`. Timeouts throw `GapwiseTimeoutError`; malformed successful responses throw `GapwiseResponseError`. If an error has code `rate_limited`, respect the server's retry guidance before retrying.

API v1, campus data versions, and this package version evolve independently. See [`../../docs/DEVELOPER_PLATFORM.md`](../../docs/DEVELOPER_PLATFORM.md) for filtering, uncertainty, privacy, versioning, and legacy migration guidance.
