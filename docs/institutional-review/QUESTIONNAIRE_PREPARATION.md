# CAIQ/SIG-style questionnaire preparation worksheet

> **INTERNAL PREPARATION ONLY — NOT A COMPLETED OR OFFICIAL CAIQ OR SIG RESPONSE**

Answers below are scoped to repository evidence. `Not established` means this package cannot support an answer; it does not mean a control is absent or present. An authorized reviewer must map these topics to the current questionnaire supplied by the requesting institution.

| Topic | Preparation answer | Evidence / authority | Limitation / next action |
| --- | --- | --- | --- |
| Service description | Independent UTM student timetable/campus-planning web app with guest and optional account features. | [PRODUCT_OVERVIEW.md](PRODUCT_OVERVIEW.md) | Owner approval and intended institutional use unconfirmed. |
| Data minimization | Original `.ics` parsing is browser-local under the current product contract. | `../TRUST_DATA_INVENTORY.md`; privacy/platform docs | Re-verify exact deployed implementation before answering externally. |
| Authentication | Optional account authentication uses Supabase Auth with user-selected Google, Microsoft, or GitHub providers. | auth/platform source | Production provider configuration requires authorized dashboard evidence. |
| Private-state protection | Optional private cloud state uses browser-side encryption within the documented trust model. | trust inventory; security architecture | Not E2EE/zero knowledge; no independent cryptographic assessment claimed. |
| Tenant authorization | Repository migrations/tests document row/account isolation controls. | security control evidence | Repository tests are not production/independent evidence. |
| Secure development | CI, code review, tests, dependency/security checks, and update automation exist. | [CI_SECURITY_EVIDENCE.md](CI_SECURITY_EVIDENCE.md) | Capture exact current run/settings; green CI is not an audit. |
| Vulnerability reporting | Public policy, private GitHub advisory intake, and canonical `security.txt` are implemented. | `SECURITY.md`, `/security`, `/.well-known/security.txt` | Capture exact deployed reachability/current commit for handoff. |
| Incident management | Internal runbook covers severity, triage, containment, escalation, notification decisions, recovery, and postmortem preparation. | `../INCIDENT_RESPONSE.md` | No exercised response SLA or incident-history claim; named roles/channels require evidence. |
| Continuity/recovery | Recovery procedures and limitations are documented. | `../DISASTER_RECOVERY.md`, AND-154 evidence | No RTO/RPO or successful real restore should be asserted without retained exercise evidence. |
| Accessibility | Public statement plus automated regression evidence and an internal criterion worksheet exist. | `/accessibility`, `../ACCESSIBILITY_MATRIX.md`, `../ACCESSIBILITY_CONFORMANCE_WORKSHEET.md` | No blanket WCAG conformance, manual screen-reader pass, VPAT certification, or independent assessment claimed. |
| Subprocessors/residency | Structured inventory identifies runtime services and explicitly marked unknowns. | `../TRUST_DATA_INVENTORY.md` | Preserve every provider/legal/residency confirmation flag from authority. |
| Retention/deletion/privacy governance | Governance package and account/cloud deletion controls exist. | `gapwise-docs/governance/privacy`; core account source | Legal-policy drafts remain drafts until approved; provider operations may require external evidence. |
| AI/MCP permissions | Permissioned opt-in model exists and is separated from public API/private account state. | core AI contract + `gapwise-ai`/developer docs | Exact-head cross-repo reconciliation required before external answer. |
| Public trust summary | `/trust` links the principal evidence surfaces and states unresolved gaps. | AND-165 / AND-131 | Revalidate exact deployed build and links. |
| Transparency reporting | Annual and periodic evidence-disciplined templates exist. | AND-160 templates | Templates are not measured reporting history; unknown statistics cannot be published as zero. |
| Independent assurance/certifications | None claimed. | [PENETRATION_TEST_READINESS.md](PENETRATION_TEST_READINESS.md) | Never infer SOC 2, ISO 27001, audit, certification, or pen-test status. |
| Legal/compliance positions | Not established; checklist only. | [LEGAL_AND_AFFILIATION_CHECKLIST.md](LEGAL_AND_AFFILIATION_CHECKLIST.md), `../ADMINISTRATIVE_LEGAL_READINESS.md` | Counsel/authorized owner must answer jurisdiction/contract questions. |

## Response provenance fields

- Questionnaire name, owner, and version: _Pending_
- Requesting institution and intended use: _Pending_
- Service scope/environment: _Pending_
- Evidence cutoff date and source commits: _Pending_
- Answer preparer and accountable approver: _Pending_
- Legal/privacy/security approvals: _Pending_
- Accepted gaps and expiry/review date: _Pending_

Do not copy preparation text into a contractual questionnaire without reviewing the exact question, scope, evidence date, and consequences of the answer.
