# @gapwise/sdk

TypeScript-first official client for the public, privacy-safe Gapwise Campus API.

```ts
import { Gapwise } from "@gapwise/sdk";
const gapwise = new Gapwise();
const buildings = await gapwise.buildings.list();
const route = await gapwise.routes.calculate({ from: "MN", to: "IB" });
```

Use `new Gapwise({ baseUrl, fetch, timeoutMs, headers })` for custom environments. Every operation accepts `{ signal, timeoutMs }`. HTTP failures throw `GapwiseApiError`; client timeouts throw `GapwiseTimeoutError`.
