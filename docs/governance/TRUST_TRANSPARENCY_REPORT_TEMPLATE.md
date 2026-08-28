# Gapwise Trust & Transparency Report — annual template

> **Template — not a published report.** Replace every placeholder with reviewed evidence before publication. Never interpret a blank field as zero.

## Document control

| Field | Required entry |
| --- | --- |
| Reporting period | `[start date, inclusive]` to `[end date, inclusive]` |
| Publication date | `[date after approval]` |
| Report owner | `[accountable person or role]` |
| Evidence cut-off | `[date/time/time zone]` |
| Scope | `[services, environments, populations included]` |
| Material exclusions | `[excluded surfaces/periods and why]` |
| Previous report | `[canonical link, or “First report” only when true]` |
| Approval record | `[reviewers and approval location]` |
| Corrections contact | `[maintained contact path]` |

## Publication rules

1. This report is an evidence summary, not a certification, audit, legal conclusion, or University of Toronto affiliation claim.
2. Publish a number, including **zero**, only when a documented counting process covered the entire stated period and scope. Otherwise use **Not measured**, **Partial coverage**, **Not publishable**, or **Not applicable** with an explanation.
3. Define each counted event, its system of record, coverage, deduplication rule, and responsible reviewer.
4. Distinguish occurrence date, discovery date, report date, and closure date. State which date assigns an item to the reporting period.
5. Corrections must retain the earlier value, reason, approver, and correction date.
6. Complete the publication checklist before release.

### Permitted reporting states

| State | Use when | Required accompanying text |
| --- | --- | --- |
| Measured | complete, tested records cover the period/scope | definition, source, coverage, result |
| Partial coverage | reliable records cover only part | exact coverage/omissions; no extrapolation |
| Not measured | no reliable counting process existed | missing prerequisite and proposed owner |
| Not publishable | a count exists but disclosure is restricted/unsafe | approved high-level reason |
| Not applicable | category genuinely cannot apply | rationale and reviewer |

## Executive summary

- **What changed:** `[evidence-backed summary]`
- **What users should know or do:** `[action, or reviewed “No user action identified”]`
- **Material limitations:** `[measurement gaps and unresolved risks]`
- **Next-period priorities:** `[commitments below]`

## Reporting scope and methodology

### Scope

`[Identify product surfaces, production/support systems, user/geographic scope, dates, exclusions, and ownership changes.]`

### Evidence and review

| Evidence set | System of record / source | Coverage | Quality check | Owner | Internal reference |
| --- | --- | --- | --- | --- | --- |
| `[example: incident register]` | `[source]` | `[dates/scope]` | `[reconciliation/sampling]` | `[role]` | `[non-public reference]` |

### Metric definition record

| Metric | Definition/inclusion rules | Period-assignment rule | Data source | Coverage | Deduplication/validation | Result or reporting state | Reviewer |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `[metric]` | `[what is/isn't counted]` | `[occurrence/discovery/report/closure]` | `[system of record]` | `[full/partial]` | `[method]` | `[value/state]` | `[role/date]` |

## Security incidents

**Measurement prerequisite:** maintained security-incident register, common classification rules, period boundaries, and reconciliation against every operational intake channel in scope.

**Reporting state:** `[Measured / Partial coverage / Not measured / Not publishable / Not applicable]`

`[Define “security incident,” state coverage, and report only validated totals. Summarize material incidents at a safe level without exploit-enabling detail.]`

## Privacy incidents

**Measurement prerequisite:** maintained privacy-incident register, defined privacy-event taxonomy, and review of designated complaint/escalation channels.

**Reporting state:** `[state]`

`[Summarize substantiated events and response. Do not assert that an event was or was not a legally defined breach without appropriate human/legal review.]`

## Responsibly disclosed vulnerabilities

**Measurement prerequisite:** disclosure intake register recording unique reports, duplicates, validation outcome, severity method, acknowledgements, and remediation status across every published channel.

| Category | Result or state | Definition / coverage note |
| --- | --- | --- |
| Unique reports received | `[value or state]` | `[definition]` |
| Validated vulnerabilities | `[value or state]` | `[definition]` |
| Duplicate / previously known reports | `[value or state]` | `[definition]` |
| Remediated during period | `[value or state]` | `[definition; may include earlier reports]` |

## Remediation metrics

**Measurement prerequisite:** timestamped, consistently classified work items linked to validated findings with documented pause/reopen/closure rules.

| Metric | Result or state | Population, statistic, limitations |
| --- | --- | --- |
| Time to triage | `[value/state]` | `[median/percentile, units, sample size, definition]` |
| Time to containment | `[value/state]` | `[population and clock rules]` |
| Time to remediation | `[value/state]` | `[population and verification-of-fix rule]` |
| Open findings by severity | `[value/state]` | `[severity framework and as-of date]` |

Do not present targets as measured performance.

## Availability and outages

**Measurement prerequisite:** reliably retained telemetry, a documented service boundary and availability formula, maintenance/exclusion rules, time-zone handling, and an outage register reconciled to the interval.

