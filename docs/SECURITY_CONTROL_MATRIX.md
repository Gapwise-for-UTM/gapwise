# Security control matrix

This is a living map from common web/AI application failure modes to Gapwise's concrete controls. It is not a claim that the service is unhackable. Controls are expected to fail closed, be testable where possible, and be backed by platform configuration where source code alone cannot enforce them.

Status meanings:

- **Enforced** — a source, database, or CI control exists and is regression-tested or otherwise mechanically enforced.
- **Operational** — the control depends on production platform configuration or an operator procedure and must be re-verified periodically.
- **Review required** — the control is present in part but still has a production/platform item that cannot be proven from this repository alone.

### 37. Vulnerable dependencies — Enforced

Frozen Bun lockfile, weekly Dependabot, a pinned package-manager version, and CI `bun audit --prod --audit-level=high` protect the dependency path. Keep the audit gate green before merge and release.

### 38. Malicious packages — Enforced

Bun's dependency release-age quarantine is 72 hours, lockfile installs are frozen, GitHub Actions are pinned to immutable SHAs, and package exceptions require deliberate review. Treat every new dependency, source, or lifecycle-script exception as a security change.

### 39. Prompt injection — Enforced across the AI boundary

Gapwise AI labels delegated timetable, personal, location, and preference values as data rather than instructions. AI writes remain typed, permissioned, revision-bound actions. Keep the data/instruction-boundary tests green when tool output changes.

### 40. Unpermissioned AI access — Enforced

AI access is explicitly delegated. Private reads require a valid user token, MCP additionally requires a client identity, and read/write capabilities are permission-gated and revocable. Exercise grant and revocation with a disposable account before AI releases.

### 41. Excessive DB permissions — Enforced

Browser and server clients are caller-scoped, RLS and restrictive grants are database-tested, and Vercel private-cloud functions do not receive a Supabase service-role credential. Review Supabase Security Advisor after migrations and justify every intentionally exposed `SECURITY DEFINER` RPC.

### 42. Missing audit logs — Review required

Operational policy forbids sensitive payload logging, and Gapwise AI's intended audit posture is metadata-only (`who/when/which tool`). Verify the deployed metadata audit path and retention before treating this as fully operational. Never log timetable content, decrypted private data, prompts, tokens, or keys.

### 43. No security monitoring — Operational

Vercel runtime errors and function status plus Supabase Security and Performance Advisors are part of the production runbook. Review them after deployments and migrations, and investigate unexpected auth, database, or function error rates without adding sensitive payload logging.

### 44. No backups/restore — Operational

KEK recovery/rotation and database restore procedures are documented. Private data has local-first recovery behavior and encrypted cloud restore checks. Periodically verify the actual Supabase backup/recovery entitlement and configuration, test a safe recovery procedure, and keep offline recovery copies of active KEKs.

### 45. Exposed internal dashboards — Enforced by architecture/platform access

No application-admin dashboard is part of the public Gapwise route surface. Operational consoles remain Vercel, Supabase, and GitHub account surfaces rather than app routes. Do not add debug, admin, or metrics routes to production without authentication, authorization, and an explicit threat review.

### 46. Missing security headers — Enforced

Repository deployment config sets CSP, HSTS, frame denial, MIME sniffing protection, referrer policy, and permissions policy. Tests fail on security-header regressions. Verify production response headers after deploys.

### 47. Insecure cookie settings — Enforced by avoiding app-owned auth cookies

Current Gapwise web/AI source does not implement application-owned `Set-Cookie` auth/session handling, and browser AI calls use bearer tokens with `credentials: omit`. If app-owned cookies are introduced, require `Secure`, `HttpOnly`, appropriate `SameSite`, narrow domain/path, and CSRF review before merge.

### 48. Unencrypted data — Enforced

Private cloud is encrypted-only, plaintext schedule/preference tables were retired, the original ICS file is not uploaded, and server-held KEKs are separated from database ciphertext. Do not introduce plaintext cloud fallback or put KEKs/DEKs in browser-exposed variables or logs.

### 49. Poor tenant isolation — Enforced

User identity comes from verified tokens, owner-scoped RLS is database-tested, cross-user isolation is included in the private-cloud security proof, and AI state is caller-scoped. Keep cross-user, relationship, and RLS tests in the required CI gate.

### 50. Unreviewed code — Partially enforced

GitHub's active `Protect main` repository ruleset requires pull requests, blocks non-fast-forward updates and deletion, and strictly requires the `verify` and `database-security` status checks on the default branch with no bypass actors. CODEOWNERS declares repository ownership and the PR checklist requires a security review. The ruleset currently requires zero approving reviews and does not require code-owner approval or review-thread resolution, so human/agent review remains a release-process requirement rather than a GitHub-enforced merge prerequisite.

### 51. Mass assignment — Enforced

Server bodies use exact-key allowlists and explicit persistence payloads. AI actions use strict schemas and exact keys. A regression test prevents bypass through direct unbounded `Request.json()` in server runtimes. Keep new mutation endpoints on bounded parsers and allowlisted fields.

### 52. Command injection — Enforced by removing the primitive

Production server runtimes do not need shell/process execution. Regression tests reject `child_process`, Bun/Deno process spawning, VM execution, `eval`, and `new Function`. Any future need for process execution requires a dedicated security design rather than weakening the guard globally.

### 53. Insecure deserialization — Enforced

Private-cloud JSON is byte-bounded, fatal-UTF-8 decoded, parsed as data, and exact-shape validated. AI/MCP inputs use strict schemas and bounded fields. Do not deserialize executable or object-graph formats from untrusted input.

### 54. Misconfigured OAuth — Enforced + operational

Production origins are exact, the AI base URL is canonical and HTTPS, client identity is required for MCP, revocation removes the DB allowlist before best-effort OAuth grant revocation, and redirect/origin allowlists are part of the runbook. Keep Supabase Site URL and redirect allowlists exact and test real-client OAuth grant/revocation before releases.

## Platform findings to keep visible

As of 2026-08-28, production verification found these platform-level items that source code cannot close by itself:

1. Supabase Auth leaked-password protection is disabled and should be enabled in the production project.
2. GitHub default-branch required status checks are verified active: the repository ruleset strictly requires `verify` and `database-security`, requires PRs, prevents deletion/non-fast-forward updates, and has no bypass actors. Approving reviews, code-owner review, and review-thread resolution are not currently required by the ruleset; strengthen those account-level settings if repository-enforced human review is desired.

Supabase also reports that several friendship/key-rotation `SECURITY DEFINER` RPCs are callable by the `authenticated` role. This exposure is intentional: the current implementations derive the caller from `auth.uid()`, reject non-direct/OAuth sessions through `private.is_direct_user_session()`, scope friendship operations to the caller, validate bounded arguments/key material, and keep OAuth isolation under database tests. Treat future advisor warnings as review triggers anyway; do not blanket-suppress them or broaden the grants casually.

## Release rule

A stable release is blocked by any known high-severity dependency advisory, a failing database-security gate, an unexplained cross-tenant authorization regression, or an unreviewed change that expands secrets, OAuth, AI write permissions, command execution, deserialization, or public administrative surfaces.
