<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Codex commit attribution

When Codex substantially authors a Git commit in this repository:

- Keep the repository's configured human Git author as the primary author.
- Add exactly: `Co-authored-by: Codex <noreply@openai.com>`.
- Place one blank line before the trailer.
- Do not replace the human author or invent another Codex identity.
- Preserve other legitimate co-author trailers.

# AGENTS.md

## Project

Gapwise for UTM is a privacy-first web application for University of Toronto Mississauga students, served from `https://gapwise.ca`.

The current product:

- parses ACORN `.ics` timetable exports locally in the browser;
- provides Today, Timetable, Gap Plan, and Day Route/campus-explorer surfaces;
- supports mobile-first timetable and route flows;
- uses canonical source-backed UTM building geometry and conservative route confidence;
- supports opt-in foreground live location without background tracking;
- supports Microsoft, Google, and GitHub OAuth through Supabase Auth;
- supports optional **browser-encrypted** private-data sync and privacy-preserving friend overlap;
- never uploads the original `.ics` file;
- keeps guest mode first-class;
- deploys `main` to Vercel;
- remains compatible with Lovable-connected development.

Primary stack: React 19, TypeScript, TanStack Router/Start, Vite 8, Bun 1.3.14, Supabase, MapLibre GL 6, Tailwind CSS 4, Playwright, Vercel, and GitHub Actions.

## Product/security guardrails

Preserve these unless the task explicitly changes the product contract and receives deliberate review:

- no ACORN credential collection or automation;
- no upload of the original timetable file;
- no background location tracking;
- no raw timetable, room, friend, or precise-location analytics;
- no claim of official U of T affiliation;
- guest mode remains useful without an account;
- private cloud state is encrypted in the browser before storage;
- do not describe the system as E2EE or zero knowledge;
- unknown accessibility/route facts remain unknown rather than being promoted to verified claims;
- never fabricate building identity, entrances, indoor routes, or accessibility data;
- stay compatible with free infrastructure unless a real requirement justifies otherwise.

## Before editing

1. Inspect the current branch and working tree.
2. Fetch the latest remote state.
3. Read the relevant implementation, tests, docs, and Linear issue when one exists.
4. Understand current production behavior before changing it.
5. Prefer the smallest coherent change that satisfies the task.

Do not rewrite unrelated code, remove working behavior without reason, or fabricate test/deployment results.

## Commit, CI, and Vercel discipline

Remote pushes are **not** a debugging loop. Every pushed commit can trigger GitHub Actions, Lovable synchronization, and a Vercel preview/deployment.

- Do local/focused verification before pushing.
- Batch coherent edits into one deliberate commit/push whenever practical.
- Avoid push → wait for CI → fix formatting → push → repeat workflows.
- If CI fails for a flaky/environmental reason, rerun the failed job/run when possible rather than creating a no-op commit.
- Use short-lived branches and focused PRs.
- Squash-merge focused PRs to `main` unless there is a specific reason not to.
- Do not create extra commits merely to trigger Vercel or CI.
- During an explicit release/freeze period, do not create a branch, preview, or deployment unless the task justifies it.

## Verification

Choose checks proportionate to the change, but never skip a required repository gate.

Typical application checks:

```bash
bun run typecheck
bun run lint
bun test
bun run build
bun run format:check
```

Run `bun run test:e2e` for user-facing browser behavior or release validation. Run the isolated Supabase/database-security suite for database, RLS, auth, or server-function changes.

Documentation-only changes should still pass formatting/link sanity, but do not invent unnecessary source edits merely to make every heavy test suite relevant.

## Commit quality

Use concise outcome-oriented Conventional Commit subjects such as:

- `fix: keep entrance markers anchored`
- `docs: sync current product and release guidance`
- `test: cover cross-user private-data isolation`

Do not use vague subjects such as `Changes` or `Fix stuff`. Keep published history intact.
