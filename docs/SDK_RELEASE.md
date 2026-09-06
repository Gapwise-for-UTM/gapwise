# SDK release runbook

Gapwise ships two equal first-party SDK implementations from this repository:

- JavaScript/TypeScript: `@gapwise/sdk` from `sdk/javascript`
- Python: `gapwise` from `sdk/python`

The JavaScript/TypeScript implementation is distributed through npm and JSR, with a source-adjacent GitHub Packages npm mirror, rather than being forked into separate Node, Deno, or Bun SDKs. The Python implementation is distributed canonically through PyPI and mirrored as tagged wheel/source artifacts on GitHub Releases. GitHub Packages does not provide a PyPI-compatible Python registry. All releases consume the same public API v1 contract and must preserve semantic parity.

The release workflow is `.github/workflows/release-sdks.yml`. npm publishing is manually dispatched. JSR publishing runs automatically when the JSR version configuration changes on `main` and is also available by manual dispatch for recovery. Python publishing is automated from `python-v*` Git tags and can also be manually dispatched as a recovery path. npm, JSR, and PyPI publishing use short-lived OIDC credentials rather than repository secrets. GitHub Release assets use only the job-scoped GitHub token with `contents: write`.

## Registry and runtime matrix

<!-- prettier-ignore -->
| Implementation | Distribution | Package / artifact | Runtime / consumer role | Release state |
| -------------- | ------------ | ------------------ | ----------------------- | ------------- |
| TypeScript | npm | `@gapwise/sdk` | Primary Node.js, Bun, browser-bundler, and npm-compatible distribution | `0.1.1` published |
| TypeScript | JSR | `@gapwise/sdk` | Deno-first/portable TypeScript distribution plus Node/Bun-compatible JSR consumption | `0.1.1` published |
| TypeScript | GitHub Packages | `@gapwise-for-utm/sdk` | Source-adjacent GitHub npm registry mirror of the same JavaScript SDK artifact | `0.1.1` published, public |
| Python | PyPI | `gapwise` | Canonical Python sync + async package index distribution | `0.1.0` published |
| Python | GitHub Releases | `gapwise-<version>-py3-none-any.whl` + source distribution | Source-adjacent mirror of the exact tagged Python release artifacts | automated from `python-v*` tags |

The initial TypeScript `0.1.0` publication established the npm/JSR package identities and trusted-publishing paths. The current verified TypeScript release is `@gapwise/sdk@0.1.1` on both npm and JSR. Future registry claims remain evidence-based: update release-state documentation only after the relevant publish job and registry confirm the version.

GitHub Packages requires the npm scope to match the GitHub organization owner, so its public mirror is named `@gapwise-for-utm/sdk` rather than `@gapwise/sdk`. This is a registry-specific package identity for the same built implementation, not a fork or a fourth SDK. npm remains the primary npm-compatible installation channel; consumers choosing GitHub Packages must configure `@gapwise-for-utm` for `https://npm.pkg.github.com` and follow GitHub's registry-authentication requirements.

## GitHub Packages publishing

The `github` manual target publishes the verified JavaScript SDK to GitHub Packages. The job rewrites the package name only inside its ephemeral runner workspace, retains the source-repository metadata, checks whether the exact version already exists, and publishes with the job-scoped `GITHUB_TOKEN` and `packages: write`. No long-lived GitHub package token is stored.

GitHub Packages does **not** expose a Python/PyPI registry. Do not publish a fake npm package, container image, or unrelated artifact merely to make Python appear as a second item on the organization Packages tab.

## Python GitHub Release mirror

Each tagged Python SDK release is also mirrored on GitHub Releases under the same `python-v<version>` tag. The mirror contains:

- the built universal wheel, for example `gapwise-0.1.0-py3-none-any.whl`;
- the source distribution, for example `gapwise-0.1.0.tar.gz`;
- `SHA256SUMS.txt` covering both artifacts.

The GitHub Release mirror is supplemental. `python -m pip install gapwise==<version>` from PyPI remains the canonical installation path.

The release job is intentionally tag-bound and idempotent:

1. It resolves the package version from the tagged `sdk/python/pyproject.toml`.
2. Backfill runs from `main` check for an already-existing matching `python-v<version>` tag and then detach to that exact tag before building.
3. It builds and validates the wheel and source distribution from the tagged commit.
4. It creates or repairs the matching GitHub Release assets without changing the tag.
5. It marks the Python SDK release as not-latest so the main Gapwise application release remains the repository's Latest release.

The manual `python-github` target can repair/backfill the GitHub Release mirror for the currently tagged Python version without publishing to PyPI again.

## npm Trusted Publishing

`@gapwise/sdk@0.1.1` is currently published to npm. The one-time initial-package bootstrap completed with the 0.1.0 release and must not be repeated.

The package's GitHub Actions Trusted Publisher should be configured with the current canonical repository identity:

- repository owner: `Gapwise-for-UTM`
- repository: `gapwise`
- workflow filename: `release-sdks.yml`
- allowed action: `npm publish`

The workflow uses a GitHub-hosted runner, Node 24, npm 11.6.2+, and job-scoped `id-token: write`. It intentionally does not inject an npm publish token. Future npm releases should use OIDC Trusted Publishing rather than recreating a bootstrap credential.

Prefer npm's strongest publishing-access setting that keeps OIDC enabled while disallowing traditional automation tokens.

## JSR OIDC publishing

