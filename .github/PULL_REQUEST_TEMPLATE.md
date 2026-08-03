## Linear

- Issue: AND-___
- Closing reference: `Fixes AND-___` or `Relates to AND-___`

## Summary

Describe what changed and why.

## Verification

- [ ] `bun install --frozen-lockfile`
- [ ] `bun run lint`
- [ ] `bun test`
- [ ] `bun run build`
- [ ] `bunx prettier --check .`
- [ ] `git diff --check`
- [ ] Relevant desktop and mobile behavior tested

## Security and privacy

- [ ] No secrets, tokens, credentials, real timetable data, or private floor plans are included
- [ ] Authorization, authentication, file parsing, and deletion implications were considered
- [ ] Database changes preserve Row Level Security and are represented by versioned migrations
- [ ] Analytics and logs do not receive timetable contents or authentication tokens

## Deployment and integrations

- [ ] Vercel preview was checked when application behavior changed
- [ ] Supabase changes were verified against the intended project
- [ ] Lovable synchronization remains safe; no published history was rewritten
- [ ] Documentation reflects any user-visible or operational change

## Evidence

Add screenshots, measurements, test output, or deployment links when useful. Redact personal information before attaching evidence.