**Reporting state:** `[state]`

`[If measured, identify service indicators, exact coverage, formula, exclusions, and outage summaries. Never derive historical uptime from memory or incomplete provider history.]`

## Account and data deletion requests

**Measurement prerequisite:** privacy-preserving request register spanning all designated intake channels, with request-type definitions, duplicate handling, identity-verification status, completion evidence, and retention rules for the register itself.

**Reporting state:** `[state]`

`[Keep self-service account deletion distinct from support requests unless the counting method intentionally includes both.]`

## Legal and government requests

**Measurement prerequisite:** complete request register, defined categories, duplicate/supplement rules, and human/legal confirmation that aggregate publication is accurate and permitted.

**Reporting state:** `[state]`

`[Publish only reviewed aggregates. Do not infer zero from an informal inbox search.]`

## Subprocessor changes

| Subprocessor / service | Change and effective date | Data categories / purpose affected | User impact | Evidence status |
| --- | --- | --- | --- | --- |
| `[name]` | `[added/removed/material change]` | `[verified scope]` | `[impact]` | `[verified / confirmation required]` |

State **No reliably reportable conclusion** rather than “no changes” when no complete inventory/change record covers the period.

## Security, privacy, and accessibility improvements

List only shipped/completed work linked to implementation, configuration, test, or review evidence.

| Area | Improvement | Completed / released | Evidence | Limitation or follow-up |
| --- | --- | --- | --- | --- |
| `[security/privacy/accessibility]` | `[specific change]` | `[date/version]` | `[reference]` | `[remaining limitation]` |

Accessibility testing is not certification. State methods, scope, and limitations.

## AI and MCP permission changes

| Change | Effective date | Permission/data boundary affected | User control or migration | Evidence and review |
| --- | --- | --- | --- | --- |
| `[change]` | `[date/version]` | `[verified boundary]` | `[consent/revocation/action]` | `[contract/code/tests/review]` |

Do not label browser-encrypted private state as end-to-end encrypted or zero knowledge and do not imply planned permissions are available.

## Independent assessments

Include an assessment only after it was actually performed and the assessor, scope, date, method, and publishable result were verified. Procurement questionnaires, self-assessments, automated scans, internal reviews, and penetration-test plans are not independent assessments.

**Reporting state:** `[Performed and verified / None claimed / Not publishable]`

| Assessor | Assessment and scope | Fieldwork/report date | Publishable result | Limitations | Evidence |
| --- | --- | --- | --- | --- | --- |
| `[verified entry only]` | `[scope]` | `[dates]` | `[approved summary]` | `[limitations]` | `[report reference]` |

Never imply SOC 2, ISO 27001, VPAT certification, or another certification/audit without exact current independent evidence.

## Major policy revisions

| Policy | Effective date | Material revision | User action | Canonical version/history |
| --- | --- | --- | --- | --- |
| `[policy]` | `[date]` | `[plain-language summary]` | `[action or reviewed none-required statement]` | `[link]` |

Draft language requiring human/legal review is not effective policy.

## Next-period commitments

Commitments are targets, not completed controls or guarantees.

| Commitment | Intended outcome | Owner | Target window | Success evidence | Dependency / risk | Status reporting path |
| --- | --- | --- | --- | --- | --- | --- |
| `[bounded commitment]` | `[outcome]` | `[role]` | `[window]` | `[observable evidence]` | `[dependency]` | `[where progress appears]` |

## Known gaps and measurement prerequisites

| Topic | Current reporting state | Missing prerequisite | Accountable owner | Target review date |
| --- | --- | --- | --- | --- |
| `[topic]` | `[state]` | `[instrumentation/process/review needed]` | `[role or unassigned]` | `[date/not scheduled]` |

## Corrections and methodology changes

| Published / corrected date | Affected statement | Earlier presentation | Corrected presentation | Reason and impact | Approver |
| --- | --- | --- | --- | --- | --- |
| `[entry; use “No corrections published” only after review]` | | | | | |

## Publication checklist

- [ ] Reporting scope, boundaries, cut-off, owner, and exclusions are explicit.
- [ ] Every number has a metric definition and full-period coverage, or is labelled partial without extrapolation.
- [ ] Every zero is supported by a tested counting process covering the stated period and scope.
- [ ] Incident, vulnerability, request, and outage registers were reconciled to all designated intake sources.
- [ ] Security-sensitive and personal information were removed from public text.
- [ ] Legal/government-request wording received appropriate human/legal review.
- [ ] Independent-assessment and certification statements match actual evidence and scope.
- [ ] Improvements are complete; unfinished work appears only as a commitment.
- [ ] Subprocessor and AI/MCP changes were reconciled against authoritative inventories/change records.
- [ ] Accessibility claims identify methods, scope, and limitations.
- [ ] Policy links, dates, and revision histories were checked.
- [ ] Corrections and methodology changes are disclosed.
- [ ] A final reviewer checked that the report does not imply U of T affiliation.
- [ ] The approved report is retained so later corrections and year-over-year comparison remain possible.
