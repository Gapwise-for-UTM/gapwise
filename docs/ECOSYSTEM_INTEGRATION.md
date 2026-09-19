# Gapwise ecosystem integration contract

Gapwise is one product ecosystem implemented across seven product repositories and the organization-wide `.github` repository. Repository boundaries exist for deployment, trust, and ownership reasons; they are not permission to invent parallel product truth.

## Repository graph

| Repository | Owns                                                                                             | Consumes                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `data`     | Canonical public UTM facts, geometry, entrances, graph inputs, evidence, schemas and derivation  | Reviewed public/field evidence; core consumer tests                                |
| `gapwise`  | Web/PWA, timetable/gap/routing semantics, encrypted private state, API v1, OpenAPI and both SDKs | Validated build-time Data mirror; explicit AI delegation                           |
| `android`  | Kotlin/Compose UX, Keystore persistence, native import and encrypted-sync adapter                | Core HTTP/crypto contracts and public campus APIs                                  |
| `ios`      | SwiftUI UX and portable local timetable foundation                                               | Conservative UTM identity; future campus/account integrations remain unimplemented |
| `ai`       | OAuth/MCP authorization, minimized snapshots and bounded preference actions                      | Core public API and browser-authoritative delegated snapshots                      |
| `docs`     | Public developer documentation                                                                   | Released producer contracts, including AI's generated MCP manifest                 |
| `status`   | Independent probes and incident presentation                                                     | Public service endpoints and operator-confirmed facts                              |
| `.github`  | Organization contributor, support and security guidance                                          | Ownership boundaries above                                                         |

## Public developer platform

Canonical endpoints and packages:

- App: `https://gapwise.ca`
- Public API: `https://api.gapwise.ca/v1`
- OpenAPI 3.1: `https://api.gapwise.ca/openapi.json`
- Developer docs: `https://docs.gapwise.ca`
- Data/provenance: `https://data.gapwise.ca`
- AI/MCP: `https://ai.gapwise.ca/api/mcp`
- Status: `https://status.gapwise.ca`
- TypeScript SDK: `@gapwise/sdk`
  - npm: `0.1.1` published with provenance
  - JSR: `@gapwise/sdk@0.1.1` published through GitHub Actions OIDC with provenance
  - GitHub Packages: public source-adjacent mirror `@gapwise-for-uoft/sdk@0.1.1`
- Python SDK: `gapwise==0.1.0` on PyPI through Trusted Publishing

The TypeScript SDK is one portable implementation, not separate Node, Deno, and Bun SDKs. npm and JSR are distribution channels; Node, Bun, and Deno are runtime targets. Python remains an equal first-party implementation with the same public v1 semantics.

## Source-of-truth flow

```text
canonical campus/data evidence
          |
          v
      gapwise core
 deterministic domain logic
          |
   +------+------+----------------+
   |             |                |
   v             v                v
public API     mobile          student web
   |
   +--------+---------+
            |         |
            v         v
       TS SDK       Python SDK
       npm/JSR        PyPI
            |
            v
       public developers

private student state
          |
          | explicit delegation only
          v
      ai repository OAuth/MCP

all public services ---> status repository
all released contracts -> docs repository
campus evidence --------> data (canonical owner)
```

## Cross-repository rules

1. **One canonical contract.** Public HTTP behavior comes from OpenAPI + `gapwise`; SDKs and docs follow it.
2. **Two equal SDK implementations.** TypeScript and Python receive equivalent API coverage, examples, release validation, and documentation attention.
3. **No runtime forks.** Node, Bun, and Deno support is achieved by portability/testing of the TypeScript SDK, not three codebases.
4. **Release claims are evidence-based.** npm, JSR, PyPI, mobile stores, AI client compatibility, and operational health are only called released/verified after the relevant external evidence exists.
5. **Private and public surfaces stay separate.** Public SDKs expose campus intelligence only; private student context stays behind explicit OAuth/MCP delegation.
6. **Data uncertainty survives every layer.** Unknown, inferred, approximate, unavailable, and unverified states must not be silently promoted to certainty by mobile, SDKs, docs, AI, or status.
7. **Status reports health, not truth.** Registry/package existence and product semantics belong to release/docs sources; Status monitors availability and incidents.
8. **Docs describe owners.** `docs` links to owning repositories and released behavior instead of redefining it.
9. **Repository changes propagate intentionally.** A contract change in one owning repo must identify downstream docs/mobile/data/AI/status consequences before release.

## SDK release synchronization

The shared release workflow is `.github/workflows/release-sdks.yml`.

- npm publication uses OIDC Trusted Publishing.
- JSR publication uses the JSR-linked GitHub repository and OIDC; no JSR token is stored.
- PyPI publication uses Trusted Publishing; no PyPI API token is stored.
- TypeScript verification covers Bun tests, npm artifact/Node clean installation, JSR dry-run validation, and Deno portability checks.
- Python verification covers formatting/linting, tests, wheel/sdist build, Twine validation, typed-package marker, and clean installation.
- Contract drift checks remain responsible for keeping OpenAPI, TypeScript, Python, and maintained docs aligned.

See `docs/SDK_RELEASE.md` for the operational release procedure.

## Change-impact checklist

For any ecosystem-level change, ask all of the following:

- Does OpenAPI or public API behavior change?
- Do both SDKs need code/type/example changes?
- Does the TypeScript change remain portable across Node, Bun, and Deno?
- Does `docs` need a released-contract update?
- Does `data` need schema/provenance/example changes?
- Does `android` / `ios` consume or mirror any affected semantics?
- Does `ai` depend on or expose a delegated form of the affected concept?
- Does `status` need a new/renamed monitored public surface?
- Are privacy, security, uncertainty, attribution, or source-of-truth statements still accurate?

A change is ecosystem-complete only when the relevant answers are handled, not merely when one repository builds.

## Local coordinated changes

Keep each checkout independent. For campus changes, edit `data/data/utm/entrances.geojson`,
run `npm run entrances:derive` and `npm run data:preflight` in Data, review its visual map,
then run `bun run campus-data:sync` and `bun run campus-data:check` in core. Both the
64-file runtime mirror and public snapshot are synchronized. Core never fetches Data on
student requests. Removing a graph entrance requires reviewed topology, not guessed connectivity.

AI owns `contracts/mcp-live-surface.json`, generated from tool registrations by
`npm run contract:generate`. Docs vendors it with `npm run mcp-contract:sync` and checks it
against the producer in CI. Merge producer changes before consumer documentation updates;
keep tool-schema compatibility and mixed-version deployment behavior explicit.

Native implementations remain platform-specific subsets. Web all-campus timetable identity
does not imply shipped all-campus native coverage, and iOS currently has no account sync or
production routing. Do not describe platform aspirations as implemented contracts.
