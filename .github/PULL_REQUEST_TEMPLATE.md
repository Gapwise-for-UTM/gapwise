## Linear

- Issue: AND-___
- Closing reference: `Fixes AND-___` or `Relates to AND-___`

## Summary

Describe what changed and why.

## Verification

- [ ] `bun install --frozen-lockfile`
- [ ] `bun run security:audit`
- [ ] `bun run lint`
- [ ] `bun test`
- [ ] `bun run build`
- [ ] `bunx prettier --check .`
- [ ] `git diff --check`
- [ ] Relevant desktop and mobile behavior tested

## Security and privacy

- [ ] No secrets, tokens, credentials, real timetable data, or private floor plans are included
- [ ] New or updated dependencies were reviewed; there are no unexplained package sources or lifecycle-script exceptions
- [ ] Authorization, authentication, file parsing, deletion, and tenant-isolation implications were considered
- [ ] HTTP/request inputs are bounded and explicitly allowlisted; request objects are never mass-assigned into persistence
- [ ] Database changes preserve Row Level Security and are represented by versioned migrations
- [ ] AI/tool changes preserve explicit permissions and the data-versus-instructions boundary
- [ ] OAuth changes preserve exact redirect/origin rules and per-client isolation
- [ ] Analytics, audit events, and logs do not receive timetable contents, decrypted private data, keys, or authentication tokens
- [ ] Recovery, backup, and monitoring implications were considered for schema, encryption, or deployment changes

## Deployment and integrations

- [ ] Vercel preview was checked when application behavior changed
- [ ] Supabase changes were verified against the intended project
- [ ] Lovable synchronization remains safe; no published history was rewritten
- [ ] Documentation reflects any user-visible or operational change

## Evidence

Add screenshots, measurements, test output, or deployment links when useful. Redact personal information before attaching evidence.
