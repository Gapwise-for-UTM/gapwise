# Gapwise incident response and operational trust

## Purpose and evidence discipline

This internal runbook covers suspected or confirmed security, privacy, and availability incidents affecting Gapwise. It is a decision aid, not legal advice, and it does not establish an uptime guarantee, response-time SLA, recovery-time objective (RTO), recovery-point objective (RPO), provider SLA, or notification guarantee.

Use three evidence labels in incident records and external drafts:

- **Verified** — supported by current source, deployed configuration, retained event evidence, or a provider dashboard inspected for the incident.
- **Process commitment** — an action this runbook instructs the responder to take; it is not evidence the action has happened.
- **Confirmation required** — depends on the owner, qualified legal advice, a provider, or production-only evidence. Do not publish it as fact until confirmed.

Never put secrets, tokens, keys, exploit instructions, private timetable data, precise location, relationship data, decrypted payloads, or unnecessary personal information in a public issue, PR, status update, or postmortem.

## Architecture facts responders may use

The following are repository-backed facts that must still be reconciled with the deployed commit during an incident:

- the browser parses the original ACORN `.ics`; the application design does not upload that file;
- guest timetable, gap, and route computation is local-first;
- optional private cloud stores browser-encrypted application state in Supabase with wrapped data keys and server-side versioned KEKs in Vercel;
- Supabase also processes authentication/account metadata and minimal relationship metadata;
- Vercel hosts the application, public/private API functions, AI/docs deployments, and the separately deployed status surface;
- Supabase provides Auth, Postgres/PostgREST, and the account-deletion Edge Function;
- Microsoft, Google, and GitHub are configured OAuth identity providers;
- Cloudflare provides the `gapwise.ca` domain/DNS layer, inbound Email Routing, and Turnstile abuse protection; this does not imply Cloudflare proxies the Vercel application traffic;
- Resend provides custom SMTP delivery for Supabase Auth through the verified `auth.gapwise.ca` sending domain;
- `status.gapwise.ca` is a public operator-maintained status-communication surface on a separate Vercel project; it is not continuous synthetic monitoring, an uptime-history system, an SLA, or independent of a Vercel-wide outage;
- `security@gapwise.ca` is the canonical vulnerability-reporting email, with `support@gapwise.ca` and `hello@gapwise.ca` available for ordinary inbound communication through Cloudflare Email Routing;
- GitHub Actions verifies repository changes and production deployment is built from `main` by Vercel;
- Gapwise must not be described as end-to-end encrypted or zero knowledge: same-origin code, browser/session compromise, or sufficiently broad provider compromise can expose data in use.

Provider status, affected records, log retention, exact deployed configuration, and root cause are **confirmation required** for each incident.

## First-response checklist

1. **Protect people and access.** If there is active destructive access or an immediate safety threat, contain the affected surface using the least destructive reversible control available.
2. **Open a restricted incident record.** Record an incident ID, UTC detection/start times, incident lead, recorder, provisional severity, affected surfaces, and report source. If a role is not pre-approved, mark it confirmation required rather than inventing it.
3. **Preserve evidence safely.** Record commit/deployment IDs, request IDs, timestamps, provider references, and sanitized observations. Keep originals read-only where practical.
4. **Validate the signal.** Separate observed facts from hypotheses. Check the canonical application, Vercel deployment/runtime state, Supabase Auth/database/Edge Function state, Cloudflare DNS/Turnstile/Email Routing state, Resend delivery state when mail is implicated, `status.gapwise.ca`, and relevant provider status pages.
5. **Classify the data and scope.** Identify whether the event concerns public campus data, account metadata, ciphertext, wrapped keys/KEKs, private plaintext, relationship metadata, sessions/tokens, precise location in memory, or availability only.
6. **Assign provisional severity.** Default upward when impact is unclear and record why severity later changes.
7. **Contain deliberately.** Never weaken RLS, ship privileged browser credentials, add plaintext fallbacks, or destroy evidence to restore service.
8. **Start the privacy track** whenever personal information might have been accessed, lost, altered, disclosed, or made unavailable without authorization.
9. **Set a next review time.** There is no repository-backed response SLA; record an event-appropriate cadence.

## Severity classification

