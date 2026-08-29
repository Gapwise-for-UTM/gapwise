# Institutional evidence and gap register

> **INTERNAL WORKSHEET — GAPS ARE INTENTIONAL AND MUST NOT BE SILENTLY REMOVED**

Use one entry per shareable artifact. A source link is traceability, not proof that a process operated. Sensitive evidence belongs in an approved access-controlled system, not Git.

## Artifact evidence and share gates

- **Product overview — AND-159:** [PRODUCT_OVERVIEW.md](PRODUCT_OVERVIEW.md). Authority: AND-159. The owner must verify exact claims, evidence cutoff, and intended audience before sharing. Share gate: owner approval.
- **Public Trust Center — `/trust`:** authority: AND-165 / AND-131. Revalidate the exact deployed build, links, and current cross-repository references. Share gate: owner/security/privacy review.
- **Security whitepaper and architecture — `gapwise-docs`:** authority: AND-164. Reconcile the exact published Security and Architecture revision with the deployed boundary. Share gate: security/privacy review.
- **Data and subprocessor inventory — `../TRUST_DATA_INVENTORY.md`:** authority: AND-156. Preserve every human/provider confirmation flag and refresh after processor or data-flow changes. Share gate: privacy/security review.
- **PIA, retention, and privacy workflows — `gapwise-docs/governance/privacy`:** authority: AND-157. Legal-policy drafts need human/legal approval wherever marked. Share gate: privacy/legal review.
- **Vulnerability disclosure — `SECURITY.md`, `/security`, and `/.well-known/security.txt`:** authority: AND-163. Capture exact production reachability and the reviewed deployed commit before institutional reliance. Share gate: security review.
- **Incident response — `../INCIDENT_RESPONSE.md`:** authority: AND-158. Named roles/private channels and actual exercise evidence remain separate from the runbook. Share gate: security/privacy/owner review.
- **Business continuity and disaster recovery — `../DISASTER_RECOVERY.md`:** authority: AND-154 for exercise state. Actual backup, off-site storage, disposable restore, and KEK recovery evidence must come from retained execution evidence. Share gate: operations/owner review.
- **Accessibility — `/accessibility`, `../ACCESSIBILITY_MATRIX.md`, and `../ACCESSIBILITY_CONFORMANCE_WORKSHEET.md`:** authority: AND-162. Manual assistive-technology evidence and a private accessibility contact remain gaps; no certification is claimed. Share gate: accessibility/owner review.
- **AI/MCP permissions — developer/security docs plus `gapwise-ai`:** authority: AND-113 / AND-164 inputs. Exact-head cross-repository delegated-data and permission reconciliation is required. Share gate: security/privacy review.
- **CI/security snapshot — [CI_SECURITY_EVIDENCE.md](CI_SECURITY_EVIDENCE.md):** authority: package preparer. Capture exact commit, runs, results, and redactions; green checks are not audit evidence. Share gate: engineering review.
- **Independent penetration test:** no assessment is claimed. Authority: owner plus a qualified independent assessor. Authorized scope, assessor independence, report, remediation, and retest evidence are still required. Share gate: independent assessment.
- **Legal, DPA, trademark, and insurance — checklist only:** authority: AND-161 / owner/counsel. Legal positions, entity/authority, insurance, and university-relationship facts are human-only. Share gate: legal/owner review.
- **Contacts and escalation — role-only matrix:** authority: owner. Named accountable contacts, private channels, staffing/coverage, and operability tests require owner evidence. Share gate: owner review.
- **Transparency reporting — annual and periodic templates:** authority: AND-160. Reliable measurement systems and review are required before publishing numbers. Share gate: owner/privacy/security review.

## External evidence attachment record

For each external evidence item, record only a non-sensitive evidence ID, description, date or range, source/custodian, sensitivity classification, integrity/reference information, and reviewer decision. Do not record secrets, private account identifiers, contracts, student data, or other sensitive source material here.

## Rule for gaps

A gap may be closed only by evidence that supports the exact statement. Do not close a legal, provider, or operational gap because code exists, a CI job is green, or a template was written. When evidence expires or scope changes, reopen the gap.
