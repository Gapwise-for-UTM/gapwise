# Final security audit — 2026-08-30

This note records fresh evidence gathered during the final invisible-security hardening pass. It is evidence, not a claim of perfect security or independent certification.

## Scope

- core web/PWA and server runtime
- Supabase database/auth trust boundary
- public API and SDK surface
- Gapwise AI/MCP trust boundary at the ecosystem level
- mobile and documentation claims where they affect the core trust model

## Fresh evidence

- Pull request #211 completed the canonical U of T course-title lookup with privacy-preserving three-letter subject-prefix requests, local ACORN-title fallback, and green quality/database/E2E/SDK gates before merge.
- `main` deployed successfully through Vercel after #211 merged.
- Supabase Security Advisor findings were reviewed against the deployed function definitions instead of being silenced mechanically.
- The reviewed SECURITY DEFINER friend/key-envelope functions set `search_path=pg_catalog` explicitly and enforce the direct authenticated-user-session boundary in their function bodies. The advisor's mutable-search-path warnings are therefore not evidence that those functions actually execute with a mutable search path.
- The separate `private.is_direct_user_session()` guard also fixes `search_path=pg_catalog` and requires the authenticated database role, an authenticated JWT role, and no OAuth client id.
- Supabase currently reports leaked-password protection disabled. Gapwise's production authentication is Google-based rather than password-first, so this warning is retained as an explicit configuration/evidence item rather than being represented as remediated without provider-level verification.

## Hardening added in this audit

The server-side catastrophic-error path expands Error stacks and causes to preserve useful production diagnostics. Before this pass, those expanded strings were not credential-redacted. An error message/cause containing an Authorization bearer token, JWT, cookie, Supabase auth-storage token, API key, service-role key, password, client secret, or similar named secret could therefore have reached hosted logs.

The runtime now redacts credential-shaped values before expanded diagnostics reach `console.error`, while preserving ordinary stack/status information. Regression tests cover bearer/JWT/cookie and structured key-value/JSON secret cases.

## Findings retained as external evidence gates

The following require evidence that cannot be manufactured by static repository inspection:

- clean-browser/device Google sign-in, continuity, and encrypted restore;
- real ChatGPT and Claude OAuth/read/write/revoke matrices;
- uncoached real-phone activation sessions and final real-device smoke;
- physical UTM entrance/barrier-free field verification;
- a logical backup restored into a disposable non-production database target;
- provider/account settings that are only observable in their owner-controlled consoles.

These remain release-evidence gaps, not hidden claims of completion.
