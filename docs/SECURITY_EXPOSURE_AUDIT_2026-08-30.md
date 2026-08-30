# Security exposure audit — 2026-08-30

This audit maps the current Gapwise implementation to the 18 common compromise paths tracked by Linear AND-175. The checklist is treated as a threat-model prompt, not as evidence that a defect exists.

Status meanings:

- **Verified protected** — current repository/runtime evidence directly addresses the failure mode.
- **Not applicable** — the named technology/path is not part of the shipped architecture.
- **External evidence required** — source code cannot prove the relevant provider/account fact.
- **Open verification** — a bounded remaining test is still required before the broader security program closes.

## Current findings

### 1. Exposed database credentials

**Status:** Verified protected in repository; external evidence required for provider/operator handling.

Production database URLs and service-role credentials are server-only configuration. `.env*` files are ignored, and the full-history exposure scan rejects credential-bearing PostgreSQL URLs and Supabase privileged-key shapes. Provider dashboards, operator devices, and third-party secret stores remain outside repository proof.

### 2. Public `.env` files

**Status:** Verified protected.

`.gitignore` excludes `.env` and `.env.*` except the placeholder-only `.env.example`. CI fails if another `.env*` file becomes tracked.

### 3. Hardcoded API keys or secrets

**Status:** Verified protected for high-confidence current/history patterns.

The CI scanner rejects private-key headers, major live-token shapes, Google API keys, credential-bearing database URLs, and populated privileged Supabase key assignments across every commit reachable from the candidate head. This is a high-confidence guard, not a claim that regex scanning can identify every possible secret format.

### 4. Weak or missing authentication

**Status:** Verified protected for private account surfaces.

Private endpoints use bearer authentication validated through Supabase Auth. Direct-user endpoints reject service/anon-style credentials and derive the user from the validated token. The public `/v1` API is intentionally read-only and public rather than pretending to require authentication.

### 5. Missing server-side authorization

**Status:** Verified protected.

Authorization is enforced on the server and in PostgreSQL RLS, not only through hidden UI controls. Private endpoints resolve the authenticated user server-side; production database review found RLS enabled and forced on current public tables.

### 6. Users able to access other users' data

**Status:** Verified protected for the current database/application boundary; the AI real-client matrix remains separately open.

Cross-account/RLS tests fail closed, current policies bind private rows to `auth.uid()`, and live production metadata review found no anonymous table grants. Real Claude/ChatGPT delegation matrices are still required by the separate broad-client release gate and are not replaced by this result.

### 7. Open or overly permissive database read/write permissions

**Status:** Verified protected for the current public schema.

Live production metadata inspection found all current `public` tables with RLS enabled and forced, no `anon` table grants, restrictive client-bearing OAuth policies, fixed-search-path security-definer functions, and protected onboarding trigger execution. Isolated migration/security tests run in CI.

### 8. Misconfigured Firebase, Supabase Storage, S3, or object buckets

**Status:** Verified protected / not used.

The application contains no Supabase Storage object-bucket client path and does not use Firebase or S3 for private application storage. A live read-only production query on 2026-08-30 confirmed that the active Gapwise Supabase project has zero `storage.buckets` rows.

### 9. Admin routes left unprotected

**Status:** Verified protected for the current route inventory.

The current production route inventory contains no admin route. The exposure scanner fails closed if an `admin`, `debug`, `devtool(s)`, or `internal` production-route filename is introduced without explicit review. This complements, rather than replaces, manual authorization review of privileged behavior under ordinary route names.

### 10. Debug pages or developer tools exposed in production

**Status:** Verified protected for current route/source inventory; production artifact inspection remains part of final release evidence.

No debug/devtools production route or committed `debugger` path was found. Development-only logic is guarded by `import.meta.env.DEV`. The final security gate still requires exact-head production-bundle/config inspection before ecosystem completion.

### 11. Build logs leaking secrets

**Status:** Verified protected for repository CI patterns; external retention/access evidence required.

No `printenv`, `set -x`, or whole-environment dump path was found in maintained workflows. The full-history job checks out with `persist-credentials: false`. Provider log-retention/access controls are account-level evidence and are tracked separately.

### 12. Verbose errors leaking stack traces or internal details

**Status:** Verified protected for reviewed production handlers and catastrophic server diagnostics.

PR #213 redacts bearer tokens, JWTs, cookie values, API/service-role keys, passwords, client secrets, and related credential-shaped data before expanded catastrophic diagnostics reach hosted logs. Reviewed API handlers return bounded generic 4xx/5xx responses rather than raw server exceptions. Alternate logging sinks remain part of the final cross-repo audit.

