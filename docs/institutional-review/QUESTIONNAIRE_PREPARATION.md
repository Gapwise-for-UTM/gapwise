# CAIQ/SIG-style questionnaire preparation worksheet

> **INTERNAL PREPARATION ONLY — NOT A COMPLETED OR OFFICIAL CAIQ OR SIG RESPONSE**

Answers below are scoped to repository evidence. `Not established` means this package cannot support an answer; it does not mean a control is absent or present. An authorized reviewer must map these topics to the current questionnaire supplied by the requesting institution.

## Preparation answers

- **Service description:** independent UTM student timetable and campus-planning web app with guest and optional account features. Evidence: [PRODUCT_OVERVIEW.md](PRODUCT_OVERVIEW.md). Owner approval and intended institutional use remain unconfirmed.
- **Data minimization:** original `.ics` parsing is browser-local under the current product contract. Evidence: AND-156 and privacy/platform docs. Re-verify the exact deployed implementation before answering externally.
- **Authentication:** optional account authentication uses Supabase Auth. Evidence: platform/security docs. Production provider configuration requires authorized dashboard evidence.
- **Private-state protection:** optional private cloud state uses browser-side encryption within the documented trust model. Evidence: Phase 3 security architecture. This is not an E2EE or zero-knowledge claim and no independent cryptographic assessment is claimed.
- **Tenant authorization:** repository migrations and tests document row/account isolation controls. Evidence: security-control materials. Repository tests are not production or independent evidence.
- **Secure development:** CI, code review, tests, dependency/security checks, and update automation exist. Evidence: [CI_SECURITY_EVIDENCE.md](CI_SECURITY_EVIDENCE.md). Capture exact current runs and settings; green CI is not an audit.
- **Vulnerability reporting:** repository policy exists and the public `security.txt` implementation is in PR #184. Authority: AND-163. Exact-head merge and deployment validation remain pending.
- **Incident management:** runbook implementation is in PR #185. Authority: AND-158. Exact-head merge remains pending; no exercised response SLA or incident-history claim is made.
- **Continuity and recovery:** procedures and limitations are documented in `../DISASTER_RECOVERY.md`. Actual exercise status is authoritative in AND-154. Do not assert an RTO/RPO or successful real restore without that evidence.
- **Accessibility:** automated regression evidence exists and Phase 7 governance remains in progress. Evidence: `../ACCESSIBILITY_MATRIX.md` and AND-162. No formal conformance, VPAT certification, or independent accessibility assessment is claimed.
- **Subprocessors and residency:** a structured inventory is complete under AND-156. Preserve every provider, legal, and residency confirmation flag from that authority.
- **Retention, deletion, and privacy governance:** governance package completed under AND-157. Legal-policy drafts remain drafts until approved; provider operations may require external evidence.
- **AI/MCP permissions:** a permissioned model exists. Evidence: developer/security docs and `gapwise-ai`. Exact-head cross-repository reconciliation is required before an external answer.
- **Transparency reporting:** annual and periodic templates are in PR #186 under AND-160. Templates are not measured reporting history.
- **Independent assurance or certifications:** none claimed. Evidence: [PENETRATION_TEST_READINESS.md](PENETRATION_TEST_READINESS.md). Never infer SOC 2, ISO 27001, audit, certification, or penetration-test status.
- **Legal and compliance positions:** not established; checklist only. Evidence: [LEGAL_AND_AFFILIATION_CHECKLIST.md](LEGAL_AND_AFFILIATION_CHECKLIST.md). Counsel or an authorized owner must answer jurisdiction and contract questions.

## Response provenance fields

Before a response is issued, record the questionnaire name, owner, and version; requesting institution and intended use; service scope and environment; evidence cut-off date and source commits; answer preparer and accountable approver; legal/privacy/security approvals; and accepted gaps with their expiry or review date.

Do not copy preparation text into a contractual questionnaire without reviewing the exact question, scope, evidence date, and consequences of the answer.
