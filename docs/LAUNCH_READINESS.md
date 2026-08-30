# Launch readiness

Gapwise is approved for public use under the production-hardening standard below. This document records the launch baseline and the current operating posture; it does not claim that any internet-facing application can be made perfectly secure.

## Current production posture — 2026-08-30

Status: **PRODUCTION HEALTHY / FINAL RELEASE EVIDENCE IN PROGRESS**.

The canonical production domain is `https://gapwise.ca`, built from the protected GitHub `main` branch by Vercel. Exact-head CI/deployment evidence is recorded in dated release/security evidence rather than hard-coded here, because every legitimate merge advances `main` and would otherwise make this operating document immediately stale. See [`FINAL_SECURITY_AUDIT_2026-08-30.md`](FINAL_SECURITY_AUDIT_2026-08-30.md) for the latest security-audit checkpoint.

The original encrypted-only launch sign-off completed on 2026-08-12. Since then, the product has continued through focused production hardening, fully-free product cleanup, Trust Center/governance work, SEO/searchability work, mobile implementation, AI/MCP release preparation, privacy-preserving canonical U of T course-title enrichment, and final server-log credential redaction. Current release work is evidence-driven rather than feature-expansion-driven.

Private cloud remains encrypted-only in source; the legacy plaintext timetable/settings tables and plaintext overlap implementation remain retired.

## Required production properties

- The original ACORN `.ics` file is parsed locally and is not uploaded.
- Guest mode remains a first-class path.
- Private timetable/settings payloads are encrypted in the browser before Supabase storage.
- Friend availability is stored separately as a deliberately lossy encrypted capsule.
- Supabase remains in the account/relationship trust boundary but stores timetable ciphertext rather than the private timetable payload.
- Vercel remains inside the cryptographic trust boundary because the key broker can unwrap per-user data-encryption keys under the production KEK.
- Production and Preview never share a KEK.
- Common-gap responses are bounded and do not expose a friend's timetable/course/room/building history.
- Gapwise does not claim E2EE, zero knowledge, or perfect security.
- Live location is opt-in and not background-tracked.
- Campus route/accessibility claims remain conservative when evidence is not verified.
- The app states that it is an independent student project and not affiliated with or endorsed by the University of Toronto.
- Gapwise remains fully free for students; paid tiers, billing, Stripe, Canvas/Quercus/LTI, and institutional entitlement gates are not part of the active product.

## Verified production/security properties

- [x] Typecheck, lint, tests, production build, generated assets/format checks, and isolated database-security checks have been exercised through release hardening.
- [x] Production deploys are tied to protected `main`; dated release evidence records the exact candidate/head used for release-sensitive verification.
- [x] Production runtime errors have been reviewed during release observation windows; the latest aggregate checks found no grouped runtime-error clusters requiring a release-blocking fix.
- [x] Restrictive CSP/HSTS/nosniff/referrer/permissions/frame protections have been verified and regression-tested.
- [x] Supabase Security and Performance Advisor findings have been reviewed against the current architecture rather than silenced mechanically.
- [x] Production database migration state matches the encrypted-only repository architecture.
- [x] Legacy plaintext timetable/settings storage and plaintext overlap helpers are removed.
- [x] Sign-out cleanup, account deletion, user isolation, and bounded friend-overlap authorization have automated/security coverage.
- [x] Expanded server-side error diagnostics redact credential-shaped bearer tokens, JWTs, cookie/auth-storage values, API/service-role keys, client secrets, passwords, and related named secrets before hosted logging, with regression coverage.
- [x] Security review found no known production KEK/DEK, service-role key, token, private timetable fixture, or ciphertext dump in public source/log/analytics paths.
- [x] Privacy/security docs describe browser-side encryption and the trusted Vercel key-broker boundary without E2EE/zero-knowledge claims.
- [x] The production Gapwise AI OAuth 2.1 consent/resource boundary, browser trust/CSP path, protected-resource metadata, and fail-closed unauthenticated behavior were validated under AND-114.
- [x] Recovery and incident procedures are documented.
- [x] Trust Center, privacy-governance, incident-response, vulnerability-disclosure, security architecture, transparency, accessibility-governance, and institutional-review scaffolding are published without claiming independent certification or university endorsement.

