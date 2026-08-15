# Contributing to Gapwise for UTM

Gapwise for UTM is an independent student project. Contributions should preserve its local-first privacy model, accessibility, honest campus-data confidence, and sustainable free-tier operating model.

## Before starting

1. Search existing GitHub issues and pull requests.
2. Use the repository issue forms for public bug/feature reports.
3. Report security vulnerabilities privately through the repository security policy.
4. Maintainer-planned implementation work is tracked in the **Gapwise for UTM** Linear project.

GitHub is the public engineering record. Linear is the maintainer's planning/execution system; contributors do not need Linear access to report a problem.

## Development workflow

For maintainer work, select or create the relevant Linear issue before coding when practical and keep the change focused on its acceptance criteria.

Recommended branch formats:

```text
andrewamuratov/and-123-short-description
feat/and-123-short-description
fix/and-123-short-description
```

Use concise Conventional Commit-style subjects such as:

```text
feat: add a focused student workflow
fix: preserve private state during cloud failure
test: cover cross-user RLS isolation
docs: explain route-data verification
chore: update dependency automation
```

## Pull requests and Linear

Include the Linear identifier in the PR title/body when the change belongs to a Linear issue, for example `AND-123 ...`.

Use `Fixes AND-123` only when merge/deployment completes the issue's acceptance criteria. Otherwise use `Relates to AND-123` and keep the issue open.

A PR is not complete merely because code was generated. Relevant verification evidence and deployed-environment checks are required when behavior changes.

## Local verification

Install with the locked Bun workflow:

```bash
bun install --frozen-lockfile
bun run typecheck
bun run lint
bun test
bun run build
bun run format:check
git diff --check
```

Run browser, accessibility, database, security, or routing checks appropriate to the change. User-facing browser/release changes normally require `bun run test:e2e`.

## Push, CI, and preview discipline

Every push can trigger GitHub Actions, Lovable synchronization, and a Vercel preview. Treat those as validation resources, not an interactive linter.

- Finish and locally verify the coherent change before the first push whenever practical.
- Prefer one deliberate branch update over a chain of formatting/test-fix commits.
- Do not push no-op commits to retrigger checks.
- If a remote workflow fails for a flaky/environmental reason, rerun only the failed job/run when possible.
- Keep PR scope narrow and squash-merge focused PRs so `main` and production history remain readable.
- Avoid simultaneous Lovable and local/agent edits to the same branch.

This policy reduces Vercel deployment-rate pressure and avoids repeatedly paying the full CI cost for tiny corrective pushes.

## Privacy and security rules

Never commit or attach:

- passwords, tokens, OAuth secrets, service-role credentials, KEKs/DEKs, or database credentials;
- `.env` files or production environment values;
- real student timetable files or screenshots containing personal schedules;
- student numbers, private email addresses, or authentication links;
- restricted UTM documents, private floor plans, or unofficially obtained data.

Use synthetic/redacted data in tests and issue evidence.

All user-owned Supabase tables must retain Row Level Security. Database changes must use versioned migrations, preserve ownership checks, and avoid destructive production operations without explicit approval.

The original uploaded `.ics` file must remain browser-local unless the privacy model is deliberately changed and reviewed.

## Product constraints

Preserve:

- useful guest mode without an account;
- optional browser-encrypted private sync;
- Microsoft/Google/GitHub OAuth without U of T credential collection;
- compatibility with free Vercel/Supabase plans where practical;
- accessible keyboard, screen-reader, mobile, and reduced-motion behavior;
- clear distinction between verified, inferred/approximate, and unavailable campus guidance;
- the independent-project/non-affiliation statement.

Do not add ACORN scraping, automated enrolment, background location tracking, paid infrastructure, raw private analytics, or official U of T/UTM branding without deliberate product/security review.

## Campus data

Campus navigation contributions must be evidence-backed. Follow [`docs/CAMPUS_SURVEY.md`](docs/CAMPUS_SURVEY.md) and [`docs/CAMPUS_MAP_GEOMETRY.md`](docs/CAMPUS_MAP_GEOMETRY.md).

Do not promote an estimate or inferred approach to a verified entrance/route without provenance and review. Unknown accessibility is not equivalent to step-free accessibility.

## Lovable and generated changes

The repository is connected to Lovable. Do not rewrite published history, force-push, or rebase/amend commits that already synchronized with Lovable.

Follow `AGENTS.md`, especially the managed block. Do not edit content inside:

```html
<!-- LOVABLE:BEGIN -->
...
<!-- LOVABLE:END -->
```

## AI attribution

Human authorship remains primary. When an AI tool substantially authors a commit, disclose it accurately using the repository's established co-author convention. Do not add AI attribution to genuinely human-authored work merely because an AI explained the steps.

## Review expectations

Reviewers should verify that:

- the issue/acceptance criteria are clear;
- the change is focused and reversible;
- tests cover realistic failure modes;
- no secret or personal information is exposed;
- user isolation, deletion, and authentication remain correct;
- route/accessibility claims are evidence-backed;
- performance claims are measured;
- documentation matches deployed behavior;
- required CI is green and relevant preview/production behavior was checked.
