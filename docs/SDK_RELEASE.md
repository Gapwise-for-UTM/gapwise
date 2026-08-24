# SDK release runbook

Gapwise ships two public SDKs from this repository:

- JavaScript/TypeScript: `@gapwise/sdk` from `sdk/javascript`
- Python: `gapwise` from `sdk/python`

The release workflow is `.github/workflows/release-sdks.yml`. It is intentionally manual and uses short-lived OIDC credentials rather than repository secrets.

## One-time npm setup

Before the first JavaScript publish, confirm that the npm account or organization that owns the `@gapwise` scope is under Gapwise control. Scoped packages can only be published by the user or organization that owns the scope.

In npm package settings, configure a GitHub Actions Trusted Publisher with:

- repository owner: `andrewmuratov`
- repository: `gapwise`
- workflow filename: `release-sdks.yml`
- allowed action: `npm publish`

The workflow uses Node 24 and npm 11.6.2 so npm can exchange the GitHub OIDC identity without a long-lived npm token.

## One-time PyPI setup

For the first `gapwise` release, add a pending GitHub Actions publisher in PyPI with:

- PyPI project name: `gapwise`
- repository owner: `andrewmuratov`
- repository: `gapwise`
- workflow filename: `release-sdks.yml`

No PyPI API token belongs in GitHub secrets. The pending publisher creates the project on the first successful trusted publish if the name is still available.

## Release procedure

1. Confirm `main` is green and `https://api.gapwise.ca/v1` is healthy.
2. Confirm the SDK package versions are the intended release versions.
3. Run **Release SDKs** with target `verify`.
4. Inspect the verification run.
5. Run the workflow again with target `npm`, `pypi`, or `both` only after the corresponding trusted publisher is configured.
6. Verify the registry package pages and install each package into a clean environment.
7. Update developer documentation and the changelog for the published version.

## Security properties

- No long-lived npm or PyPI publish token is stored in the repository.
- Publish jobs receive `id-token: write` only when a publish target is selected.
- External GitHub Actions are pinned to immutable commit SHAs.
- Publishing remains a deliberate manual action rather than occurring on every push to `main`.
