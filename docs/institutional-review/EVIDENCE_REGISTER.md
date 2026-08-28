# Institutional evidence and gap register

> **INTERNAL WORKSHEET — GAPS ARE INTENTIONAL AND MUST NOT BE SILENTLY REMOVED**

A source link provides traceability, not proof that a process operated. Sensitive evidence belongs in an approved access-controlled system, not Git.

## Artifact evidence and share gates

- **Product overview — AND-159:** [PRODUCT_OVERVIEW.md](PRODUCT_OVERVIEW.md). The owner must verify exact claims, evidence cut-off, and intended audience before sharing.
- **Security whitepaper and architecture — AND-164:** completed Phase 3 artifacts in `gapwise-docs`. Reconcile the exact published revision with the deployed boundary before sharing and obtain security/privacy review.
- **Data and subprocessor inventory — AND-156:** completed Phase 1 evidence inventory. Preserve every human/provider confirmation flag and refresh after processor or data-flow changes.
- **PIA, retention, and privacy workflows — AND-157:** completed Phase 5 governance package. Legal-policy drafts need human/legal approval wherever marked.
- **Vulnerability disclosure — AND-163:** `SECURITY.md` and core PR #184. Exact-head merge, deployment, and public reachability remain required.
- **Incident response — AND-158:** core PR #185. Exact-head merge remains required; role/channel assignment and actual exercises are separate evidence.
- **Business continuity and disaster recovery — AND-154:** `../DISASTER_RECOVERY.md`. Actual backup, off-site storage, disposable restore, and KEK recovery evidence must come from AND-154.
- **Accessibility — AND-162:** `../ACCESSIBILITY_MATRIX.md` and Phase 7 work. Public statement, manual assistive-technology evidence, and known-limit review remain in progress.
- **AI/MCP permissions — AND-113 and Phase 3 inputs:** developer/security docs plus `gapwise-ai`. Exact-head cross-repository delegated-data and permission reconciliation is required.
- **CI/security snapshot:** [CI_SECURITY_EVIDENCE.md](CI_SECURITY_EVIDENCE.md). Capture exact commits, runs, results, and redactions. Green checks are not audit evidence.
- **Independent penetration test:** no assessment is claimed. Authorized scope, assessor independence, report, remediation, and retest evidence require a qualified independent assessor.
- **Legal, DPA, trademark, and insurance:** checklist only. Legal positions, entity/authority, insurance, and university-relationship facts are human-only.
- **Contacts and escalation:** role-only matrix. Named accountable contacts, private channels, staffing/coverage, and operability tests require owner evidence.
- **Transparency reporting — AND-160:** core PR #186. Exact-head merge and reliable measurement systems are required before publishing statistics.

## External evidence attachment record

For each external evidence item, record only a non-sensitive evidence ID, description, date or range, source/custodian, sensitivity classification, integrity/reference information, and reviewer decision. Do not record secrets, private account identifiers, contracts, student data, or other sensitive source material here.

## Rule for gaps

A gap may be closed only by evidence that supports the exact statement. Do not close a legal, provider, or operational gap because code exists, a CI job is green, or a template was written. When evidence expires or scope changes, reopen the gap.