### 13. Secrets or sensitive data committed to Git or Git history

**Status:** Verified protected by permanent core and AI history gates.

Core CI scans every commit reachable from the candidate head. `gapwise-ai` already has a reachable-history secret scan. The AI release checklist still requires a fresh exact-final-head run after the real-client matrices.

### 14. Secrets included in frontend JavaScript

**Status:** Verified protected by source boundary and release checks.

Public browser configuration is separated from service-role, KEK, and database secrets. The exposure scanner rejects secret-shaped `VITE_*` names and references to known server-only secret names from browser source. Production-bundle inspection remains a final release invariant.

### 15. Client-side-only security checks

**Status:** Verified protected.

Authentication and authorization for private data are enforced server-side and again by forced database RLS. Security-sensitive ownership is derived from the authenticated session instead of trusted from user-supplied owner IDs.

### 16. Missing input validation

**Status:** Verified protected on reviewed public/private HTTP boundaries.

Shared JSON parsing requires `application/json`, an object payload, and bounded body size. Onboarding accepts only known keys and enums with list/length bounds. Public API query values reject repeats, excessive length, unsupported campuses/types, and unbounded limits. Common-gap rejects unexpected query parameters.

### 17. SQL injection

**Status:** Verified protected for the current application query architecture.

No application raw-SQL builder, `queryRaw`, or dynamic `EXECUTE format(...)` path was found. Application database access uses Supabase/PostgREST parameter APIs with literal relation/function names; migration SQL is static source-controlled SQL and database lint/tests run in CI.

### 18. NoSQL/query-language injection

**Status:** Not applicable to a NoSQL datastore; verified protected against reviewed dynamic-query construction.

Gapwise does not use a NoSQL application datastore. Supabase/PostgREST calls use literal table/RPC names and bounded validated values; no user-controlled relation-name construction or general query-language interpreter was found in the reviewed path.

## Live Supabase verification

A read-only provider check against the active production project on 2026-08-30 established additional current-state evidence:

- the project is `ACTIVE_HEALTHY` in `ca-central-1`;
- `storage.buckets` is empty;
- the only deployed Edge Function is `delete-account`, it has `verify_jwt: true`, revalidates the bearer token with Supabase Auth, and rejects OAuth/MCP client tokens before invoking admin deletion authority;
- the two private rate-limit tables reported by the Supabase advisor as "RLS enabled, no policy" are in the `private` schema and have table grants only for `postgres`, not `anon` or `authenticated`;
- the authenticated-callable friend/key-rotation `SECURITY DEFINER` RPC warnings were reviewed rather than ignored: live function definitions have an empty fixed `search_path`, grants limited to `postgres` and `authenticated`, direct-session checks, `auth.uid()` ownership constraints, and parameter validation where applicable; and
- Supabase currently reports leaked-password protection as disabled. Aggregate inspection found zero password-auth users among the current auth users, so this does not expose an existing Gapwise password population. Password-provider configuration must be reassessed before Gapwise ever enables password sign-in.

These observations are point-in-time provider evidence, not permanent claims about future account configuration.

## Permanent regression gate added by this audit

`node scripts/scan-security-exposure.mjs` now runs in CI with full Git history and is required by the final `verify` job. It fails when it finds:

- tracked `.env*` files other than `.env.example`;
- private-key/container files;
- high-confidence credential material in any reachable commit;
- secret-shaped `VITE_*` variables that would imply browser exposure;
- known server-only secret names referenced by browser source; or
- new admin/debug/devtools/internal production-route filenames requiring explicit review.

Known synthetic credential fixtures use the reserved `example.invalid` domain and are excluded narrowly rather than weakening the credential pattern globally.

## Remaining evidence that cannot be manufactured from source code

This audit does not close provider, device, or external-client facts. In particular:

- Vercel/runtime-log retention and access, provider contractual terms, OAuth-provider scopes, and other provider-account facts still require their own evidence (Linear AND-174);
- the real Claude and ChatGPT OAuth/read/write/revoke matrices and production-equivalent revoke/re-auth negative paths remain required by the Gapwise AI release program;
- the final exact-head secret/history/CI/deployment verification must run after those real-client matrices and any fixes they cause; and
- the actual encrypted off-site database backup and disposable-target restore drill remains an operational exercise rather than a repository claim.

No item above should be promoted into a stronger public security or legal claim than its evidence supports.
