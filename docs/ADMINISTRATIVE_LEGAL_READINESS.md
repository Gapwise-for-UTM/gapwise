# Administrative and legal readiness checklist

> **INTERNAL — HUMAN-ONLY / NOT VERIFIED**
>
> This is an evidence register and handoff checklist for administrative, legal, tax, insurance, provider, and university work that cannot be completed from the repository. It is not legal, tax, accounting, insurance, or procurement advice. The repository does not establish that any item below has been completed.

## Non-negotiable operating rules

1. Every item starts and remains **NOT VERIFIED** until an authorized human reviews evidence.
2. A checked Markdown box is not proof. Change an item to **EVIDENCE REVIEWED** only after recording an evidence-register ID, reviewer, and review date.
3. Store sensitive records in an owner-approved restricted system, not Git. Record only a non-sensitive locator and redacted summary here.
4. Repository automation must not submit filings, accept legal/provider terms, purchase insurance or services, represent Gapwise to the University, or make compliance/certification claims.
5. Re-open an item when evidence expires, the business/product changes, a procurement request creates new requirements, or a responsible professional requests re-review.

### Allowed status values

| Status | Meaning |
| --- | --- |
| **NOT VERIFIED** | No sufficient evidence has been reviewed. Default state. |
| **HUMAN-ONLY — ACTION REQUIRED** | A named human or external professional must act or decide. |
| **WAITING ON THIRD PARTY** | An authorized request was sent; outcome is not verified. |
| **EVIDENCE REVIEWED** | An authorized human reviewed cited evidence for the narrow statement recorded. Not a general compliance claim. |
| **NOT APPLICABLE — EVIDENCE REVIEWED** | An authorized professional documented why the item does not apply and defined a review trigger. |

## Evidence register

Do not place government identifiers, bank details, contracts, legal advice, insurance documents, personal contact details, penetration-test reports, or university correspondence in this file.

| Evidence ID | Topic | Restricted locator | Redacted fact supported | Evidence date / expiry | Reviewed by / role | Review date | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| _None_ | — | — | No evidence has been reviewed for this checklist. | — | — | — | **NOT VERIFIED** |

## Responsibility and escalation record

| Responsibility | Required human confirmation | Primary / backup locator | Accepted date | Review trigger | Status |
| --- | --- | --- | --- | --- | --- |
| Business/corporate administration | Owner accepts accountability and identifies lawyer/corporate-services support if used. | **NOT VERIFIED** | — | annual; entity/ownership change | **HUMAN-ONLY — ACTION REQUIRED** |
| Tax/accounting | Owner identifies accountant/bookkeeper and revenue/deadline monitoring responsibility. | **NOT VERIFIED** | — | revenue/entity/jurisdiction change | **HUMAN-ONLY — ACTION REQUIRED** |
| Privacy | Person accepts intake, triage, recordkeeping, escalation, absence coverage, and counsel/provider coordination. | **NOT VERIFIED** | — | personnel/data-flow/policy change | **HUMAN-ONLY — ACTION REQUIRED** |
| Security | Person accepts vulnerability/incident intake, evidence handling, provider escalation, and absence coverage. | **NOT VERIFIED** | — | personnel/architecture/provider change | **HUMAN-ONLY — ACTION REQUIRED** |
| Institutional/procurement | Owner identifies who may communicate externally and their authority. | **NOT VERIFIED** | — | before institutional discussion/contracting | **HUMAN-ONLY — ACTION REQUIRED** |

One person may hold multiple roles, but the duties and backup coverage must be explicitly accepted. A published inbox alone is not evidence that responsibility is staffed.

## 1. Ontario registration status

- [ ] **HUMAN-ONLY / NOT VERIFIED — Owner + appropriate Ontario legal/registration professional:** identify the actual operating structure and determine whether business-name registration, incorporation, extra-provincial registration, or another registration is required.
- [ ] Record only the narrow reviewed conclusion, jurisdictions, effective/expiry dates, renewal owner, and evidence IDs.
- [ ] Re-review before changing operating name, ownership, legal structure, home jurisdiction, or jurisdictions served.

**Current status: NOT VERIFIED.**

## 2. Corporate records and annual filings, if applicable

- [ ] Determine whether an entity exists and which corporate-record, beneficial-ownership, address, director/officer, annual-return, renewal, and other obligations apply.
- [ ] If applicable, establish a restricted records location, deadline calendar, responsible person, backup, and professional escalation path.
- [ ] If not applicable, retain the reviewed basis and future trigger; do not silently mark complete.

**Current status: NOT VERIFIED.**

## 3. Separate banking and accounting readiness

