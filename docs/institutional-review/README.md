# Gapwise institutional review package

> **INTERNAL WORKING MATERIAL — NOT APPROVED FOR PUBLICATION OR CONTRACTUAL RELIANCE**

This directory is the Phase 8 institutional-review package for AND-159. It is an evidence map and preparation workspace, not proof of University of Toronto review, legal approval, certification, insurance, an audit, or a penetration test.

## Status vocabulary

- **Repository evidence** — a statement can be checked against linked current source. It is not independent assurance or proof that the control operated in production.
- **Process draft** — a proposed internal process that has not been demonstrated through an incident or exercise.
- **Pending merge** — work exists in an open reviewed PR but is not yet current `main`.
- **Human confirmation** — a person with access to external accounts, contracts, organizational facts, or real-world evidence must confirm it.
- **Legal review** — counsel or an authorized owner must review the statement before reliance or publication.
- **Independent assessment required** — evidence must come from a qualified party independent of implementation work.

## Package index

- **One-page product overview:** [PRODUCT_OVERVIEW.md](PRODUCT_OVERVIEW.md). Repository evidence; owner approval and intended-recipient review remain pending.
- **Security whitepaper:** Gapwise security whitepaper in `andrewmuratov/gapwise-docs`. Phase 3 / AND-164 is complete; re-check the exact published revision before sharing.
- **Architecture/data-flow diagram:** Gapwise security architecture package in `gapwise-docs`. Phase 3 is complete; validate exact boundaries against current production configuration before sharing.
- **Data inventory and subprocessors:** AND-156 evidence-backed trust inventory. Phase 1 is complete; provider jurisdiction or contract facts still marked for human/provider confirmation must remain qualified.
- **PIA, retention, and privacy workflows:** AND-157 privacy-governance package. Phase 5 is complete; legal-policy drafts remain drafts until approved.
- **Vulnerability disclosure and `security.txt`:** core PR #184 and `SECURITY.md`. Pending merge; public reachability is not established until merged and deployed.
- **Incident response and BC/DR:** [EVIDENCE_REGISTER.md](EVIDENCE_REGISTER.md), core PR #185, and `../DISASTER_RECOVERY.md`. Phase 6 is pending merge; actual backup/restore evidence remains authoritative in AND-154.
- **Accessibility statement/evidence:** `../ACCESSIBILITY_MATRIX.md` plus Phase 7 / AND-162. Accessibility governance remains in progress; no formal conformance or third-party certification is claimed.
- **AI/MCP permission model:** `../DEVELOPER_PLATFORM.md`, security docs, and `andrewmuratov/gapwise-ai`. Exact-head cross-repository reconciliation is required before institutional sharing.
- **CI/security snapshot:** [CI_SECURITY_EVIDENCE.md](CI_SECURITY_EVIDENCE.md). Capture worksheet only; green CI or scanners are not independent assurance.
- **Independent penetration test:** [PENETRATION_TEST_READINESS.md](PENETRATION_TEST_READINESS.md). Independent assessment required; no test or result is claimed.
- **CAIQ/SIG-style preparation:** [QUESTIONNAIRE_PREPARATION.md](QUESTIONNAIRE_PREPARATION.md). Preparation worksheet only, not an official questionnaire response.
- **DPA/security addendum and U of T marks:** [LEGAL_AND_AFFILIATION_CHECKLIST.md](LEGAL_AND_AFFILIATION_CHECKLIST.md). Legal review and human confirmation remain required; no approved relationship or contractual position is claimed.
- **Contact/escalation matrix:** [CONTACT_ESCALATION_MATRIX.md](CONTACT_ESCALATION_MATRIX.md). Role-based internal template; named or staffed private channels require owner confirmation.

## Handoff gate

Before any package is shared, the package owner must record the exact source commits, evidence cut-off, intended recipient, review date, redactions, and approvals; resolve or explicitly accept each listed gap; verify every link and current claim; and use an approved secure transfer method for sensitive material.

Do not add secrets, tokens, private provider identifiers, personal phone numbers, contracts, legal advice, incident detail, or student data to this directory. A repository link establishes traceability only; it does not establish that a control operated in production.