## Remaining evidence gates

The following are deliberately **not** represented as completed until fresh evidence exists:

- [ ] Complete production Google account-continuity validation, including a clean-browser/device encrypted restore path and relevant negative/recovery behavior.
- [ ] Complete real Claude and ChatGPT OAuth/read/write/revoke matrices plus no-delegation, read-only, write-disabled, stale-write, revoke, and re-auth scenarios.
- [ ] Run the final Gapwise AI repository/history secret scan and exact-final-head CI/deployment verification after the real-client matrices are complete.
- [ ] Exercise the documented Free-plan logical database backup and restore procedure against a disposable non-production target; documentation alone is not evidence of a completed restore drill.
- [ ] Finish the final ecosystem README/docs reconciliation after the remaining release-state dependencies settle, and verify `docs.gapwise.ca` from the final docs head.
- [ ] Complete required real-device/student evidence and physical UTM entrance/barrier-free field verification without fabricating campus facts.

Automated coverage may support these gates, but it does not replace the explicitly required real production/device/provider evidence.

## Release verification for behavior changes

Before a major release/announcement or after a meaningful production behavior change:

1. Confirm the intended `main` SHA and matching production deployment.
2. Run/confirm required GitHub application and database-security checks.
3. Verify the relevant desktop/mobile browser journeys and accessibility behavior.
4. Check Vercel production status/runtime errors and response headers.
5. Check Supabase health/advisors/logs when backend/auth/database behavior changed.
6. Exercise destructive auth/data paths only with disposable accounts/data when the change affects them.
7. Reconcile Linear and documentation with what is actually deployed.

Documentation-only changes should not trigger unrelated feature work. They may advance a repository SHA, but any exact-head evidence claim must be re-established for the new final head rather than copied forward.

## Free-plan operating limits

Gapwise remains local-first and conservative with server work so it can stay free for students and within practical free infrastructure limits.

- Do not poll Supabase/Vercel for timetable state.
- Do not add background location tracking.
- Do not add a paid map API when reviewed bundled/open routing data satisfies the product need.
- Do not introduce paid auth-domain, billing, entitlement, or institutional-integration infrastructure merely for cosmetic parity.
- Cache/deduplicate bounded social work.
- Monitor Vercel invocation/transfer and Supabase size/egress before raising backend-heavy caps.
- Prefer aggregate operational metrics; never send timetable/relationship contents to analytics.
- Keep core timetable, gap, recommendation, and route computation in the browser.
- Prefer optimization/client-side work/open-source substitutes over charging students for the core product.

## CI/deployment discipline

Correctness gates stay strict, but remote churn should stay low:

- verify locally before pushing;
- batch coherent changes into one intentional branch update where practical;
- avoid push-based formatting/test debugging loops;
- rerun failed jobs/runs instead of no-op commits when appropriate;
- use focused PRs and squash-merge to `main`;
- never bypass a real required-check failure merely to save CI time;
- do not create no-op commits solely to consume another Vercel Hobby deployment when a quota/rate limit is the only blocker.

## Safe public wording

Safe claims include:

- “Your original timetable file stays in your browser.”
- “Private cloud timetable data is encrypted in your browser before storage.”
- “Gapwise is local-first for timetable, gap, and campus-route calculations.”
- “Friend overlap shares only a few rounded common windows, not your timetable.”
- “Gapwise is independently built and is not affiliated with or endorsed by the University of Toronto.”

Do not claim end-to-end encryption, zero knowledge, server-inability to decrypt, unhackability, perfect security, certification, independent audit, guaranteed data residency, or official U of T affiliation without current evidence.

## Current roadmap gate

The large implementation, hardening, fully-free cleanup, Trust Center, SEO, and mobile campaigns are complete. The remaining roadmap is dominated by externally constrained release evidence: real external-client OAuth/read/write/revoke and negative-path matrices, encrypted account-continuity restore, database restore-drill evidence, SDK registry publication/clean-install verification, real-device/student sessions, and physical UTM entrance/accessibility verification. Final ecosystem documentation should close only after those dependent claims can be reconciled against the exact shipped heads.
