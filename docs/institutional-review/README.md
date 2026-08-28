# Gapwise institutional review package

> **INTERNAL WORKING MATERIAL — NOT APPROVED FOR PUBLICATION OR CONTRACTUAL RELIANCE**

This directory is the Phase 8 institutional-review package for AND-159. It is an evidence map and preparation workspace, not proof of University of Toronto review, legal approval, certification, insurance, an audit, or a penetration test.

## Status vocabulary

| Status | Meaning |
| --- | --- |
| `Repository evidence` | A statement can be checked against linked current source. It is not independent assurance or proof the control operated in production. |
| `Process draft` | A proposed internal process that has not been demonstrated through an incident/exercise. |
| `Pending merge` | Work exists in an open reviewed PR but is not yet current `main`. |
| `Human confirmation` | A person with access to external accounts, contracts, organizational facts, or real-world evidence must confirm it. |
| `Legal review` | Counsel or an authorized owner must review it before reliance/publication. |
| `Independent assessment required` | Evidence must come from a qualified party independent of implementation work. |

## Package index

| Requested artifact | Package location / source | Current status and gap |
| --- | --- | --- |
| One-page product overview | [PRODUCT_OVERVIEW.md](PRODUCT_OVERVIEW.md) | `Repository evidence`; owner approval and intended-recipient review remain pending. |
| Security whitepaper | Gapwise security whitepaper in `andrewmuratov/gapwise-docs` | Phase 3 / AND-164 completed; re-check the exact published revision before sharing. |
| Architecture/data-flow diagram | Gapwise security architecture package in `gapwise-docs` | Phase 3 completed; validate exact boundaries against current production configuration before sharing. |
| Data inventory / subprocessors | AND-156 evidence-backed trust inventory | Phase 1 completed; any provider jurisdiction/contract facts still marked for human/provider confirmation must remain qualified. |
| PIA / retention / privacy workflows | AND-157 privacy-governance package | Phase 5 completed; legal-policy drafts remain drafts until approved. |
| Vulnerability disclosure / `security.txt` | Core PR #184 and `SECURITY.md` | `Pending merge`; reachability is not established until merged/deployed. |
| Incident response / BC-DR | [EVIDENCE_REGISTER.md](EVIDENCE_REGISTER.md), core PR #185, `../DISASTER_RECOVERY.md` | Phase 6 package is `Pending merge`; actual backup/restore evidence remains authoritative in AND-154. |
| Accessibility statement/evidence | `../ACCESSIBILITY_MATRIX.md` plus Phase 7 / AND-162 | Accessibility governance package is still in progress; no formal conformance or third-party certification is claimed. |
| AI/MCP permission model | `../DEVELOPER_PLATFORM.md`, security docs, `andrewmuratov/gapwise-ai` | Exact-head cross-repository reconciliation required before institutional sharing. |
| CI/security snapshot | [CI_SECURITY_EVIDENCE.md](CI_SECURITY_EVIDENCE.md) | Capture worksheet; green CI/scanners are not independent assurance. |
| Independent penetration test | [PENETRATION_TEST_READINESS.md](PENETRATION_TEST_READINESS.md) | `Independent assessment required`; no test/result is claimed. |
| CAIQ/SIG-style preparation | [QUESTIONNAIRE_PREPARATION.md](QUESTIONNAIRE_PREPARATION.md) | Preparation worksheet only, not an official questionnaire response. |
| DPA/security addendum and U of T marks | [LEGAL_AND_AFFILIATION_CHECKLIST.md](LEGAL_AND_AFFILIATION_CHECKLIST.md) | `Legal review` / `Human confirmation`; no approved relationship or contractual position is claimed. |
| Contact/escalation matrix | [CONTACT_ESCALATION_MATRIX.md](CONTACT_ESCALATION_MATRIX.md) | Role-based internal template; named/staffed private channels require owner confirmation. |

## Handoff gate

Before any package is shared, the package owner must record the exact source commit(s), evidence cut-off, intended recipient, review date, redactions, and approvals; resolve or explicitly accept each listed gap; verify every link and current claim; and use an approved secure transfer method for sensitive material.

Do not add secrets, tokens, private provider identifiers, personal phone numbers, contracts, legal advice, incident detail, or student data to this directory. A repository link establishes traceability only—it does not establish that a control operated in production.