The JSR package identity is also `@gapwise/sdk`. The package should be linked on JSR to the current canonical repository, `Gapwise-for-UTM/gapwise`, so GitHub Actions can publish with OIDC and provenance without a long-lived JSR token.

JSR configuration lives in `sdk/javascript/jsr.json` and exports the TypeScript source entry point directly from `src/index.ts`. The JSR package intentionally reuses the same implementation and version line as npm.

Before every JSR release, the verification job must:

1. run the existing Bun build/test/package checks;
2. prove the npm artifact still clean-installs in Node;
3. run `jsr publish --dry-run` to validate the JSR module graph and package contents;
4. run Deno type/runtime checks against the TypeScript source;
5. keep JavaScript/TypeScript public types aligned with Python and OpenAPI through the repository contract checks.

No JSR token belongs in GitHub secrets. The JSR publish job receives only `contents: read` and `id-token: write`.

## PyPI Trusted Publishing

`gapwise==0.1.0` has been published to PyPI through GitHub Actions Trusted Publishing. The pending publisher successfully created the project and became the trusted publisher for future releases.

The publisher should be configured with the current canonical repository identity:

- PyPI project name: `gapwise`
- repository owner: `Gapwise-for-UTM`
- repository: `gapwise`
- workflow filename: `release-sdks.yml`
- environment name: blank

No PyPI API token belongs in GitHub secrets. Future releases should continue using OIDC Trusted Publishing.

## Post-transfer provider verification

The repository moved from the personal `andrewmuratov/gapwise` namespace to `Gapwise-for-UTM/gapwise`. GitHub repository redirects are useful for ordinary web and Git traffic, but they are not a substitute for verifying the repository identity expected by third-party OIDC/trusted-publisher providers.

Before the next npm, JSR, or PyPI publication:

1. Open the provider-side trusted-publisher or GitHub-link configuration.
2. Confirm it names `Gapwise-for-UTM/gapwise` and `.github/workflows/release-sdks.yml` where the provider exposes those fields.
3. If the provider still shows `andrewmuratov/gapwise`, relink or update the trusted publisher before publishing.
4. Do not work around a stale provider link by introducing a long-lived registry token.
5. After the first post-transfer version publishes, record the successful run and exact registry version as the new evidence baseline.

The already-published `@gapwise/sdk@0.1.1` and `gapwise==0.1.0` versions prove current package availability; by themselves they do not prove that every provider-side trusted-publisher configuration has already been migrated for the next version.

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
8. The GitHub Release mirror job builds from the same tag and publishes the wheel, source distribution, and SHA-256 checksums as release assets.

A mismatched tag fails before publishing. Reusing an already-published version will also be rejected by PyPI, so every release requires a new version.

The manual **Actions → Release SDKs → pypi** path remains available from `main` for PyPI recovery. **Actions → Release SDKs → python-github** repairs only the GitHub Release artifact mirror. Normal Python releases should use version tags so both surfaces derive from one reviewed commit.

## Release procedure

### Python releases

1. Update `sdk/python/pyproject.toml` to the intended new version.
2. Confirm contract parity with `sdk/javascript` and the OpenAPI v1 contract.
3. Confirm `main` is green and `https://api.gapwise.ca/v1` is healthy.
4. Create and push `python-v<version>` from the matching `main` commit.
5. Inspect **Actions → Release SDKs** and wait for verification, PyPI publishing, and GitHub Release mirroring to complete.
6. Verify the PyPI project page and install the exact version into a clean environment.
7. Verify that the matching GitHub Release exposes the wheel, source distribution, and `SHA256SUMS.txt` built from the same tag.
8. Exercise at least one real API call through the installed SDK before considering the release complete.

### JavaScript / TypeScript releases

1. Update `sdk/javascript/package.json` and `sdk/javascript/jsr.json` to the same intended version.
2. Confirm the TypeScript and Python public surfaces remain semantically aligned with OpenAPI v1.
3. Merge the version change to `main` only after CI is green.
4. The `jsr.json` change triggers the JSR release path automatically. For npm, open **Actions → Release SDKs** and choose `npm`; use `javascript` only when intentionally publishing both TypeScript registries from a recovery/manual run.
5. Wait for the shared verification job before any publish job can run.
6. Verify each selected registry independently before updating public release claims.
7. Confirm JSR generated docs/runtime compatibility and npm package metadata for the exact version before considering the release synchronized.

Manual targets `jsr`, `javascript`, `python-github`, and `all` remain available for recovery or deliberately coordinated releases. `both` is retained as the legacy npm + PyPI recovery target.

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

- No long-lived npm, JSR, PyPI, or GitHub release credential is stored in the repository.
- Registry publish jobs receive `id-token: write` only when publishing to OIDC-capable registries.
- The Python GitHub Release mirror receives only job-scoped `contents: write`, builds from the immutable release tag, and publishes checksums alongside the distributions.
- Python tag releases validate that the Git tag and package metadata carry the same version before publishing.
- The publish jobs depend on the complete SDK verification job, including tests, linting, artifact inspection, clean-environment installation, JSR dry-run validation, Deno portability checks, and package metadata checks.
- External GitHub Actions are pinned to immutable commit SHAs.
- npm publishing remains deliberate/manual; JSR publishing is version-config-driven on `main`; Python publishing is deliberate through reviewable release tagging.
- Do not recreate or introduce bootstrap credentials after Trusted Publishing/OIDC is configured.
