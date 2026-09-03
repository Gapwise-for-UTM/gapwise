# SDK release runbook

Gapwise ships two public SDKs from this repository:

- JavaScript/TypeScript: `@gapwise/sdk` from `sdk/javascript`
- Python: `gapwise` from `sdk/python`

The release workflow is `.github/workflows/release-sdks.yml`. JavaScript publishing remains manually dispatched. Python publishing is automated from `python-v*` Git tags and can also be manually dispatched as a recovery path. Both registries use short-lived OIDC credentials rather than repository secrets.

## npm Trusted Publishing

`@gapwise/sdk@0.1.0` has already been published to npm. The one-time initial-package bootstrap is complete and must not be repeated.

The package's GitHub Actions Trusted Publisher should remain configured with:

- repository owner: `andrewmuratov`
- repository: `gapwise`
- workflow filename: `release-sdks.yml`
- allowed action: `npm publish`

The workflow uses a GitHub-hosted runner, Node 24, npm 11.6.2+, and job-scoped `id-token: write`. It intentionally does not inject an npm publish token. Future npm releases should use OIDC Trusted Publishing rather than recreating a bootstrap credential.

Prefer npm's strongest publishing-access setting that keeps OIDC enabled while disallowing traditional automation tokens.

## PyPI Trusted Publishing

PyPI supports creating a new project through a pending Trusted Publisher, so no bootstrap API token is needed for the first `gapwise` release.

Before the first Python publish, add a pending GitHub Actions publisher in PyPI with:

- PyPI project name: `gapwise`
- repository owner: `andrewmuratov`
- repository: `gapwise`
- workflow filename: `release-sdks.yml`
- environment name: leave blank

No PyPI API token belongs in GitHub secrets. The pending publisher creates the project on the first successful trusted publish if the name is still available at publish time.

## Automated Python releases

The Python package version is defined in `sdk/python/pyproject.toml`.

To release a version:

1. Update `project.version` in `sdk/python/pyproject.toml` and make any corresponding changelog/docs updates.
2. Merge the release commit to `main` and confirm CI is green.
3. Tag that exact `main` commit as `python-v<version>` (for example `python-v0.1.0`) and push the tag.
4. GitHub Actions runs the full SDK verification suite.
5. The workflow checks that the tag version exactly matches the Python package version.
6. Only after verification succeeds, the PyPI job requests a short-lived OIDC credential and publishes the built distributions.

A mismatched tag fails before publishing. Reusing an already-published version will also be rejected by PyPI, so every release requires a new version.

The manual **Actions → Release SDKs → pypi** path remains available from `main` for recovery or the initial release if desired, but normal Python releases should use version tags.

## Release procedure

### First Python release

1. Configure the pending PyPI Trusted Publisher described above.
2. Confirm `sdk/python/pyproject.toml` contains the intended first version.
3. Confirm `main` is green and `https://api.gapwise.ca/v1` is healthy.
4. Create and push `python-v<version>` from the matching `main` commit.
5. Inspect **Actions → Release SDKs** and wait for verification and publishing to complete.
6. Verify the PyPI project page and install the package into a clean environment with `python -m pip install gapwise`.
7. Update public developer documentation that still says the Python package is unpublished.

### JavaScript releases

1. Confirm the JavaScript package version is new and intended.
2. Open **Actions → Release SDKs**, select `main`, and run target `npm` (or `both` when deliberately publishing both registries).
3. Inspect verification and publishing before updating public docs.

## Security properties

- No long-lived npm or PyPI publish token is stored in the repository.
- Publish jobs receive `id-token: write` only when publishing.
- Python tag releases validate that the Git tag and package metadata carry the same version before publishing.
- The publish job depends on the complete SDK verification job, including tests, linting, artifact inspection, clean-environment installation, and package metadata checks.
- External GitHub Actions are pinned to immutable commit SHAs.
- JavaScript publishing remains deliberate and manual; Python publishing is deliberate through signed/reviewable release tagging rather than on every push to `main`.
- Do not recreate or introduce bootstrap credentials after Trusted Publishing is configured.
