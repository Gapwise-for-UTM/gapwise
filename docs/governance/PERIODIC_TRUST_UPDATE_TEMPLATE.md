# Gapwise periodic trust update — template

> **Template — not a published update.** Use for a month, quarter, release window, or another explicitly bounded period. It supplements the annual Trust & Transparency Report. Remove editorial instructions before publication.

## Update control

| Field | Required entry |
| --- | --- |
| Period | `[start date, inclusive]` to `[end date, inclusive]` |
| Published | `[date after approval]` |
| Scope and exclusions | `[services/environments covered and omitted]` |
| Evidence cut-off | `[date/time/time zone]` |
| Owner and approver | `[roles and approval record]` |
| Related annual report | `[canonical link or “Not yet published”]` |

## Reader note

This update reports only evidence available for the stated scope and period. A missing measure is not zero. **Zero is publishable only when a reliable counting process covered the entire period and scope.** Use **Not measured**, **Partial coverage**, **Not publishable**, or **Not applicable** when that condition is not met.

This update is not an audit, certification, legal conclusion, or statement of University of Toronto affiliation.

## At a glance

- **Material changes:** `[plain-language, evidence-backed summary]`
- **User action:** `[action, or reviewed statement that none is identified]`
- **Known limitations:** `[measurement or control gaps]`

## Events and response

Retain a non-numeric reporting state when readers could otherwise mistake silence for zero.

| Topic | Result or reporting state | Definition, coverage, evidence | Response / user impact |
| --- | --- | --- | --- |
| Security incidents | `[value or state]` | `[register, definition, dates, reconciliation]` | `[safe summary]` |
| Privacy incidents | `[value or state]` | `[register, taxonomy, dates, review]` | `[safe summary; no unsupported legal conclusion]` |
| Responsibly disclosed vulnerabilities | `[value or state]` | `[intake register, unique/duplicate and validation rules]` | `[themes/remediation without risky detail]` |
| Availability / outages | `[value or state]` | `[telemetry, service boundary, formula, exclusions]` | `[impact and recovery]` |
| Account/data deletion requests | `[value or state]` | `[request register, channels, deduplication, scope]` | `[completion information if reliably tracked]` |
| Legal/government requests | `[value or state]` | `[complete register plus publication approval]` | `[reviewed aggregate or high-level reason not publishable]` |

Do not add remediation-time statistics unless timestamped records, lifecycle rules, and a defined statistic cover the reported population. If included, state sample size, units, clock rules, and whether the result is a median, percentile, or another measure.

## Trust-related changes

| Area | Completed change | Effective date | Evidence | Limitation / user action |
| --- | --- | --- | --- | --- |
| Subprocessors | `[addition, removal, or material change]` | `[date]` | `[inventory/change record]` | `[impact]` |
| Security/privacy/accessibility | `[shipped improvement]` | `[date/version]` | `[implementation/test/review]` | `[remaining limitation]` |
| AI/MCP permissions | `[added, removed, or narrowed capability]` | `[date/version]` | `[contract/code/test]` | `[consent/revocation/action]` |
| Major policies | `[effective revision]` | `[date]` | `[canonical policy/history]` | `[action]` |

If the authoritative inventory or change history does not cover the whole period, say so; do not report “no changes.” Planned work belongs below, not in this table.

## Independent assessments

Use **None claimed** unless an assessment was actually performed and its independence, assessor, scope, dates, method, result, limitations, and permission to publish were verified. Internal review, automated scanning, self-assessment, and planned testing are not independent assessments.

## Next-period commitments

| Commitment (target, not guarantee) | Owner | Target window | Success evidence | Dependency / risk |
| --- | --- | --- | --- | --- |
| `[bounded commitment]` | `[role]` | `[window]` | `[observable evidence]` | `[dependency]` |

## Measurement gaps and corrections

- **Missing prerequisites:** `[topic → missing system/process → owner → review date]`
- **Methodology change:** `[change and effect on comparability, or reviewed “None”]`
- **Correction to an earlier update:** `[link, earlier statement, correction, reason, approval date; never silently overwrite]`

## Release checklist

- [ ] Scope, dates, cut-off, exclusions, owner, and approver are clear.
- [ ] Each number—including each zero—has a definition, reliable source, complete coverage, deduplication rule, and reviewer.
- [ ] Partial or absent measurement is labelled without extrapolation.
- [ ] Legal-request publication and legal characterizations received appropriate human/legal review.
- [ ] No personal, privileged, secret, or exploit-enabling detail is disclosed.
- [ ] Completed improvements and future commitments are clearly separated.
- [ ] Subprocessor, AI/MCP, accessibility, policy, assessment, and affiliation claims match current evidence and do not overstate assurance.
- [ ] Links and correction history were checked before publication.