| Level              | Classification guide                                                                                                                                                                             | Examples are hypothetical                                          | Minimum process                                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| **SEV-1 Critical** | Active or credible widespread compromise; exposed auth/signing/KEK capability with a path to private data; destructive loss with no known recovery; major integrity failure affecting many users | malicious production code, broad confirmed private-data disclosure | incident lead, immediate containment review, security + privacy tracks, owner/provider escalation, communication/legal decisions logged |
| **SEV-2 High**     | Confirmed material compromise with bounded/unknown scope; unauthorized personal-data access; prolonged core-service loss without safe workaround; high-risk credential exposure                  | cross-account access, stolen production credential                 | prioritized containment, provider escalation, privacy triage, notification decision recorded                                            |
| **SEV-3 Moderate** | Limited control failure or material degradation with low demonstrated data risk and a safe workaround                                                                                            | repeated function failures, bounded config drift                   | named owner, contain/fix, assess escalation/communication, retain decision record                                                       |
| **SEV-4 Low**      | Benign event, false positive, or low-impact defect with no reasonable confidentiality/integrity risk                                                                                             | scanner noise, short non-core degradation                          | record disposition and evidence; route ordinary defects to normal maintenance                                                           |

Severity remains provisional until scope is known. Do not lower severity solely because payloads are encrypted; determine whether keys, sessions, same-origin code, decrypted browser memory, metadata, or the key-broker boundary were affected.

## Security triage worksheet

Record concise answers and explicitly mark unknowns:

- What was observed, by whom, and at what UTC time? What is the earliest supported occurrence?
- Which production commit/deployment, API, function, database object, identity provider, domain, mail route/sender, or device is implicated?
- Is access ongoing? Is integrity or availability changing?
- What capability is demonstrated versus hypothesized?
- Could a token, OAuth secret, database credential, deployment credential, Supabase administrative credential, Resend/SMTP credential, Cloudflare credential, KEK, DEK, or authenticated session be exposed?
- Could same-origin code have read decrypted state or intercepted future use?
- Is there evidence of cross-account access, RLS bypass, unauthorized relationship/overlap access, account takeover, or deletion?
- Which logs or provider events support the conclusion, and what relevant visibility is missing?
- Does the event require vulnerability-disclosure coordination, privacy triage, or qualified legal advice?
- What reversible containment reduces risk now, and what user harm might that containment cause?

Security reports arriving through the vulnerability-disclosure path should be handled privately under `SECURITY.md`. Do not expose researcher identity or technical reproduction detail in public updates.

## Privacy incident / possible breach triage

Start this worksheet on reasonable suspicion. Calling something a “breach” publicly is a factual/legal conclusion requiring appropriate review.

1. **Data:** categories, plaintext/ciphertext/metadata form, approximate person/record count, sensitivity, and estimate accuracy.
2. **People:** whose information may be involved. Avoid collecting additional identifying data merely to answer this.
3. **Event:** unauthorized collection, use, disclosure, access, modification, loss, deletion, or unavailability; earliest/latest supported times; ongoing risk.
4. **Protection:** encryption/key separation actually applicable at the time; whether related keys, sessions, browser code, or administrative capabilities were affected.
5. **Recipients/actor:** known or suspected recipient, intent, ability to use the data, and evidence of acquisition/persistence/onward disclosure.
6. **Consequences:** plausible harm, ability to reduce it, and risks introduced by notification itself.
7. **Jurisdiction and obligations:** applicable law, contracts, provider terms, preservation duties, and statutory tests require qualified human/legal review.
8. **Mitigation:** containment completed, data recovered/deleted where verifiable, access revoked, monitoring chosen, and unresolved exposure.

Never turn an unknown count into zero. Avoid inspecting decrypted user content when aggregate metadata or a disposable operator-owned test account is sufficient.

## Containment and credential-rotation decision points

Choose the narrowest control that stops harm while preserving evidence and local/guest utility where safe.

