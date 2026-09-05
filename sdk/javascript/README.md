# `@gapwise/sdk`

Official dependency-free TypeScript client for the unauthenticated Gapwise Public Campus API v1. The SDK is one implementation shared across modern JavaScript runtimes rather than separate Node, Deno, and Bun clients. It defaults to `https://api.gapwise.ca/v1`.

## Distribution and runtime model

The canonical package identity is `@gapwise/sdk`.

- **npm:** `@gapwise/sdk@0.1.1` is published with provenance and is the primary package for Node.js, Bun, browser bundlers, and npm-compatible tooling.
- **JSR:** `@gapwise/sdk@0.1.1` is published from the same TypeScript source through GitHub Actions OIDC with provenance. JSR publishes the source entry point directly from `src/index.ts`.
- **Node.js:** supported through the npm package; package metadata requires Node 20+.
- **Bun:** first-party test/runtime target using the same package and source.
- **Deno:** first-party portability target using the same TypeScript source/package; release verification runs JSR validation and Deno type/runtime checks before publication.
- **Browsers and edge-style runtimes:** the client is dependency-free and accepts an injected `fetch`; compatibility claims should stay evidence-based for each environment.

Python is an equal first-party SDK, not a fallback implementation. It is maintained in [`../python`](../python) and published as `gapwise` on PyPI. Public API changes must preserve contract parity across the TypeScript and Python clients.

Install the released npm package with:

```bash
npm install @gapwise/sdk@0.1.1
```

Install the same released TypeScript SDK from JSR with Deno:

```bash
deno add jsr:@gapwise/sdk@0.1.1
```

Or import the exact JSR version directly:

```ts
import { Gapwise } from "jsr:@gapwise/sdk@0.1.1";
```

For unreleased repository work, a local checkout can still be installed with `npm install ./sdk/javascript`.

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

## Security and release integrity

The package has no runtime dependencies. npm releases use GitHub Actions OIDC trusted publishing with provenance, while JSR releases use the same repository and source through its OIDC publisher. Release verification builds and tests the SDK, inspects the packed file list for credential-like material, installs the tarball into a clean consumer project, and checks the JSR/Deno source package before publication. The JSR CLI is pinned in the release workflow rather than downloaded as an unbounded latest version.

Report suspected vulnerabilities privately using the repository's [security policy](../../SECURITY.md). Do not include credentials, tokens, private timetable data, or exploitable details in a public issue.

API v1, campus data versions, npm/JSR package versions, and the Python package version evolve independently at the registry layer but must remain semantically aligned with the same released v1 contract. See [`../../docs/DEVELOPER_PLATFORM.md`](../../docs/DEVELOPER_PLATFORM.md) for filtering, uncertainty, privacy, versioning, and legacy migration guidance, and [`../../docs/SDK_RELEASE.md`](../../docs/SDK_RELEASE.md) for the release process.
