# SDK release runbook

Gapwise ships two public SDKs from this repository:

- JavaScript/TypeScript: `@gapwise/sdk` from `sdk/javascript`
- Python: `gapwise` from `sdk/python`

The release workflow is `.github/workflows/release-sdks.yml`. It is intentionally manual and uses short-lived OIDC credentials rather than repository secrets once each registry supports the package's trusted publisher. Registry publish jobs are also restricted to runs dispatched from the `main` branch.

## npm bootstrap and Trusted Publishing

First confirm that the npm account or organization that owns the `@gapwise` scope is under Gapwise control. Scoped packages can only be published by the user or organization that owns the scope.

npm Trusted Publishing is configured from an existing package's settings. If `@gapwise/sdk` has never been published before, npm currently cannot use OIDC for that initial package creation. Bootstrap version `0.1.0` once from a trusted maintainer workstation using interactive npm authentication or a narrowly scoped temporary granular token, then revoke any temporary publish token immediately after the package exists.

After the package exists, configure its GitHub Actions Trusted Publisher with:

- repository owner: `andrewmuratov`
- repository: `gapwise`
- workflow filename: `release-sdks.yml`
- allowed action: `npm publish`

The workflow uses a GitHub-hosted runner, Node 24, npm 11.6.2+, and job-scoped `id-token: write`. It intentionally does not inject an npm publish token. Subsequent releases should use OIDC Trusted Publishing.

After Trusted Publishing is verified, prefer npm's strongest publishing-access setting that keeps OIDC enabled while disallowing traditional automation tokens.

## PyPI Trusted Publishing

PyPI supports creating a new project through a pending Trusted Publisher, so no bootstrap API token is needed for the first `gapwise` release.

Before the first Python publish, add a pending GitHub Actions publisher in PyPI with:

- PyPI project name: `gapwise`
- repository owner: `andrewmuratov`
- repository: `gapwise`
- workflow filename: `release-sdks.yml`

A GitHub environment is optional. If one is introduced later for approval protection, the exact same environment name must also be added to the PyPI publisher configuration.

No PyPI API token belongs in GitHub secrets. The pending publisher creates the project on the first successful trusted publish if the name is still available at publish time.

## Release procedure

1. Confirm `main` is green and `https://api.gapwise.ca/v1` is healthy.
2. Confirm the SDK package versions are the intended release versions.
3. Open **Actions → Release SDKs**, select the `main` branch, and run target `verify`.
4. Inspect the verification run.
5. For Python, run target `pypi` after the pending/normal PyPI Trusted Publisher is configured.
6. For JavaScript, use target `npm` only after `@gapwise/sdk` already exists and its npm Trusted Publisher is configured. For the initial `0.1.0` package creation, use the one-time bootstrap procedure above instead.
7. Verify the registry package pages and install each package into a clean environment.
8. Update developer documentation and the changelog for the published version.

## Security properties

- No long-lived npm or PyPI publish token is stored in the repository.
- Publish jobs receive `id-token: write` only when a publish target is selected.
- Registry publish jobs refuse to run unless the workflow was dispatched from `main`.
- External GitHub Actions are pinned to immutable commit SHAs.
- Publishing remains a deliberate manual action rather than occurring on every push to `main`.
- Any one-time npm bootstrap credential should be narrowly scoped and revoked immediately after the initial package exists.
