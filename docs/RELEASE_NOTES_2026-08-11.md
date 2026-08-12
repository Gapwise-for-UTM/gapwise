# Production readiness checkpoint — 2026-08-11

This record captures the launch-readiness evidence for the current public Gapwise deployment without including production secrets, user identifiers, plaintext timetable data, or ciphertext dumps.

## Verified production state

- Production private cloud is authoritative `encrypted` mode.
- The current production database has one encrypted private-data row, one encrypted availability row, and one key envelope for the retained account.
- The encrypted private-data revision has advanced after cutover while the legacy plaintext schedule timestamp has remained unchanged.
- Every current legacy schedule/preferences owner has a corresponding encrypted private-data/key-envelope replacement; the current legacy schedule owner also has an encrypted availability replacement.
- The latest production-hardening migration is applied.
- The post-hardening Vercel deployment is `READY`.
- The checked Vercel runtime observation window contains no unexplained runtime errors.
- Production response headers include the restrictive Content Security Policy, HSTS, `nosniff`, frame denial, referrer policy, and permissions policy.
- Application CI and isolated database-security CI passed for the production-hardening change before merge.
- Supabase Security/Performance Advisor findings have been reviewed; current notices are either intentional trust-boundary decisions or low-signal unused-index notices on new/low-traffic structures.

## Privacy/security boundaries

- The original ACORN `.ics` file is parsed locally and is not uploaded.
- Private cloud timetable/settings data is encrypted in the browser before Supabase storage.
- The Vercel key broker remains trusted and can unwrap user data-encryption keys; Gapwise is therefore not E2EE or zero knowledge.
- Friend availability uses a separate lossy encrypted capsule and returns only bounded rounded common windows.
- Guest timetable, gap, and route use remains local-first.

## Remaining deliberate hold

Gate 6 removal of the single legacy plaintext rollback schedule/preferences record and its obsolete plaintext overlap path is intentionally separate because it destroys rollback data. It must not be performed implicitly from a documentation or hardening change. Before that operation, rerun the aggregate replacement check, verify the production encrypted restore path, and obtain explicit authorization for the destructive cleanup.

See `LAUNCH_READINESS.md` and `PRIVATE_CLOUD_MIGRATION_RUNBOOK.md` for the canonical gates.
