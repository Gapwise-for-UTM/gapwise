# Gapwise Trust & Transparency Report — annual template

> **Template — not a published report.** Replace every placeholder with reviewed evidence before publication. Never interpret a blank field as zero.

## Document control

Record the reporting period, publication date, report owner, evidence cut-off, included services/environments/populations, material exclusions, previous-report link, approval record, and corrections contact.

## Publication rules

1. This report is an evidence summary, not a certification, audit, legal conclusion, or University of Toronto affiliation claim.
2. Publish a number, including **zero**, only when a documented counting process covered the entire stated period and scope. Otherwise use **Not measured**, **Partial coverage**, **Not publishable**, or **Not applicable** with an explanation.
3. Define each counted event, its system of record, coverage, deduplication rule, and responsible reviewer.
4. Distinguish occurrence date, discovery date, report date, and closure date. State which date assigns an item to the reporting period.
5. Corrections must retain the earlier value, reason, approver, and correction date.
6. Complete the publication checklist before release.

Metric reporting states are:

- **Measured** — complete, tested records cover the stated period and scope. Publish the definition, source, coverage, and result.
- **Partial coverage** — reliable records cover only part. State exact coverage and omissions and do not extrapolate.
- **Not measured** — no reliable counting process existed. State the missing prerequisite and proposed owner.
- **Not publishable** — a count exists but disclosure is restricted or unsafe. Give an approved high-level reason.
- **Not applicable** — the category genuinely cannot apply. Record the rationale and reviewer.

Section-specific non-metric outcomes may also be required where a numeric metric state would be misleading:

- **No reliably reportable conclusion** — the authoritative inventory/change record does not cover the full period, so neither a positive claim nor “no changes” is supported.
- **Performed and verified** — an independent assessment actually occurred and its independence, assessor, scope, dates, method, result, limitations, and publication permission were verified.
- **None claimed** — no independent assessment is being represented as performed for the period.

## Executive summary

- **What changed:** `[evidence-backed summary]`
- **What users should know or do:** `[action, or reviewed “No user action identified”]`
- **Material limitations:** `[measurement gaps and unresolved risks]`
- **Next-period priorities:** `[commitments below]`

## Reporting scope and methodology

Describe product surfaces, production/support systems, user/geographic scope, dates, exclusions, and ownership changes.

For every evidence set record its system of record, coverage, quality or reconciliation check, owner, and internal reference. Internal references are for restricted preparation only and must not be published in the public report. When a public statement requires an external citation, release only with a reviewed canonical public source that supports the exact claim. For every metric record its definition and inclusion rules, period-assignment rule, data source, coverage, deduplication/validation method, result or reporting state, and reviewer.

## Security incidents

**Measurement prerequisite:** a maintained security-incident register, common classification rules, period boundaries, and reconciliation against every operational intake channel in scope.

**Reporting state:** `[Measured / Partial coverage / Not measured / Not publishable / Not applicable]`

Define “security incident,” state coverage, and report only validated totals. Summarize material incidents at a safe level without exploit-enabling detail.

## Privacy incidents

**Measurement prerequisite:** a maintained privacy-incident register, defined privacy-event taxonomy, and review of designated complaint/escalation channels.

**Reporting state:** `[state]`

Summarize substantiated events and response. Do not assert that an event was or was not a legally defined breach without appropriate human/legal review.

## Responsibly disclosed vulnerabilities

**Measurement prerequisite:** a disclosure intake register recording unique reports, duplicates, validation outcome, severity method, acknowledgements, and remediation status across every published channel.

Report unique reports received, validated vulnerabilities, duplicate or previously known reports, and items remediated during the period only when the prerequisite is met. Define each population and whether remediation can include findings received in an earlier period.

## Remediation metrics

**Measurement prerequisite:** timestamped, consistently classified work items linked to validated findings with documented pause, reopen, and closure rules.

If the prerequisite is met, report time to triage, time to containment, time to remediation, and open findings by severity with units, population, sample size, statistic, clock rules, and verification-of-fix definition. Do not present targets as measured performance.

## Availability and outages

**Measurement prerequisite:** reliably retained telemetry, a documented service boundary and availability formula, maintenance/exclusion rules, time-zone handling, and an outage register reconciled to the interval.