| Signal                                      | Consider now                                                                                                | Never do                                                                                                 | Exit evidence                                                 |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Malicious/faulty deployment                 | pause or roll back to a known-good commit; restrict affected function; verify domains/headers               | rewrite history or ship an unreviewed broad fix                                                          | known-good SHA deployed; behavior/runtime errors checked      |
| Session/token exposure                      | revoke affected sessions through supported Auth controls; fix redirect/config weakness                      | log tokens or broadly invalidate users without assessing harm                                            | revocation/config action and post-change auth test recorded   |
| OAuth client secret compromise              | rotate/revoke at provider; verify exact redirect allowlists; update server-only config                      | place OAuth secrets in `VITE_*`, source, screenshots, or tickets                                         | old credential rejected; approved flow works                  |
| Supabase admin/database credential exposure | revoke/rotate; inspect events; verify RLS and grants                                                        | give service-role/database credentials to browser or private-cloud code                                  | old credential rejected; expected services healthy            |
| Resend/SMTP credential exposure             | create a replacement restricted sending credential, update Supabase SMTP, verify delivery, then revoke old  | paste the replacement into source, public tickets, chat, screenshots, or browser-exposed configuration   | old credential revoked; Auth mail path verified               |
| Cloudflare account/API credential exposure  | revoke/rotate; inspect DNS, Email Routing, and Turnstile configuration; preserve provider evidence          | change DNS/security controls without recording the affected production state                             | unauthorized access removed; DNS/routing/Turnstile verified   |
| Vercel deploy/API credential exposure       | revoke/rotate in Vercel/GitHub as applicable; inspect deployments/environment changes                       | print environment values or copy production secrets into preview                                         | unauthorized access removed; deployment/config audit recorded |
| Suspected KEK exposure                      | follow `PRIVATE_CLOUD_MIGRATION_RUNBOOK.md`; establish replacement/recovery first; rewrap and retire safely | delete the only working KEK, store it in Supabase, or claim ciphertext is safe without boundary analysis | replacement envelopes verified and old version safely retired |
| Suspected DEK/private plaintext exposure    | contain session/device/origin path; assess affected ciphertext/future access; obtain specialist review      | assume KEK rotation alone remediates a captured DEK/plaintext                                            | affected scope and new protection verified                    |
| Database/RLS integrity concern              | restrict affected writes/feature; compare migrations, grants, and policies; use disposable accounts         | disable RLS or restore production without validation                                                     | forced RLS/grants/functions and representative checks pass    |
| Provider outage without compromise          | preserve local-first behavior and fail cloud actions non-destructively                                      | introduce plaintext fallback or weaken authorization                                                     | provider and Gapwise recovery observed                        |

Treat any secret published in source, logs, chat, screenshots, or tickets as compromised. Rotation order should normally be: establish replacement access/recovery material, update consumers, verify, then revoke the old credential. Active attacker access may require immediate revocation; record the availability tradeoff.

## Provider escalation

Escalate when provider action or provider-only evidence is needed. Confirm the affected integration from the deployed configuration before contacting a provider.

Before submitting a provider case:

- use the provider's authenticated support/security channel selected by the owner; no response SLA or plan entitlement is asserted here;
- include incident ID, sanitized UTC timeline, safe project/deployment identifiers, observed impact, requested action, and relevant request/event IDs;
- state facts and uncertainty;
- do not send user payloads, passwords, keys, tokens, database URLs, or broad log exports unless a specifically authorized secure exchange and necessity review exists;
- request preservation of relevant provider evidence where appropriate without inventing a retention period;
- record case/reference number, provider statements, actions, and provenance.

If provider support is unavailable on the current plan, record the limitation and use safe application containment. Do not purchase services or accept new contractual terms without owner authorization.

## User and public notification decision checklist

Complete this for every SEV-1/SEV-2 and every possible privacy incident. A “no notification” result requires a recorded rationale.

- [ ] Facts are sufficiently stable to avoid misleading recipients; unknowns are explicit.
- [ ] The potentially affected population can be identified without excessive new processing.
- [ ] Data categories, protection state, time window, and plausible consequences are described accurately.
- [ ] Any requested user action is specific, safe, and proportionate.
- [ ] Notification could reduce harm, or a law/contract/provider term may require it.
- [ ] Risks of delay versus premature or overbroad disclosure are recorded.
- [ ] Qualified human/legal review has addressed applicable authority, content, recipients, method, timing, preservation, and regulator/law-enforcement considerations.
- [ ] Provider/researcher coordination constraints have been considered without promising secrecy that cannot be maintained.
- [ ] The message does not expose another user, reporter identity, secrets, exploitation detail, unsupported root cause, unsupported counts, uptime, or recovery estimates.
- [ ] A correction/update path exists.
- [ ] Delivery evidence and failed-delivery handling will be retained in an approved restricted location (confirmation required).

## Service-status communication template

`https://status.gapwise.ca` is the canonical public status-communication surface. It is operator-maintained and must not be represented as continuous synthetic monitoring, historical uptime evidence, or an SLA. Because the status surface is a separate Vercel project but still uses Vercel, a provider-wide Vercel outage can affect both the product and the status page; use another owner-approved official channel when the status surface itself is unavailable.

