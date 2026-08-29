# CAIQ/SIG-style questionnaire preparation worksheet

> **INTERNAL PREPARATION ONLY — NOT A COMPLETED OR OFFICIAL CAIQ OR SIG RESPONSE**

Answers below are scoped to repository evidence. `Not established` means this package cannot support an answer; it does not mean a control is absent or present. An authorized reviewer must map these topics to the current questionnaire supplied by the requesting institution.

## Preparation answers

- **Service description:** Gapwise is an independent UTM student timetable and campus-planning web app with guest and optional account features. Evidence: [PRODUCT_OVERVIEW.md](PRODUCT_OVERVIEW.md). Owner approval and intended institutional use remain unconfirmed.
- **Data minimization:** original `.ics` parsing is browser-local under the current product contract. Evidence: `../TRUST_DATA_INVENTORY.md` and privacy/platform documentation. Re-verify the exact deployed implementation before answering externally.
- **Authentication:** optional account authentication uses Supabase Auth with user-selected Google, Microsoft, or GitHub providers. Evidence: auth/platform source. Production provider configuration requires authorized dashboard evidence.
- **Private-state protection:** optional private cloud state uses browser-side encryption within the documented trust model. Evidence: trust inventory and security architecture. This is not an end-to-end-encryption or zero-knowledge claim, and no independent cryptographic assessment is claimed.
- **Tenant authorization:** repository evidence for account/tenant boundaries includes `../SECURITY_CONTROL_MATRIX.md`, `../../tests/private-cloud-api.test.ts`, `../../tests/friend-overlap.test.ts`, and `../../tests/security.test.ts`; the CI database-security gate separately exercises current RLS and deletion policies. Repository tests and CI are not production or independent assurance, and production-only settings still require external verification where applicable.
- **Secure development:** CI, code review, tests, dependency/security checks, and update automation exist. Evidence: [CI_SECURITY_EVIDENCE.md](CI_SECURITY_EVIDENCE.md). Capture exact current runs/settings; green CI is not an audit.
- **Vulnerability reporting:** a public policy and canonical `security.txt` are implemented. `../../SECURITY.md` makes GitHub private vulnerability reporting the preferred private intake when it is available; if it is unavailable, reporters are directed to contact the repository owner through the GitHub profile and request a private channel before sending exploit details. Capture exact deployed reachability/current commit for handoff.
- **Incident management:** `../INCIDENT_RESPONSE.md` covers severity, triage, containment, escalation, notification decisions, recovery, and postmortem preparation. No exercised response SLA or incident-history claim is made; named roles/channels require evidence.
- **Continuity and recovery:** recovery procedures and limitations are documented in `../DISASTER_RECOVERY.md`. Actual exercise status is authoritative in AND-154 evidence. Do not assert an RTO/RPO or successful real restore without retained execution evidence.
- **Accessibility:** a public statement, automated regression evidence, and an internal criterion worksheet exist. Evidence: `/accessibility`, `../ACCESSIBILITY_MATRIX.md`, and `../ACCESSIBILITY_CONFORMANCE_WORKSHEET.md`. No blanket WCAG conformance, manual screen-reader pass, VPAT certification, or independent accessibility assessment is claimed.
- **Subprocessors and residency:** the structured inventory identifies runtime services and explicitly marked unknowns. Evidence: `../TRUST_DATA_INVENTORY.md`. Preserve every provider/legal/residency confirmation flag from that authority.
- **Retention, deletion, and privacy governance:** a governance package and account/cloud deletion controls exist. Evidence: `gapwise-docs/governance/privacy` and core account source. Legal-policy drafts remain drafts until approved; provider operations may require external evidence.
- **AI/MCP permissions:** a permissioned opt-in model exists and is separated from public API/private account state. Evidence: core AI contract plus `gapwise-ai` and developer documentation. Exact-head cross-repository reconciliation is required before an external answer.
- **Public trust summary:** `/trust` links the principal evidence surfaces and states unresolved gaps. Authority: AND-165 / AND-131. Revalidate the exact deployed build and links.
- **Transparency reporting:** annual and periodic evidence-disciplined templates exist. Authority: AND-160. Templates are not measured reporting history; unknown statistics cannot be published as zero.
- **Independent assurance or certifications:** none are claimed. Evidence: [PENETRATION_TEST_READINESS.md](PENETRATION_TEST_READINESS.md). Never infer SOC 2, ISO 27001, audit, certification, or penetration-test status.
- **Legal and compliance positions:** not established; checklist only. Evidence: [LEGAL_AND_AFFILIATION_CHECKLIST.md](LEGAL_AND_AFFILIATION_CHECKLIST.md) and `../ADMINISTRATIVE_LEGAL_READINESS.md`. Counsel or an authorized owner must answer jurisdiction and contract questions.

## Response provenance fields

- Questionnaire name, owner, and version: _Pending_
- Requesting institution and intended use: _Pending_
- Service scope/environment: _Pending_
- Evidence cutoff date and source commits: _Pending_
- Answer preparer and accountable approver: _Pending_
- Legal/privacy/security approvals: _Pending_
- Accepted gaps and expiry/review date: _Pending_

Do not copy preparation text into a contractual questionnaire without reviewing the exact question, scope, evidence date, and consequences of the answer.
