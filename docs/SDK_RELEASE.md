# SDK release runbook

Gapwise ships two equal first-party SDK implementations from this repository:

- JavaScript/TypeScript: `@gapwise/sdk` from `sdk/javascript`
- Python: `gapwise` from `sdk/python`

The JavaScript/TypeScript implementation is distributed through both npm and JSR rather than being forked into separate Node, Deno, or Bun SDKs. The Python implementation is distributed through PyPI. All releases consume the same public API v1 contract and must preserve semantic parity.

The release workflow is `.github/workflows/release-sdks.yml`. JavaScript publishing is manually dispatched so npm and JSR releases remain deliberate. Python publishing is automated from `python-v*` Git tags and can also be manually dispatched as a recovery path. npm, JSR, and PyPI publishing use short-lived OIDC credentials rather than repository secrets.

## Registry and runtime matrix

| Implementation | Registry | Package        | Runtime / consumer role                                                        | Release state                                                                         |
| -------------- | -------- | -------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| TypeScript     | npm      | `@gapwise/sdk` | Node.js, Bun, browser bundlers, npm-compatible tooling                                | `0.1.0` published                                                                     |
| TypeScript     | JSR      | `@gapwise/sdk` | Deno-first/portable TypeScript distribution plus Node/Bun-compatible JSR consumption | package reserved and GitHub-linked; publication is complete only after the JSR job succeeds |
| Python         | PyPI     | `gapwise`      | Python sync + async clients                                                            | `0.1.0` published                                                                     |

Do not describe JSR as having a released version until the registry confirms that version exists. A reserved package and linked OIDC publisher are configuration facts, not a published release.

## npm Trusted Publishing

`@gapwise/sdk@0.1.0` has already been published to npm. The one-time initial-package bootstrap is complete and must not be repeated.

The package's GitHub Actions Trusted Publisher should remain configured with:

- repository owner: `andrewmuratov`
- repository: `gapwise`
- workflow filename: `release-sdks.yml`
- allowed action: `npm publish`

The workflow uses a GitHub-hosted runner, Node 24, npm 11.6.2+, and job-scoped `id-token: write`. It intentionally does not inject an npm publish token. Future npm releases should use OIDC Trusted Publishing rather than recreating a bootstrap credential.

Prefer npm's strongest publishing-access setting that keeps OIDC enabled while disallowing traditional automation tokens.

## JSR OIDC publishing

The JSR package identity is also `@gapwise/sdk`. It is linked on JSR to `andrewmuratov/gapwise`, so GitHub Actions can publish with OIDC and provenance without a long-lived JSR token.

JSR configuration lives in `sdk/javascript/jsr.json` and exports the TypeScript source entry point directly from `src/index.ts`. The JSR package intentionally reuses the same implementation as npm.

Before every JSR release, the verification job must:

1. run the existing Bun build/test/package checks;
2. prove the npm artifact still clean-installs in Node;
3. run `jsr publish --dry-run` to validate the JSR module graph and package contents;
4. run Deno type/runtime checks against the TypeScript source;
5. keep JavaScript/TypeScript public types aligned with Python and OpenAPI through the repository contract checks.

No JSR token belongs in GitHub secrets. The JSR publish job receives only `contents: read` and `id-token: write`.

## PyPI Trusted Publishing

`gapwise==0.1.0` has been published to PyPI through GitHub Actions Trusted Publishing. The pending publisher successfully created the project and became the trusted publisher for future releases.

The publisher configuration should remain:

- PyPI project name: `gapwise`
- repository owner: `andrewmuratov`
- repository: `gapwise`
- workflow filename: `release-sdks.yml`
- environment name: blank

No PyPI API token belongs in GitHub secrets. Future releases should continue using OIDC Trusted Publishing.

## Automated Python releases

The Python package version is defined in `sdk/python/pyproject.toml`.

To release a version:

1. Update `project.version` in `sdk/python/pyproject.toml` and make corresponding changelog/docs updates.
2. Confirm that the TypeScript and Python clients still expose the same intended public API contract.
3. Merge the release commit to `main` and confirm CI is green.
4. Tag that exact `main` commit as `python-v<version>` (for example `python-v0.1.1`) and push the tag.
5. GitHub Actions runs the full SDK verification suite.
6. The workflow checks that the tag version exactly matches the Python package version.
7. Only after verification succeeds, the PyPI job requests a short-lived OIDC credential and publishes the built distributions.

A mismatched tag fails before publishing. Reusing an already-published version will also be rejected by PyPI, so every release requires a new version.

The manual **Actions → Release SDKs → pypi** path remains available from `main` for recovery, but normal Python releases should use version tags.

## Release procedure

### Python releases

1. Update `sdk/python/pyproject.toml` to the intended new version.
2. Confirm contract parity with `sdk/javascript` and the OpenAPI v1 contract.
3. Confirm `main` is green and `https://api.gapwise.ca/v1` is healthy.
4. Create and push `python-v<version>` from the matching `main` commit.
5. Inspect **Actions → Release SDKs** and wait for verification and publishing to complete.
6. Verify the PyPI project page and install the exact version into a clean environment.
7. Exercise at least one real API call through the installed SDK before considering the release complete.

### JavaScript / TypeScript releases

1. Update `sdk/javascript/package.json` and `sdk/javascript/jsr.json` to the same intended version.
2. Confirm the TypeScript and Python public surfaces remain semantically aligned with OpenAPI v1.
3. Confirm `main` is green.
4. Open **Actions → Release SDKs** and choose:
   - `npm` for npm only;
   - `jsr` for JSR only;
   - `javascript` for both TypeScript registries;
   - `all` only when intentionally publishing npm, JSR, and PyPI together.
5. Wait for the shared verification job before any publish job can run.
6. Verify each selected registry independently before updating public release claims.
7. For JSR, confirm the generated docs and runtime compatibility information on the package page before calling the version released.

`both` is retained as the legacy npm + PyPI recovery target. Prefer the explicit targets above for new release work.

## Ecosystem synchronization

A registry release is not complete merely because a package upload succeeds. After a new SDK release:

- `gapwise` updates the canonical developer platform/release state;
- `gapwise-docs` updates installation and runtime guidance;
- `gapwise-data` updates developer examples only when the released API/SDK contract changes;
- `gapwise-mobile` consumes the same canonical platform semantics without forking SDK behavior;
- `gapwise-ai` keeps public campus SDKs distinct from the private OAuth/MCP boundary;
- `gapwise-status` treats registry availability as release metadata, not as a substitute for live API/service monitoring.

All six repositories should link back to the canonical SDK source and documentation rather than reproducing an independent contract.

## Security properties

- No long-lived npm, JSR, or PyPI publish token is stored in the repository.
- Publish jobs receive `id-token: write` only when publishing.
- Python tag releases validate that the Git tag and package metadata carry the same version before publishing.
- The publish jobs depend on the complete SDK verification job, including tests, linting, artifact inspection, clean-environment installation, JSR dry-run validation, Deno portability checks, and package metadata checks.
- External GitHub Actions should be pinned to immutable commit SHAs before this release workflow reaches `main`.
- JavaScript publishing remains deliberate and manual; Python publishing is deliberate through signed/reviewable release tagging rather than on every push to `main`.
- Do not recreate or introduce bootstrap credentials after Trusted Publishing/OIDC is configured.
