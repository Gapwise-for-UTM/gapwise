# Institutional evidence and gap register

> **INTERNAL WORKSHEET — GAPS ARE INTENTIONAL AND MUST NOT BE SILENTLY REMOVED**

Use one row per shareable artifact. A source link is traceability, not proof that a process operated. Sensitive evidence belongs in an approved access-controlled system, not Git.

| Artifact | Current evidence | Authority | Gap / confirmation still required | Share gate |
| --- | --- | --- | --- | --- |
| Product overview | [PRODUCT_OVERVIEW.md](PRODUCT_OVERVIEW.md) | AND-159 | Owner verifies exact claims, cutoff, and audience | Owner approval |
| Public Trust Center | `/trust` | AND-165 / AND-131 | Exact deployed build, links, and current cross-repo references | Owner/security/privacy review |
| Security whitepaper / architecture | `gapwise-docs` Security and Architecture pages | AND-164 | Exact published revision and deployed-boundary reconciliation | Security/privacy review |
| Data/subprocessor inventory | `../TRUST_DATA_INVENTORY.md` | AND-156 | Preserve every human/provider confirmation flag; refresh after processor/data-flow change | Privacy/security review |
| PIA / retention / privacy workflows | `gapwise-docs/governance/privacy` | AND-157 | Legal-policy drafts need human/legal approval where marked | Privacy/legal review |
| Vulnerability disclosure | `SECURITY.md`, `/security`, `/.well-known/security.txt` | AND-163 | Capture exact production reachability and reviewed deployed commit | Security review |
| Incident response | `../INCIDENT_RESPONSE.md` | AND-158 | Named roles/private channels and actual exercise evidence remain separate | Security/privacy/owner review |
| BC/DR | `../DISASTER_RECOVERY.md` | AND-154 for exercise state | Actual backup, off-site storage, disposable restore, KEK recovery evidence | Operations/owner review |
| Accessibility | `/accessibility`, `../ACCESSIBILITY_MATRIX.md`, `../ACCESSIBILITY_CONFORMANCE_WORKSHEET.md` | AND-162 | Manual assistive-technology evidence and private accessibility contact remain gaps; no certification claimed | Accessibility/owner review |
| AI/MCP permissions | developer/security docs + `gapwise-ai` | AND-113 / AND-164 inputs | Exact-head cross-repo delegated-data/permission reconciliation | Security/privacy review |
| CI/security snapshot | [CI_SECURITY_EVIDENCE.md](CI_SECURITY_EVIDENCE.md) | Package preparer | Capture exact commit/runs/results/redactions; green checks are not audit evidence | Engineering review |
| Independent penetration test | No assessment claimed | Owner + independent assessor | Authorized scope, assessor independence, report, remediation/retest evidence | Independent assessment |
| Legal/DPA/trademark/insurance | Checklist only | AND-161 / owner/counsel | Legal positions, entity/authority, insurance, university relationship all human-only | Legal/owner review |
| Contacts/escalation | Role-only matrix | Owner | Named accountable contacts, private channels, staffing/coverage, test evidence | Owner review |
| Transparency reporting | Annual and periodic templates | AND-160 | Reliable measurement systems and review are required before publishing numbers | Owner/privacy/security review |

## External evidence attachment record

| Evidence ID | Description | Date/range | Source/custodian | Sensitivity | Integrity/reference | Reviewer decision |
| --- | --- | --- | --- | --- | --- | --- |
| _Pending_ | _Do not record secrets, private account identifiers, contracts, or student data here_ | | | | | |

## Rule for gaps

A gap may be closed only by evidence that supports the exact statement. Do not close a legal/provider/operational gap because code exists, a CI job is green, or a template was written. When evidence expires or scope changes, reopen the row.