- [ ] Owner/accountant/financial institution determine whether and when a separate business account is appropriate and what documentation is required.
- [ ] Define bookkeeping categories, receipt retention, reconciliation cadence, spending authority, reimbursement process, and year-end handoff suitable for the confirmed structure.
- [ ] Keep credentials, account numbers, statements, and transaction records out of Git.

**Decision gate:** resolve before institutional funds, material business spending, or a paid contract. **Current status: NOT VERIFIED.**

## 4. GST/HST and tax-accounting handoff

- [ ] Accountant determines which revenues count, which current registration/filing rules apply, and whether any voluntary or mandatory action is appropriate.
- [ ] Owner provides complete dated revenue records and upcoming business-model changes.
- [ ] Establish a monitoring cadence, calculation owner, warning trigger, escalation deadline, and accountant handoff package.
- [ ] Do not encode a tax threshold in this checklist as a substitute for current professional advice.

**Review triggers:** revenue, pricing, sponsorship, grant, paid contract, entity, customer-location, or tax-rule change. **Current status: NOT VERIFIED.**

## 5. Intellectual-property ownership and assignments

- [ ] Inventory founders, employees, contractors, contributors, commissioned assets, datasets, fonts, third-party code, and AI-assisted material relevant to Gapwise.
- [ ] Appropriate IP counsel confirms whether assignments, licences, moral-rights treatment, contributor terms, or approvals are required and whether they cover past/future work.
- [ ] Reconcile reviewed conclusions with `LICENSE`, `THIRD_PARTY_NOTICES.md`, dependency notices, and attribution without placing agreements in Git.

**Decision gate:** before licensing, investment, asset transfer, or a contract containing IP warranties. **Current status: NOT VERIFIED.**

## 6. Canadian trademark consideration

- [ ] Owner + Canadian trademark professional decide whether to conduct clearance searches for Gapwise names/marks and which goods/services, jurisdictions, variants, domains, and common-law uses require review.
- [ ] Separately decide whether any application is justified, who would own it, and what monitoring/renewal obligations follow.
- [ ] Do not treat a domain, repository name, corporate-name search, or automated search as clearance, registration, ownership, or permission to use.
- [ ] Repository automation must not file a trademark application or characterize an unreviewed search as a legal conclusion.

**Current status: NOT VERIFIED.**

## 7. University of Toronto names, marks, and affiliation

- [ ] Owner + counsel review product copy, domains, metadata, screenshots, logos, campus references, and institutional material for trademark, passing-off, endorsement, and affiliation concerns.
- [ ] Preserve the product guardrail: Gapwise is independent and must not claim U of T/UTM approval, endorsement, partnership, or official status without a written relationship and authorized wording.
- [ ] Do not use university crests, official wordmarks, seals, confusing visual identity, or informal comments as implied permission.
- [ ] Only an authorized owner representative may contact the University about a relationship and must stay within their actual authority.

**Current status: NOT VERIFIED.**

## 8. Insurance before institutional contracting

- [ ] Owner + licensed broker/insurer + counsel assess cyber/privacy, technology E&O/professional liability, commercial general liability, and any other coverage against actual operations and proposed contract requirements.
- [ ] Review limits, exclusions, deductibles, territory, retroactive dates, incident/vendor conditions, defence costs, notification duties, and proof requirements.
- [ ] Do not purchase, bind, renew, cancel, or claim coverage through repository work.

**Decision gate:** before signing an institutional contract or saying insurance exists. **Current status: NOT VERIFIED.**

## 9. DPA and security-addendum review

- [ ] Counsel + privacy/security contacts review every proposed DPA, privacy schedule, security addendum, questionnaire, audit right, incident-notice term, retention/deletion duty, data-location term, subprocessor restriction, indemnity, and flow-down obligation against current evidence.
- [ ] Classify each response as implementation-verified, a future commitment, or unresolved and identify its evidence owner.
- [ ] Do not accept terms, promise unsupported controls/deadlines, invent provider terms/residency, or claim certification from a template response.

**Decision gate:** legal, technical, and owner approval before acceptance/signature. **Current status: NOT VERIFIED.**

## 10. CASL readiness if marketing email is introduced

- [ ] Before promotional/marketing email, owner + appropriate Canadian counsel/privacy contact classify the messages and determine current consent, identification, unsubscribe, recordkeeping, and service-provider requirements.
- [ ] Design evidence for consent source/scope/version/timestamp, withdrawals, suppression, message copy, and unsubscribe processing using data minimization.
- [ ] Test the approved unsubscribe/suppression process before sending and assign monitoring/escalation ownership.
- [ ] Do not send marketing email merely because this checklist exists.

**Current product gate:** no marketing-email program is verified by this file. **Current status: NOT VERIFIED.**

