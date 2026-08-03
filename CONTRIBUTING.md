# Contributing to Gapwise for UTM

Gapwise for UTM is an independent student project. Contributions should preserve its local-first privacy model, free-tier operating model, accessibility, and honest route-confidence labels.

## Before starting

1. Search existing GitHub issues and pull requests.
2. For public community reports, open the appropriate GitHub issue form.
3. Security vulnerabilities must be reported privately through the repository security policy.
4. Maintainer-planned implementation work is tracked in the **Gapwise for UTM** Linear project.

GitHub is the public engineering record. Linear is the maintainer's planning system. A GitHub issue may be converted into or linked from a Linear issue after triage; contributors do not need Linear access to report a problem.

## Development workflow

For maintainer work, create or select a Linear issue before coding and use its identifier throughout the change.

Recommended branch format:

```text
andrewamuratov/and-123-short-description
```

Acceptable equivalent branch formats include:

```text
feat/and-123-short-description
fix/and-123-short-description
```

Use Conventional Commit-style messages:

```text
feat: add passwordless email sign-in
fix: preserve local timetable during cloud failure
test: cover cross-user RLS isolation
docs: explain route-data verification
chore: update dependency automation
```

Do not use vague messages such as `Changes`, `Update`, or `Fix stuff`.

## Pull requests and Linear

Include the Linear identifier in the pull-request title or body:

```text
AND-123 Add passwordless email sign-in
```

Use one of these references in the description:

```text
Fixes AND-123
Relates to AND-123
```

`Fixes` is appropriate only when merging and deploying the pull request completes the Linear issue's acceptance criteria. Otherwise use `Relates to` and leave the issue open.

A pull request is not complete merely because code was generated. It must include relevant verification evidence and be checked in its deployed environment when behavior changes.

## Local verification

Install and verify with the repository's locked Bun workflow:

```bash
bun install --frozen-lockfile
bun run lint
bun test
bun run build
bunx prettier --check .
git diff --check
```

Run additional browser, accessibility, database, or security checks required by the change.

## Privacy and security rules

Never commit or attach:

- passwords, access tokens, refresh tokens, OAuth secrets, service-role keys, or database credentials;
- `.env` files or production environment values;
- real student timetable files or screenshots containing personal schedules;
- student numbers, private email addresses, or authentication links;
- restricted UTM documents, private floor plans, or unofficially obtained data.

Use synthetic or redacted timetable data in tests and issue evidence.

All user-owned Supabase tables must retain Row Level Security. Database changes must use versioned migrations, preserve ownership checks, and avoid destructive production operations without explicit approval.

The original uploaded `.ics` file must remain browser-local unless the product's privacy model is deliberately changed and reviewed.

## Product constraints

Contributions should preserve:

- useful guest mode without an account;
- explicit, optional cloud synchronization;
- compatibility with free Vercel and Supabase plans where practical;
- accessible keyboard, screen-reader, mobile, and reduced-motion behavior;
- clear distinction between verified, approximate, and unavailable routes;
- the statement that Gapwise for UTM is not affiliated with or endorsed by the University of Toronto.

Do not add ACORN scraping, automated enrolment, credential collection, official U of T/UTM branding, background location tracking, paid infrastructure, or a new analytics provider without prior discussion.

## Lovable and generated changes

The repository is connected to Lovable. Do not rewrite published history, force-push, rebase shared branches, or amend commits that already synchronized with Lovable.

Follow `AGENTS.md`, especially the managed Lovable block. Do not edit content inside:

```html
<!-- LOVABLE:BEGIN -->
...
<!-- LOVABLE:END -->
```

Avoid simultaneous Lovable and local/Codex edits to the same branch. Let one source finish, pull the resulting commits, review the diff, and run the full verification suite before continuing.

## AI attribution

Human authorship remains primary. When an AI tool substantially authors a commit, disclose it accurately using the project's established co-author convention. Do not add AI attribution to a genuinely human-authored change merely because an AI explained the steps.

## Review expectations

Reviewers should verify:

- the issue and acceptance criteria are clear;
- the change is focused and reversible;
- tests cover realistic failures rather than only happy paths;
- no secret or personal information is exposed;
- user isolation, deletion, and authentication remain correct;
- performance claims are supported by measurements;
- documentation matches deployed behavior;
- CI passes and relevant preview/production behavior was checked.
