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

# AGENTS.md

## Project

This repository contains Gapwise UTM, a privacy-first web application for University of Toronto Mississauga students.

The app:

- parses ACORN `.ics` timetable exports locally in the browser
- displays Fall and Winter weekly timetables
- detects usable gaps between classes
- provides route-aware gap planning
- supports optional GitHub authentication through Supabase
- supports explicit, opt-in cloud storage of normalized timetable data
- never uploads the original `.ics` file
- is deployed through Vercel
- remains compatible with Lovable-connected development

Primary stack:

- React 19
- TypeScript
- Vite
- TanStack Router
- Bun
- Supabase
- MapLibre GL JS
- Vercel
- GitHub Actions

## General agent behavior

Before editing:

1. inspect the current branch
2. inspect `git status`
3. fetch the latest remote state
4. read relevant implementation files and tests
5. understand existing behavior before changing it

Prefer focused, minimal changes.

Do not rewrite unrelated code merely to make it look cleaner.

Do not remove working behavior unless the task explicitly requires it.

Do not fabricate test results, screenshots, performance measurements, deployment results, or manual verification.

Clearly report anything that could not be verified.

## GitHub CLI

GitHub CLI (`gh`) is installed and authenticated for this repository.

Always verify access with:

```bash
gh auth status
```

## Agent attribution and co-authorship

Agents may add a `Co-authored-by` trailer to commits when the agent made a
substantive contribution to the committed code, tests, documentation, or
technical design.

Use a valid Git trailer at the end of the commit message:
