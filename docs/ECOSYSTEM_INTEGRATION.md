# Gapwise ecosystem integration contract

Gapwise is one product ecosystem implemented across seven first-party product repositories. Repository boundaries exist for deployment, platform, trust, and ownership reasons; they are not permission to invent parallel product truth. Organization-wide GitHub defaults live separately in `Gapwise-for-UTM/.github`.

## Repository graph

| Repository | Owns | Consumes from the ecosystem | Must not become |
| --- | --- | --- | --- |
| `gapwise` | canonical student-state semantics, deterministic timetable/gap/routing logic, public API v1, OpenAPI, official TypeScript + Python SDK source | data evidence, native-client requirements, AI integration state, operational links | a duplicate docs/status/data site |
| `android` | native Android UX, Android persistence/adapters, secure device integration and Android distribution behavior | canonical Gapwise product/API semantics, AI boundary, data provenance | an independent timetable/routing engine |
| `ios` | native iOS UX, iOS persistence/adapters, secure device integration and iOS distribution behavior | canonical Gapwise product/API semantics, AI boundary, data provenance | an independent timetable/routing engine |
| `ai` | OAuth/MCP authorization boundary, delegated snapshots, bounded AI actions | canonical Gapwise student/campus semantics | a second source of timetable truth or a public SDK backend |
| `data` | canonical public UTM campus facts, geometry, provenance, schemas, attribution, evidence and raw-data distribution | source evidence and core compatibility requirements | an alternate API implementation |
| `docs` | canonical public developer documentation | released contracts from every owning repository | an independent product contract |
| `status` | independent health/incident communication | public endpoints and operator-maintained health facts | a source of product/release semantics |

## Product scope

Timetable identity spans the three University of Toronto campuses: UTM, UTSG, and UTSC, including mixed-campus schedules. The first-party campus map, route graph, place data, and public campus-data distribution are currently UTM-focused. Cross-campus timetable support must not be misrepresented as equivalent map/routing coverage.

## Public developer platform

Canonical endpoints and packages:

- App: `https://gapwise.ca`
- Public API: `https://api.gapwise.ca/v1`
- OpenAPI 3.1: `https://api.gapwise.ca/openapi.json`
- Developer docs: `https://docs.gapwise.ca`
- Data/provenance: `https://data.gapwise.ca`
- AI/MCP: `https://ai.gapwise.ca/api/mcp`
- Status: `https://status.gapwise.ca`
- Android source: `https://github.com/Gapwise-for-UTM/android`
- iOS source: `https://github.com/Gapwise-for-UTM/ios`
- TypeScript SDK: `@gapwise/sdk`
  - npm: `0.1.1` published with provenance
  - JSR: `@gapwise/sdk@0.1.1` published through GitHub Actions OIDC with provenance
  - GitHub Packages: public source-adjacent mirror `@gapwise-for-utm/sdk@0.1.1`
- Python SDK: `gapwise==0.1.0` on PyPI through Trusted Publishing

The TypeScript SDK is one portable implementation, not separate Node, Deno, and Bun SDKs. npm and JSR are distribution channels; Node, Bun, and Deno are runtime targets. Python remains an equal first-party implementation with the same public v1 semantics.

## Source-of-truth flow

```text
canonical UTM campus/data evidence
              |
              v
          gapwise core
     deterministic domain logic
              |
      +-------+-------+-------+
      |       |       |       |
      v       v       v       v
 public API   web   Android   iOS
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
          ai OAuth/MCP

all public services ---> status
all released contracts -> docs
UTM campus evidence ----> data
```

## Cross-repository rules

1. **One canonical contract.** Public HTTP behavior comes from OpenAPI + `gapwise`; SDKs and docs follow it.
2. **Two equal SDK implementations.** TypeScript and Python receive equivalent API coverage, examples, release validation, and documentation attention.
3. **Native clients consume product truth.** Android and iOS adapt interaction to their platforms without forking timetable, routing, or campus-data semantics.
4. **No runtime forks.** Node, Bun, and Deno support is achieved by portability/testing of the TypeScript SDK, not three codebases.
5. **Release claims are evidence-based.** npm, JSR, PyPI, Android/iOS distribution, AI-client compatibility, and operational health are only called released/verified after the relevant external evidence exists.
6. **Private and public surfaces stay separate.** Public SDKs expose campus intelligence only; private student context stays behind explicit OAuth/MCP delegation.
7. **Campus scope stays honest.** All-campus timetable identity does not imply all-campus map/routing coverage; the current first-party campus engine and open-data layer are UTM-focused.
8. **Data uncertainty survives every layer.** Unknown, inferred, approximate, unavailable, and unverified states must not be silently promoted to certainty by web, Android, iOS, SDKs, docs, AI, or status.
9. **Status reports health, not truth.** Registry/package existence and product semantics belong to release/docs sources; Status monitors availability and incidents.
10. **Docs describe owners.** `docs` links to owning repositories and released behavior instead of redefining it.
11. **Repository changes propagate intentionally.** A contract change in one owning repo must identify downstream web/native/data/docs/AI/status consequences before release.

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
- Does `android` consume or mirror any affected semantics?
- Does `ios` consume or mirror any affected semantics?
- Does `ai` depend on or expose a delegated form of the affected concept?
- Does `status` need a new/renamed monitored public surface?
- Are privacy, security, campus-scope, uncertainty, attribution, or source-of-truth statements still accurate?

A change is ecosystem-complete only when the relevant answers are handled, not merely when one repository builds.
