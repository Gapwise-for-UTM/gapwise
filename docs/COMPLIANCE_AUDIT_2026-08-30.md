# Gapwise compliance audit — 2026-08-30

This is an engineering and product-compliance review, not a legal opinion or certification. It records what can be verified from the public repository and product architecture and separates those facts from items requiring an authorized human or qualified legal/privacy professional.

## Verified product facts

- The hosted application already has `/privacy` and `/terms`; this audit improves those pages rather than creating duplicates.
- The original ACORN `.ics` file is parsed client-side and is not intentionally uploaded.
- Guest timetable data is browser-local.
- Optional private cloud state is encrypted client-side before storage; Vercel remains in the key-management trust boundary, so the project correctly avoids claiming zero-knowledge or end-to-end encryption.
- Account deletion exists in product UI and calls an authenticated Supabase deletion function. Delegated OAuth/MCP client tokens are deliberately rejected for account deletion.
- Account deletion removes the auth user; user-owned application records are designed to cascade. Local encrypted data cleanup is attempted separately and failure is surfaced to the user.
- Optional AI access is permissioned and revocable; the primary encrypted timetable is not automatically exposed by merely connecting a client.
- Foreground location is optional; the product does not claim background tracking.
- The repository has credential-shaped log redaction and tests for it.
- Incident-response, disaster-recovery, security-control, data-inventory, and security-disclosure documentation already exists.
- The current product is free. Historical Stripe/billing schema has been retired and the repository has a free-product invariant test. Payment-specific checkout compliance is therefore not a current product flow.

## Changes made in this audit

The hosted Privacy Policy was expanded to describe scope/operator status, purposes, provider categories and international-processing uncertainty, browser storage and analytics, retention/backups, AI-provider boundaries, privacy-request categories, regulator complaint rights where applicable, incident handling, and a material-review date. It deliberately does not claim a specific GDPR transfer mechanism or universal legal basis without provider/legal verification.

The hosted Terms were expanded with acceptable-use boundaries, third-party integration treatment, a clearer current-free-product statement, an explicit precondition for any future charging flow, and language preserving non-waivable statutory rights. No fake liability waiver or checkbox-as-compliance language was added.

## GDPR / European users

If GDPR applies to a particular Gapwise processing activity, Articles 13–14 require substantially more transparency than the former short hosted page provided, including controller identity/contact, purposes and legal bases, recipients, transfer information where applicable, retention, data-subject rights, complaint rights, and certain automated-decision information. The updated page now covers most product-level categories but intentionally leaves formal controller identity/address, representative status, exact legal-basis mapping, and transfer mechanism as legal/provider-verification items.

The product already offers meaningful erasure and consent/revocation controls. A self-service account deletion control is not by itself a complete data-subject-request program: access, correction, restriction, objection and portability requests may need identity-safe manual handling depending on applicable law and the data concerned.

A cookie banner is not added. The verified product uses browser storage and Vercel operational analytics, but this audit did not establish that Gapwise itself deploys advertising or cross-site behavioral tracking. Consent requirements should be reassessed if non-essential tracking is introduced or if provider behavior/configuration changes.

## Canada / Ontario

PIPEDA accountability guidance expects an accountable privacy function and documented privacy-management practices when PIPEDA applies. Canadian breach rules can require reporting and affected-person notification for breaches presenting a real risk of significant harm, while records of breaches must be maintained. Gapwise already has substantial incident-response documentation, but the actual accountable privacy role, monitored intake channel, breach register location, and evidence of operational exercises remain human/operational matters.

Ontario consumer-contract rules become materially more important if Gapwise starts charging. The current product does not offer checkout or paid tiers, so this audit does not add purchase consent UI. Before charging, the operator must review then-current consumer-contract disclosure, acceptance, copy-delivery, cancellation/renewal, tax, age/capacity, and recurring-payment requirements.

## Security and incident readiness

Positive controls include client-side encryption, explicit trust-boundary documentation, RLS/database security tests, delegated-client isolation, restricted account-deletion authority, secret-shaped log redaction, security.txt, an incident-response runbook, and CI security gates.

Operational caveat: repository runbooks are not evidence that a real incident-response team, legal/privacy escalation path, provider contacts, breach register, or notification decision process is staffed and exercised. Those must remain evidence-backed human actions.

## Items requiring qualified/human review

1. Confirm the legal identity of the Gapwise service operator, appropriate public contact details, and whether a business/entity registration is required.
2. Determine which privacy statutes apply to actual operations and users, including whether GDPR territorial scope applies and whether an EU/EEA representative or DPO is required. Do not appoint either merely as a cosmetic compliance step.
3. Produce a feature-by-feature lawful-basis/consent analysis and verify current Vercel, Supabase, identity-provider, and optional AI-provider transfer/data-processing terms before asserting a transfer mechanism or data residency.
4. Establish and test a privacy-rights intake procedure covering access/copy, correction, deletion, restriction/objection and portability where applicable, with safe identity verification and response records.
5. Assign an accountable privacy role and backup, maintain a breach register where required, and exercise the incident/privacy-notification workflow.
6. Have qualified counsel review the hosted Terms and Privacy Policy before commercialization, institutional contracting, material expansion outside the current student-project scope, or introduction of paid services.
7. If paid services are introduced, perform a fresh consumer-law, tax, recurring-charge, cancellation/refund, age/capacity, and payment-provider review before enabling checkout.

## Deliberately not added

- No cookie banner without evidence it is required for the technologies actually deployed.
- No generic `I agree` checkbox presented as eliminating liability.
- No claim of GDPR, PIPEDA, SOC 2, ISO 27001, University, accessibility, or other blanket compliance/certification.
- No payment consent flow while the product is free.
- No invented DPO, EU representative, company address, legal entity, retention duration, data residency, or international-transfer mechanism.
