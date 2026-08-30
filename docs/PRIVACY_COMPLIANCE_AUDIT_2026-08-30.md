# Privacy and product-compliance audit — 2026-08-30

This document records the evidence gathered during the 2026-08-30 privacy/product-compliance pass. It is an engineering and documentation audit, **not legal advice, a certification, or a claim that every privacy law applies to Gapwise**.

## Scope and evidence rule

The pass reviewed the current `main` implementation, the public privacy/terms surfaces, the data inventory, deletion and AI controls, incident-response material, security logging/redaction evidence, current production Vercel deployment behavior, and the separate Gapwise AI architecture. Claims are limited to what source, deployment behavior, or an authoritative provider/regulator source supports.

Authoritative references used for legal/provider framing:

- Office of the Privacy Commissioner of Canada (PIPEDA overview and commercial-activity scope): <https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/pipeda_brief/>
- OPC PIPEDA commercial-activity interpretation: <https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/pipeda-compliance-help/pipeda-interpretation-bulletins/interpretations_03_ca/>
- OPC PIPEDA accountability self-assessment guidance: <https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/pipeda-compliance-help/pipeda-compliance-and-training-tools/pipeda_sa_tool_200807>
- OPC mandatory-breach guidance: <https://www.priv.gc.ca/en/blog/20191031/>
- European Commission GDPR territorial-scope explanation: <https://commission.europa.eu/law/law-topic/data-protection/rules-business-and-organisations/application-regulation/who-does-data-protection-law-apply_en>
- Vercel Web Analytics privacy documentation: <https://vercel.com/docs/analytics/privacy-policy>
- Vercel Speed Insights privacy documentation: <https://vercel.com/docs/speed-insights/privacy-policy>

## Production and implementation facts verified

- `https://gapwise.ca/privacy` and `https://gapwise.ca/terms` both returned HTTP 200 from the production Vercel project during this audit.
- The public deployment returned HSTS, CSP, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, a restrictive permissions policy, and `payment=()` in the permissions policy.
- The original ACORN `.ics` file is parsed in the browser and is not represented in the current cloud payload/schema. Parsed private state can enter optional browser-encrypted sync; the system does not claim end-to-end or zero-knowledge encryption. See `docs/TRUST_DATA_INVENTORY.md` and `docs/PRIVATE_CLOUD_SECURITY_ARCHITECTURE.md`.
- Guest mode is usable without an account. Google, Microsoft, and GitHub sign-in are optional. The sign-in surface links Terms and Privacy and states that continuing agrees to the Terms and acknowledges the Privacy Policy.
- Signed-in users have a shipped **Delete account and cloud data** control. The deletion flow removes the Supabase auth account and user-owned application records through the account-deletion boundary and attempts to clear private local records; browser-only legacy/guest data has separate local controls.
- AI delegation is opt-in, permissioned by category, and separately revocable. The minimized AI snapshot excludes the raw `.ics`, friend data, precise live location, primary private-cloud encryption keys, and identity-provider/OAuth tokens. Academic meetings are not an AI write target.
- Friend overlap uses a separate deliberately lossy availability capsule rather than exposing the full timetable.
- Vercel Web Analytics and Speed Insights are mounted. No application code was found that intentionally adds timetable, room, friend, precise-location, token, or decrypted-private-data properties to those telemetry products.
- Vercel documents current Web Analytics as anonymized and cookie-free, and Speed Insights as anonymous and not tied to an individual visitor or IP address. A cookie banner was therefore **not** added merely because these products are present.
- No Stripe SDK, payment checkout, paid tier, subscription, converting free trial, or Gapwise product payment flow was found. The hosted product currently says it is free. The terms now contain an explicit gate requiring product/terms updates before any future charging begins.
- The incident-response runbook already contains security and privacy triage, severity classification, evidence preservation, provider escalation, notification decision-making, recovery, and postmortem procedures.
- The previous security pass fixed a concrete logging weakness: expanded catastrophic server errors are now credential-redacted before application logging, with regression coverage for bearer/JWT/cookie and structured secret cases. See `docs/FINAL_SECURITY_AUDIT_2026-08-30.md`.

## Social-media claims: audited result

### “No privacy policy means you get sued.”

**Not the Gapwise state.** A public policy already existed. The issue was completeness and alignment with the much richer technical data inventory, so the public notice was expanded. Whether a particular notice is legally required, and exactly what it must contain, depends on applicable law and processing facts.

### “You need Terms or users can hold you responsible for anything.”

**Overstated.** Gapwise already had public terms. The pass strengthened them with data/content, acceptable-use, third-party/AI, termination, payment, warranty/liability, and statutory-rights language. A checkbox or clickwrap is evidence of assent; it does not erase non-waivable legal rights or automatically defeat disputes.

### “Any European user makes you subject to GDPR.”