**Reporting state:** `[state]`

If measured, identify service indicators, exact coverage, formula, exclusions, and outage summaries. Never derive historical uptime from memory or incomplete provider history.

## Account and data deletion requests

**Measurement prerequisite:** a privacy-preserving request register spanning all designated intake channels, with request-type definitions, duplicate handling, identity-verification status, completion evidence, and retention rules for the register itself.

**Reporting state:** `[state]`

Keep self-service account deletion distinct from support requests unless the counting method intentionally includes both.

## Legal and government requests

**Measurement prerequisite:** a complete request register, defined categories, duplicate/supplement rules, and human/legal confirmation that aggregate publication is accurate and permitted.

**Reporting state:** `[state]`

Publish only reviewed aggregates. Do not infer zero from an informal inbox search.

## Subprocessor changes

For every addition, removal, or material change record the service, effective date, affected data categories and purpose, user impact, evidence status, and any remaining provider/human confirmation. State **No reliably reportable conclusion** rather than “no changes” when no complete inventory/change record covers the period.

## Security, privacy, and accessibility improvements

List only shipped or completed work linked to implementation, configuration, test, review, or execution evidence appropriate to the claim. A runbook, checklist, template, plan, issue, or policy alone is not evidence that a drill, restore, notification, review, external process, or other operational activity was completed. For every item record the area, specific improvement, completion or release date, evidence, and remaining limitation or follow-up.

Accessibility testing is not certification. State methods, scope, and limitations.

## AI and MCP permission changes

For every permission change record the effective date, permission or data boundary affected, user control or migration, and code/contract/test/review evidence. Do not label browser-encrypted private state as end-to-end encrypted or zero knowledge and do not imply planned permissions are available.

## Independent assessments

Include an assessment only after it was actually performed and the assessor, scope, date, method, publishable result, limitations, and permission to publish were verified. Procurement questionnaires, self-assessments, automated scans, internal reviews, and penetration-test plans are not independent assessments.

**Reporting state:** `[Performed and verified / None claimed / Not publishable]`

Never imply SOC 2, ISO 27001, VPAT certification, or another certification or audit without exact current independent evidence.

## Major policy revisions

For every effective policy revision record the policy, effective date, material change, user action if any, and canonical version/history. Draft language requiring human/legal review is not effective policy.

## Next-period commitments

Commitments are targets, not completed controls or guarantees. For each commitment record the intended outcome, owner, target window, observable success evidence, dependency or risk, and status-reporting path.

## Known gaps and measurement prerequisites

For each gap record the topic, current reporting state, missing instrumentation/process/review prerequisite, accountable owner or `unassigned`, and target review date or `not scheduled`.

## Corrections and methodology changes

For every correction retain the publication and correction dates, affected statement, earlier presentation, corrected presentation, reason and impact, and approver. Use “No corrections published” only after a reviewer checks the period; never silently overwrite a material earlier statement.

## Publication checklist

- [ ] Reporting scope, boundaries, cut-off, owner, and exclusions are explicit.
- [ ] Every number has a metric definition and full-period coverage, or is labelled partial without extrapolation.
- [ ] Every zero is supported by a tested counting process covering the stated period and scope.
- [ ] Incident, vulnerability, request, and outage registers were reconciled to all designated intake sources.
- [ ] Security-sensitive and personal information were removed from public text.
- [ ] Legal or government-request wording received appropriate human/legal review.
- [ ] Independent-assessment and certification statements match actual evidence and scope.
- [ ] Improvements are complete; unfinished work appears only as a commitment.
- [ ] Any claimed drill, restore, notification, review, external process, or other completed operational action has retained execution evidence rather than only a runbook, checklist, template, plan, issue, or policy.
- [ ] Subprocessor and AI/MCP changes were reconciled against authoritative inventories and change records.
- [ ] Accessibility claims identify methods, scope, and limitations.
- [ ] Policy links, dates, and revision histories were checked.
- [ ] Corrections and methodology changes are disclosed.
- [ ] A final reviewer checked that the report does not imply U of T affiliation.
- [ ] The approved report is retained so later corrections and year-over-year comparison remain possible.
