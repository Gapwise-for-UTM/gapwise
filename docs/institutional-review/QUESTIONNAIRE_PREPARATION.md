# CAIQ/SIG-style questionnaire preparation worksheet

> **INTERNAL PREPARATION ONLY — NOT A COMPLETED OR OFFICIAL CAIQ OR SIG RESPONSE**

Answers below are scoped to repository evidence. `Not established` means this package cannot support an answer; it does not mean a control is absent or present. An authorized reviewer must map these topics to the current questionnaire supplied by the requesting institution.

| Topic | Preparation answer | Evidence / authority | Limitation / next action |
| --- | --- | --- | --- |
| Service description | Independent UTM student timetable/campus-planning web app with guest and optional account features. | [PRODUCT_OVERVIEW.md](PRODUCT_OVERVIEW.md) | Owner approval and intended institutional use unconfirmed. |
| Data minimization | Original `.ics` parsing is browser-local under the current product contract. | AND-156; privacy/platform docs | Re-verify exact deployed implementation before answering externally. |
| Authentication | Optional account authentication uses Supabase Auth. | platform/security docs | Production provider configuration requires authorized dashboard evidence. |
| Private-state protection | Optional private cloud state uses browser-side encryption within the documented trust model. | Phase 3 security architecture | Not E2EE/zero knowledge; no independent cryptographic assessment claimed. |
| Tenant authorization | Repository migrations/tests document row/account isolation controls. | security control evidence | Repository tests are not production/independent evidence. |
| Secure development | CI, code review, tests, dependency/security checks, and update automation exist. | [CI_SECURITY_EVIDENCE.md](CI_SECURITY_EVIDENCE.md) | Capture exact current run/settings; green CI is not an audit. |
| Vulnerability reporting | Repository policy exists and public/security.txt implementation is in PR #184. | AND-163 | Pending exact-head merge/deployment validation. |
| Incident management | Runbook implementation is in PR #185. | AND-158 | Pending exact-head merge; no exercised response SLA or incident-history claim. |
| Continuity/recovery | Recovery procedures and limitations are documented. | `../DISASTER_RECOVERY.md`, AND-154 | No RTO/RPO or successful real restore should be asserted without AND-154 evidence. |
| Accessibility | Automated regression evidence exists; Phase 7 governance remains in progress. | `../ACCESSIBILITY_MATRIX.md`, AND-162 | No formal conformance/VPAT/independent assessment claimed. |
| Subprocessors/residency | Structured inventory completed. | AND-156 | Preserve every provider/legal/residency confirmation flag from authority. |
| Retention/deletion/privacy governance | Governance package completed. | AND-157 | Legal-policy drafts remain drafts until approved; provider operations may require external evidence. |
| AI/MCP permissions | Permissioned model exists. | developer/security docs + `gapwise-ai` | Exact-head cross-repo reconciliation required before external answer. |
| Transparency reporting | Annual/periodic templates are in PR #186. | AND-160 | Templates are not measured reporting history. |
| Independent assurance/certifications | None claimed. | [PENETRATION_TEST_READINESS.md](PENETRATION_TEST_READINESS.md) | Never infer SOC 2, ISO 27001, audit, certification, or pen-test status. |
| Legal/compliance positions | Not established; checklist only. | [LEGAL_AND_AFFILIATION_CHECKLIST.md](LEGAL_AND_AFFILIATION_CHECKLIST.md) | Counsel/authorized owner must answer jurisdiction/contract questions. |

## Response provenance fields

- Questionnaire name, owner, and version: _Pending_
- Requesting institution and intended use: _Pending_
- Service scope/environment: _Pending_
- Evidence cutoff date and source commits: _Pending_
- Answer preparer and accountable approver: _Pending_
- Legal/privacy/security approvals: _Pending_
- Accepted gaps and expiry/review date: _Pending_

Do not copy preparation text into a contractual questionnaire without reviewing the exact question, scope, evidence date, and consequences of the answer.