**Incorrect as a universal rule.** The European Commission explains that a non-EU entity is in scope when, among other things, it offers goods/services to people in the EU or monitors their behavior there. It gives the counterexample of a non-EU service whose existing customers merely use it while travelling in the EU when the service does not target EU individuals. Gapwise therefore does not claim GDPR applicability solely from an EU visitor.

### “GDPR means add a cookie banner.”

**Not automatically.** The current telemetry does not justify adding a generic banner: Vercel documents Web Analytics as cookie-free and anonymized. Consent requirements must be reassessed if Gapwise later introduces non-essential cookies, advertising, profiling, or other tracking.

### “You must have breach notification.”

**Partly true but jurisdiction/risk specific.** Gapwise already has an incident and notification-decision runbook. If PIPEDA applies to an activity, its breach regime requires records of all breaches and reporting/individual notification when the real-risk-of-significant-harm threshold is met; OPC guidance says breach records must be kept for at least two years. Other regimes have different thresholds and timelines. The runbook correctly avoids inventing one universal deadline.

### “Charging without clear consent creates lawsuit risk.”

**Not currently applicable to the product.** No Gapwise checkout or paid plan exists. No fake payment-consent UI was added. The terms now require clear price, timing, renewal, cancellation, and consent treatment before a paid feature ships.

## Changes made by this pass

- Expanded `src/routes/privacy.tsx` into a public notice that reflects the actual data inventory: optional auth/sync, encryption trust boundary, friends/community state, telemetry, AI, providers/international processing, retention, self-service deletion, conditional privacy rights, incident handling, and the current lack of a verified dedicated privacy contact.
- Expanded `src/routes/terms.tsx` with acceptable-use, user-content, third-party/AI, payment, suspension, warranty/liability, statutory-rights, and contact sections without inventing a governing jurisdiction or operator structure.
- Reconciled `PRIVACY.md` with the same implementation facts and explicitly documented that a generic data-export UI is not currently represented as shipped.
- Extended E2E coverage so the public legal pages are checked for the material new statements rather than only their headings.

## Data-rights assessment

Current product controls support meaningful minimization and deletion:

- guest mode without an account;
- local timetable removal/site-data clearing;
- optional sync and AI controls;
- AI delegation revocation;
- permanent account and associated Gapwise cloud-data deletion.

A general self-service **export my account data** feature was not found. This audit does not label that omission a universal legal violation: access/portability duties depend on applicable law and the request. Until legal scope and a dedicated privacy operation are established, non-self-service requests need an identity-safe private intake and response process. Building a downloadable export can still be a useful future product improvement once the exact scope and safe format are defined.

## PIPEDA is not assumed merely because Gapwise is Canadian

PIPEDA applies to personal information handled in the course of commercial activities, subject to its jurisdictional rules. OPC guidance also notes that free activity can still be commercial depending on the broader business model, while non-profit/non-commercial activity is not automatically in scope. Gapwise's actual operator/business structure and commercial character are external facts that source code cannot settle. The safest repository posture is therefore to follow strong privacy principles while requiring a human/legal determination before claiming statutory compliance or non-applicability.

If PIPEDA is determined to apply, the administrative privacy program should specifically address its accountability, access, complaint, breach-record, and other applicable obligations. The repository already contains implementation and incident-response foundations, but it cannot appoint an accountable individual or create evidence of a monitored real-world intake channel by itself.

## Remaining external/human gates

These are not defects that can be truthfully “fixed” by adding code or checking a Markdown box:

1. **Privacy accountability and contact.** Designate the accountable privacy person/role and backup; establish a monitored private privacy-request/complaint channel; authorize what contact details may be published; define identity-safe access/correction/deletion/portability handling.
2. **Applicable-law determination.** Confirm the operator/business structure, commercial activity, jurisdictions actually targeted, and whether PIPEDA, provincial private-sector law, GDPR/UK GDPR, or another regime applies to particular processing. Obtain qualified legal advice before making a public compliance claim.
3. **Provider evidence.** Verify production Supabase/Vercel regions, logs/backups/retention, dashboard settings, data-processing/privacy terms, subprocessor/transfer facts, and access ownership. Repository dependencies cannot prove those account-level facts.
4. **Incident legal matrix and restricted records.** Once applicable law is confirmed, encode the actual regulator/contact/record-retention obligations in a restricted operating procedure. If PIPEDA applies, ensure every breach record is retained for at least the required two-year period and RROSH decisions are documented.
5. **Future-change triggers.** Re-run privacy review before payments, marketing email, advertising, new analytics/custom-event payloads, background location, new AI categories/providers, materially different data retention, or institutional contracting.

The administrative handoff already exists in `docs/ADMINISTRATIVE_LEGAL_READINESS.md`; the audit should not falsely turn those external items into completed repository evidence.
