# Gapwise institutional review package

> **INTERNAL WORKING MATERIAL — NOT APPROVED FOR PUBLICATION OR CONTRACTUAL RELIANCE**

This directory is the Phase 8 institutional-review package for AND-159. It is an evidence map and preparation workspace, not proof of University of Toronto review, legal approval, certification, insurance, an audit, or a penetration test.

## Status vocabulary

| Status | Meaning |
| --- | --- |
| `Repository evidence` | A statement can be checked against current source. It is not independent assurance or proof a control operated in production. |
| `Process material` | A maintained runbook, template, or operating procedure. Presence does not prove execution. |
| `Human confirmation` | External account, contract, organizational, or production-only facts must be confirmed by an authorized person. |
| `Legal review` | Counsel or an authorized owner must review the statement before reliance/publication. |
| `Independent assessment required` | Evidence must come from a qualified assessor independent of implementation work. |

## Package index

| Requested artifact | Package location / source | Current status and gap |
| --- | --- | --- |
| One-page product overview | [PRODUCT_OVERVIEW.md](PRODUCT_OVERVIEW.md) | `Repository evidence`; owner approval and intended-recipient review remain pending. |
| Security whitepaper | Gapwise Security Overview in `andrewmuratov/gapwise-docs` | `Repository evidence`; re-check exact published revision and production boundary before sharing. |
| Architecture/data-flow diagram | Gapwise architecture package in `gapwise-docs` | `Repository evidence`; reconcile against the deployed core and AI integrations. |
| Data inventory / subprocessors | `../TRUST_DATA_INVENTORY.md` | `Repository evidence`; preserve every provider/jurisdiction confirmation flag. |
| PIA / retention / privacy workflows | `andrewmuratov/gapwise-docs/governance/privacy` | `Process material`; legal-policy drafts remain drafts until approved. |
| Vulnerability disclosure / `security.txt` | `/security`, `SECURITY.md`, `/.well-known/security.txt` | Current repository implementation; exact production reachability should be captured before institutional handoff. |
| Incident response / BC-DR | `../INCIDENT_RESPONSE.md`, `../DISASTER_RECOVERY.md`, [EVIDENCE_REGISTER.md](EVIDENCE_REGISTER.md) | Current `Process material`; exercises, named roles, provider evidence, backup/restore evidence, and service levels remain separate. |
| Accessibility statement/evidence | `/accessibility`, `../ACCESSIBILITY_MATRIX.md`, `../ACCESSIBILITY_CONFORMANCE_WORKSHEET.md` | Current evidence-backed statement and worksheet; no formal conformance or third-party certification claimed. |
| Public Trust Center | `/trust` | Student-readable evidence map; revalidate links and exact deployed build before external reliance. |
| AI/MCP permission model | `../DEVELOPER_PLATFORM.md`, core AI contract, `gapwise-docs`, `andrewmuratov/gapwise-ai` | Exact-head cross-repository reconciliation required before institutional sharing. |
| CI/security snapshot | [CI_SECURITY_EVIDENCE.md](CI_SECURITY_EVIDENCE.md) | Capture worksheet; green CI/scanners are not independent assurance. |
| Independent penetration test | [PENETRATION_TEST_READINESS.md](PENETRATION_TEST_READINESS.md) | `Independent assessment required`; no test/result is claimed. |
| CAIQ/SIG-style preparation | [QUESTIONNAIRE_PREPARATION.md](QUESTIONNAIRE_PREPARATION.md) | Preparation worksheet only, not an official questionnaire response. |
| DPA/security addendum and U of T marks | [LEGAL_AND_AFFILIATION_CHECKLIST.md](LEGAL_AND_AFFILIATION_CHECKLIST.md) | `Legal review` / `Human confirmation`; no approved relationship or contractual position is claimed. |
| Contact/escalation matrix | [CONTACT_ESCALATION_MATRIX.md](CONTACT_ESCALATION_MATRIX.md) | Role-based internal template; named/staffed private channels require owner confirmation. |
| Transparency reporting | `../governance/TRUST_TRANSPARENCY_REPORT_TEMPLATE.md`, `../governance/PERIODIC_TRUST_UPDATE_TEMPLATE.md` | Current templates only; reliable measurement systems are required before numeric publication. |
| Administrative/legal readiness | `../ADMINISTRATIVE_LEGAL_READINESS.md` | Human-only checklist; no external action is marked complete without evidence. |

## Handoff gate

Before any package is shared, the package owner must record the exact source commit(s), deployed build or environment when relevant, evidence cut-off, intended recipient, review date, redactions, and approvals; resolve or explicitly accept every listed gap; verify every link and current claim; and use an approved secure transfer method for sensitive material.

Do not add secrets, tokens, private provider identifiers, personal phone numbers, contracts, legal advice, incident detail, or student data to this directory. A repository link establishes traceability only; it does not establish that a control operated in production.
