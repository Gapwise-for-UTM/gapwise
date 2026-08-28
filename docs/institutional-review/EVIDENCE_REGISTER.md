# Institutional evidence and gap register

> **INTERNAL WORKSHEET — GAPS ARE INTENTIONAL AND MUST NOT BE SILENTLY REMOVED**

Use one row per shareable artifact. A source link is traceability, not proof that a process operated. Sensitive evidence belongs in an approved access-controlled system, not Git.

| Artifact | Current evidence | Authority | Gap / confirmation still required | Share gate |
| --- | --- | --- | --- | --- |
| Product overview | [PRODUCT_OVERVIEW.md](PRODUCT_OVERVIEW.md) | AND-159 | Owner verifies exact claims, cutoff, and audience | Owner approval |
| Security whitepaper / architecture | Completed Phase 3 artifacts in `gapwise-docs` | AND-164 | Exact published revision and deployed-boundary reconciliation | Security/privacy review |
| Data/subprocessor inventory | Completed Phase 1 evidence inventory | AND-156 | Preserve every human/provider confirmation flag; refresh after processor/data-flow change | Privacy/security review |
| PIA / retention / privacy workflows | Completed Phase 5 governance package | AND-157 | Legal-policy drafts need human/legal approval where marked | Privacy/legal review |
| Vulnerability disclosure | `SECURITY.md`; core PR #184 | AND-163 | Exact-head merge/deployment/reachability | Security review |
| Incident response | core PR #185 | AND-158 | Exact-head merge; role/channel assignment and actual exercises remain separate evidence | Security/privacy/owner review |
| BC/DR | `../DISASTER_RECOVERY.md` | AND-154 for exercise state | Actual backup, off-site storage, disposable restore, KEK recovery evidence | Operations/owner review |
| Accessibility | `../ACCESSIBILITY_MATRIX.md`; AND-162 work | AND-162 | Public statement/manual AT evidence/known-limit review still in progress | Accessibility review |
| AI/MCP permissions | developer/security docs + `gapwise-ai` | AND-113 / Phase 3 inputs | Exact-head cross-repo delegated-data/permission reconciliation | Security/privacy review |
| CI/security snapshot | [CI_SECURITY_EVIDENCE.md](CI_SECURITY_EVIDENCE.md) | Package preparer | Capture exact commit/runs/results/redactions; green checks are not audit evidence | Engineering review |
| Independent penetration test | No assessment claimed | Owner + independent assessor | Authorized scope, assessor independence, report, remediation/retest evidence | Independent assessment |
| Legal/DPA/trademark/insurance | Checklist only | AND-161 / owner/counsel | Legal positions, entity/authority, insurance, university relationship all human-only | Legal/owner review |
| Contacts/escalation | Role-only matrix | Owner | Named accountable contacts, private channels, staffing/coverage, test evidence | Owner review |
| Transparency reporting | core PR #186 | AND-160 | Exact-head merge; reliable measurement systems required before publishing numbers | Owner/privacy/security review |

## External evidence attachment record

| Evidence ID | Description | Date/range | Source/custodian | Sensitivity | Integrity/reference | Reviewer decision |
| --- | --- | --- | --- | --- | --- | --- |
| _Pending_ | _Do not record secrets, private account identifiers, contracts, or student data here_ | | | | | |

## Rule for gaps

A gap may be closed only by evidence that supports the exact statement. Do not close a legal/provider/operational gap because code exists, a CI job is green, or a template was written. When evidence expires or scope changes, reopen the row.