```text
[Investigating | Identified | Monitoring | Resolved] — [service/feature]

Published: [UTC timestamp]
Incident reference: [public-safe ID]

What users may notice:
[Verified symptoms and scope. Say “under investigation” for unknowns.]

What users should do:
[Only necessary, proportionate action; otherwise “No action is requested at this time.”]

What we are doing:
[High-level containment/recovery action without sensitive detail.]

Data/privacy note:
[Use only a reviewed, evidence-backed statement.]

Next update:
[UTC time or “when material verified information changes”.]
```

For resolution, distinguish “service restored” from “investigation complete.” Correct earlier statements visibly rather than silently editing material facts.

## Restricted incident record template

```text
Incident ID / restricted record location:
Title:
Status / provisional severity:
Incident lead / recorder / decision owners:
Detected at / earliest supported start / contained / recovered (UTC):
Affected production commits, deployments, providers, and regions:
User-visible impact:
Data categories and people potentially affected:
Verified facts:
Hypotheses / unknowns:
Evidence locations and access restrictions:

Timeline (UTC)
- [time] [observation/action/decision] — [source/actor] — [verified or hypothesis]

Containment actions and rollback criteria:
Credential decisions and rationale:
Provider case references:
Privacy/legal notification decision and reviewer:
Public/user communications and approvals:
Recovery validation:
Residual risk / follow-up owners and due dates:
```

## Recovery and return-to-service gate

Before declaring recovery:

- confirm the intended reviewed commit is deployed and affected credentials/configuration are in expected scopes without revealing values;
- validate canonical-domain behavior, security headers, local/guest operation, Auth, encrypted sync/restore, authorization isolation, and account deletion to the extent relevant;
- for schema/security changes, run repository and isolated Supabase checks described in `OPERATIONS.md`;
- verify containment did not add plaintext fallback, broaden logging, disable RLS, expose privileged browser access, enable background location, or create cross-user access;
- monitor relevant provider/runtime signals for an event-appropriate recorded observation period;
- distinguish restored availability from completed security/privacy investigation;
- record unresolved gaps, compensating controls, and rollback criteria.

## Post-incident review

Hold a blameless review for SEV-1/SEV-2 and lower-severity events with reusable lessons.

1. Summarize user impact and data impact using verified evidence.
2. Build the UTC timeline including detection, escalation, containment, communication, recovery, and corrections.
3. Explain contributing technical, process, provider, and visibility factors; do not stop at one person's action.
4. Evaluate what worked, what delayed response, evidence gaps, and severity/notification decisions.
5. Create bounded corrective actions with owner, priority, due date, validation method, and issue/PR link.
6. Assess regression tests, monitoring/data-minimization tradeoffs, threat model, privacy docs, provider review, continuity plan, and runbook changes.
7. Decide what can be published; remove secrets, personal data, reporter identity, privileged advice, and exploit-enabling detail while preserving accountability.

## Public postmortem template

```markdown
# [Public-safe incident title]

**Status:** Resolved / Service restored; investigation continues
**User-impact window:** [verified UTC range or explicit unknown]
**Published/updated:** [UTC]

## Summary

[Plain-language verified impact.]

## What users experienced

[Affected features/population; do not turn an estimate into fact.]

## Timeline

[Material public-safe events in UTC.]

## Technical explanation

[Evidence-backed cause and contributing conditions at a non-exploit-enabling level.]

## Data and privacy

[Reviewed facts, affected categories/protections, and user action.]

## Response and recovery

[Containment, restoration, and validation actually completed.]

## Improvements

[Committed versus completed actions, each labelled.]

## Remaining limits

[Unknowns, provider dependencies, or validation still open.]
```

Do not include fabricated incident counts, uptime, SLA performance, or unsupported attribution. Publication and legal wording require human approval.

## Business continuity and disaster recovery

### Verified architectural assumptions

