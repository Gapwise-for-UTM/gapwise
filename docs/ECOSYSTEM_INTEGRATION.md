# Gapwise ecosystem integration contract

Gapwise is one product ecosystem implemented across six first-party repositories. Repository boundaries exist for deployment, trust, and ownership reasons; they are not permission to invent parallel product truth.

## Repository graph

| Repository       | Owns                                                                                                                                          | Consumes from the ecosystem                                           | Must not become                                            |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------- |
| `gapwise`        | canonical student-state semantics, deterministic timetable/gap/routing logic, public API v1, OpenAPI, official TypeScript + Python SDK source | data evidence, AI integration state, operational links                | a duplicate docs/status/data site                          |
| `gapwise-mobile` | native iOS/Android UX, mobile persistence/adapters, secure device integration                                                                 | canonical Gapwise API/product semantics, AI boundary, data provenance | an independent timetable/routing engine                    |
| `gapwise-ai`     | OAuth/MCP authorization boundary, delegated snapshots, bounded AI actions                                                                     | canonical Gapwise student/campus semantics                            | a second source of timetable truth or a public SDK backend |
| `gapwise-data`   | public data/provenance explanation, schemas, attribution, evidence                                                                            | canonical campus datasets and public API contracts                    | an alternate API implementation                            |
| `gapwise-docs`   | canonical public developer documentation                                                                                                      | released contracts from every owning repository                       | an independent product contract                            |
| `gapwise-status` | independent health/incident communication                                                                                                     | public endpoints and operator-maintained health facts                 | a source of product/release semantics                      |

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
      gapwise-ai OAuth/MCP

all public services ---> gapwise-status
all released contracts -> gapwise-docs
campus evidence --------> gapwise-data
```

## Cross-repository rules

1. **One canonical contract.** Public HTTP behavior comes from OpenAPI + `gapwise`; SDKs and docs follow it.
2. **Two equal SDK implementations.** TypeScript and Python receive equivalent API coverage, examples, release validation, and documentation attention.
3. **No runtime forks.** Node, Bun, and Deno support is achieved by portability/testing of the TypeScript SDK, not three codebases.
4. **Release claims are evidence-based.** npm, JSR, PyPI, mobile stores, AI client compatibility, and operational health are only called released/verified after the relevant external evidence exists.
5. **Private and public surfaces stay separate.** Public SDKs expose campus intelligence only; private student context stays behind explicit OAuth/MCP delegation.
6. **Data uncertainty survives every layer.** Unknown, inferred, approximate, unavailable, and unverified states must not be silently promoted to certainty by mobile, SDKs, docs, AI, or status.
7. **Status reports health, not truth.** Registry/package existence and product semantics belong to release/docs sources; Status monitors availability and incidents.
8. **Docs describe owners.** `gapwise-docs` links to owning repositories and released behavior instead of redefining it.
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
- Does `gapwise-docs` need a released-contract update?
- Does `gapwise-data` need schema/provenance/example changes?
- Does `gapwise-mobile` consume or mirror any affected semantics?
- Does `gapwise-ai` depend on or expose a delegated form of the affected concept?
- Does `gapwise-status` need a new/renamed monitored public surface?
- Are privacy, security, uncertainty, attribution, or source-of-truth statements still accurate?

A change is ecosystem-complete only when the relevant answers are handled, not merely when one repository builds.
