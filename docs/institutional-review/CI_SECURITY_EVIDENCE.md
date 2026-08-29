# CI and security evidence capture

> **INTERNAL WORKSHEET — REPOSITORY CHECKS ARE NOT AN AUDIT OR PRODUCTION ATTESTATION**

## Safe evidence sources

Prefer a durable, redacted record of a successful exact-commit hosted run over screenshots containing unnecessary actor or account metadata. Repository-defined CI, dependency automation, tests, scanners, and security-control documentation can support a review, but none is an independent audit or proof that production configuration matches source.

## Snapshot record

Capture each of these fields for the exact review snapshot:

- **Source commit:** _Pending capture_
- **Branch or tag:** _Pending capture_
- **Capture time (UTC):** _Pending capture_
- **CI run reference:** _Pending; approved durable reference only_
- **Required-check result:** _Pending_
- **Dependency/security scanner result:** _Pending; do not infer “none” from a green build_
- **Review-thread result:** _Pending_
- **Production/deployment evidence:** _Pending; separate from source CI_
- **Reviewer and date:** _Pending_
- **Redactions:** _Pending_

## Local and hosted verification record

Record exact tool versions, dates, results, and evidence references for formatting, typecheck, lint, unit/integration tests, build, browser/E2E tests, database/security tests, and dependency/security scanning. Local checks support preparation but do not replace hosted CI or production evidence.

Do not call a scanner result a penetration test, certification, independent assessment, assurance opinion, or proof of absence of vulnerabilities. Preserve failures and accepted exceptions with an owner, rationale, and review date.