- Guest/local-first timetable, gap, and routing use can remain useful without Supabase, subject to retained local state and static application availability/cache.
- A Supabase outage does not justify weakening RLS; sync/Auth/social/account-deletion capabilities may be unavailable.
- A Vercel/key-broker outage can prevent fresh-device cloud decryption and server API use; a device with valid local state may continue locally.
- The status surface is a separate Vercel project and can remain available through a core-app deployment failure, but it is not a provider-independent fallback for a Vercel-wide outage.
- Production and preview KEKs are designed to be separate. Loss of every active KEK copy can make corresponding cloud ciphertext unrecoverable.
- The database recovery procedure is a sensitive operator-created logical dump plus disposable-target restore drill. It does not recover DNS, OAuth configuration, Vercel variables, KEKs, provider logs, deployed functions, or every Supabase project setting.
- Git and reviewed migrations reconstruct source/schema history, not production user data or provider configuration.

### Explicit gaps requiring confirmation

| Item                         | Current statement                                                                                                                                                             | Required evidence/owner action                                                                        |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Production backup/restore    | **Unverified here. AND-154 is authoritative.** A procedure/helper exists, but this file does not claim a real backup, off-site copy, successful restore, or readiness.        | Check AND-154 and restricted evidence; run authorized drill.                                          |
| RTO/RPO                      | No approved/measured targets established by the repository.                                                                                                                   | Owner/institutional risk decision informed by measured drills/provider capabilities.                  |
| Provider backups/SLAs        | No provider recovery/response promise asserted here.                                                                                                                          | Re-verify plan/dashboard/contract before publication.                                                 |
| Status channel               | `status.gapwise.ca` is verified as an operator-maintained public status surface on a separate Vercel project, but it shares Vercel and has no synthetic-monitoring/SLA claim. | Periodically test publication and retain an owner-approved out-of-band fallback for Vercel-wide loss. |
| Incident contacts/on-call    | No named 24/7 contact matrix verified.                                                                                                                                        | Owner assigns roles, alternates, secure contact methods, and expectations.                            |
| Configuration inventory      | Required categories are documented, but no complete restorable export of DNS/OAuth/provider config is evidenced.                                                              | Maintain a secret-safe inventory and test reconstruction.                                             |
| KEK recovery exercise        | Runbook requirements exist; current recoverability must be checked rather than inferred.                                                                                      | Owner verifies offline copies and runs authorized non-production recovery exercise.                   |
| Cross-provider failure       | No alternate hosting/database region or automatic failover is verified.                                                                                                       | Decide whether risk justifies complexity/cost and test before claiming resilience.                    |
| Communications/legal support | No counsel, regulator workflow, notification vendor, or institutional contact is verified.                                                                                    | Owner establishes relationships if needed.                                                            |

### Continuity decision sequence

1. Define the minimum safe service for the event: static/local guest use, authenticated use, sync, social overlap, APIs, or full service.
2. Prefer graceful disabling of an unsafe server feature over weakening controls.
3. Determine whether a last-known-good deployment, configuration reconstruction, database restore, or credential recovery is needed. Follow `DISASTER_RECOVERY.md` and `PRIVATE_CLOUD_MIGRATION_RUNBOOK.md`.
4. Restore into a disposable target first when data/schema integrity is in doubt. Verify RLS, grants, functions, ciphertext, migration state, and separately supplied non-production KEK behavior.
5. Require an explicit go/no-go decision with evidence, residual risk, rollback trigger, and communication plan before production writes resume.
6. After recovery, reconcile deferred/local changes carefully; do not overwrite valid local state merely to make cloud state appear current.

## Maintenance and exercise checklist

Exercises must use synthetic/disposable data and must not be reported as real incident or recovery evidence.

- [ ] Tabletop a compromised deployment, OAuth/session exposure, suspected KEK exposure, privacy incident, Supabase outage, Vercel outage, mail-provider failure, and DNS/Turnstile control failure.
- [ ] Verify provider escalation paths and role assignments without opening false incidents.
- [ ] Verify an incident update can be published on `status.gapwise.ca` and through the selected out-of-band fallback when the Vercel-hosted status page is unavailable.
- [ ] Confirm links to `SECURITY.md`, `OPERATIONS.md`, `DISASTER_RECOVERY.md`, and `PRIVATE_CLOUD_MIGRATION_RUNBOOK.md` remain current.
- [ ] Check AND-154 before changing any backup/restore-state claim.
- [ ] Review architecture/provider list after Auth, hosting, database, AI, analytics, storage, monitoring, DNS, abuse-protection, or mail-delivery changes.
- [ ] Record exercise date, participants, synthetic scenario, decisions, gaps, and follow-up issues; label all output **exercise**.

The presence of this runbook is a **process commitment**, not proof that an incident was handled, a drill passed, recovery is possible, notification duties were satisfied, or any service level was achieved.