## 11. Independent penetration-test planning

- [ ] Security contact + owner/procurement lead define trigger, scope, budget, qualified independent assessor criteria, rules of engagement, authorization, production-data protections, emergency-stop path, report handling, retest expectations, and disclosure constraints.
- [ ] Include web/API/auth/tenant-isolation/browser-encrypted-state/deployment/optional-AI boundaries only when safely and explicitly authorized.
- [ ] Track findings/remediation in a restricted system. An automated scan, internal review, researcher report, or AI assessment is not an independent penetration test.
- [ ] Do not state that Gapwise is independently tested until a qualified independent engagement is completed and its evidence/publishable wording are reviewed.

**Current status: NOT VERIFIED.**

## 12. SOC 2 / ISO 27001 decision gate

- [ ] Owner + security/privacy + appropriate legal/assurance advisers capture the exact procurement demand, accepted alternatives, scope, timeline, continuing staffing, and total cost before considering a readiness/certification program.
- [ ] Evaluate only when credible procurement demand justifies ongoing cost and operational burden.
- [ ] Distinguish readiness work, self-assessment, consulting, audit/examination, report type/scope/period, and certification.
- [ ] Do not use badges or claim SOC 2, ISO 27001, audit, certification, or compliance without current independent evidence and approved wording.

**Current decision:** no evidence-backed procurement demand or certification is recorded here. **Current status: NOT VERIFIED.**

## 13. U of T information-risk/privacy review preparation

- [ ] Institutional contact + privacy/security contacts assemble a dated, redacted package only when an authorized University review path and recipient are confirmed.
- [ ] Prepare current scope, independence statement, architecture/data flow, data inventory, retention/deletion behavior, subprocessors, access controls, incident/vulnerability processes, accessibility evidence, AI/MCP boundaries, open gaps, and owner-approved contact/escalation matrix.
- [ ] Validate every claim against current code/configuration, provider evidence, or explicit human confirmation immediately before sharing.
- [ ] Do not contact U of T/UTM as if authorized, submit confidential material to an unverified recipient, or present preparation as review/approval/endorsement/procurement acceptance.

**Decision gate:** owner authorization, recipient verification, legal/privacy review, and secure-transfer plan. **Current status: NOT VERIFIED.**

## 14. Named privacy and security duties

- [ ] Owner assigns and obtains explicit acceptance for the privacy and security responsibilities in the responsibility table.
- [ ] Confirm monitored intake channels, least-privilege access, backup coverage, absence handoff, secure record locations, escalation rules, provider/counsel contacts, and periodic exercise/review dates.
- [ ] Privacy duties include request/complaint intake, identity-safe handling, decision records, policy/data-flow review, and incident coordination.
- [ ] Security duties include vulnerability intake, incident triage, evidence preservation, credential/provider escalation, remediation tracking, and approved communications.
- [ ] Publish contact information or response targets only after the responsible person accepts them and operations can support them.

**Current status: NOT VERIFIED.**

## Review cadence and change control

A human owner should schedule at least an annual review, or another cadence required by the relevant professional. Review sooner when Gapwise introduces revenue, marketing email, personnel/contractors, a new entity/jurisdiction, a new data use/provider, an institutional proposal, or a material security/privacy change.

For each review:

1. create a new review-record row;
2. verify evidence access/freshness without committing sensitive content;
3. update affected items and cite evidence IDs;
4. record unresolved questions with human owner/date;
5. obtain required professional decisions before external action; and
6. review public claims separately—this internal checklist is not publication approval.

| Review date | Reviewer / role | Scope and evidence IDs | Decisions changed | Open HUMAN-ONLY actions / owner / target | Next review | Status |
| --- | --- | --- | --- | --- | --- | --- |
| _Not reviewed_ | — | — | — | All checklist areas / owner **NOT VERIFIED** / no target | **NOT SCHEDULED** | **NOT VERIFIED** |

## External-action stop checklist

Before a filing, application, contract acceptance, insurance purchase, marketing send, penetration test, certification engagement, or University communication, the authorized human must separately confirm and retain evidence that:

- [ ] their identity and authority are documented;
- [ ] the correct entity, jurisdiction, recipient, scope, and current terms are verified;
- [ ] required lawyer/accountant/broker/provider/security/privacy review is complete;
- [ ] costs, deadlines, renewals, recordkeeping, and ongoing obligations have a named owner and backup;
- [ ] no unsupported compliance, certification, insurance, affiliation, or approval claim will be made; and
- [ ] sensitive evidence will remain outside Git and be shared only through an approved channel.

Every box above is currently unchecked and **NOT VERIFIED**. Repository changes alone cannot satisfy this stop checklist.
