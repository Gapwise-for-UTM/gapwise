# Gapwise Privacy Notice

_Last updated: 2026-08-30_

Gapwise for UTM is an independent student project. It is not affiliated with, endorsed by, or an official service of the University of Toronto.

This notice describes the data handling of the public Gapwise application at `gapwise.ca` and the optional Gapwise AI integration service. It records implementation-backed behavior and known limits; it is not a legal opinion about which privacy law applies to every user or circumstance.

## What stays in your browser

- The original ACORN `.ics` file is parsed locally and is not uploaded.
- Gap calculations and campus route calculations run in the browser.
- Guest timetables remain local to the browser.
- Signed-in users may keep non-extractable cryptographic keys and encrypted private records in IndexedDB when the browser supports durable `CryptoKey` storage.

## Optional signed-in cloud features

If you sign in with Microsoft, Google, or GitHub OAuth, Supabase and the selected identity provider process the authentication account and browser session required for that feature.

If you explicitly enable private cloud sync, Gapwise encrypts the private timetable/settings payload in the browser before it is written to Supabase. Supabase stores ciphertext, cryptographic metadata, and the minimum account/relationship metadata required to provide the feature.

The original `.ics` file is never stored in the cloud. Gapwise does not store a history of calculated routes or gap recommendations as part of ordinary private cloud sync.

## Optional AI integrations

Gapwise AI is opt-in. Connecting an AI client does not automatically expose timetable data. A signed-in user must explicitly enable an AI delegation and choose which supported categories may be shared, such as the academic timetable, personal timetable items, deterministic Gapwise gap plans, gap-planning preferences, or routing preferences. Write permissions for personal timetable items and gap preferences are separate and default off.

The delegated AI snapshot is a minimized copy built from Gapwise's canonical parsed data. It does not contain the original ACORN `.ics` file, friend data, precise live location, Gapwise's primary private-data encryption keys, identity-provider access tokens, OAuth authorization codes, or OAuth refresh tokens. Academic class meetings are read-only through the AI integration.

When deterministic gap-plan sharing is enabled, Gapwise may include its own precomputed routing/gap assessment for a delegated gap, such as route status and confidence, travel and buffer time, leave-by/arrival time, ranked recommendations, reasons, tags, and timeline segments. The AI service is instructed to treat these source-backed Gapwise results as authoritative instead of inventing missing route or timetable facts.

AI delegation data and queued AI actions are encrypted separately before storage in Supabase with a dedicated Gapwise AI encryption key held by the Gapwise AI Vercel service. The Gapwise AI service can decrypt that delegated copy transiently to answer an authorized tool call. It does not receive Gapwise's primary private-cloud data-encryption key.

When an authorized AI client calls a Gapwise tool, the specific tool output needed for that request is sent to that AI provider. The provider may process conversation and tool data under the provider's own terms, privacy policy, account settings, and retention practices. Gapwise does not control an external AI provider's handling of data after the user authorizes and invokes that provider.

AI write tools do not directly rewrite the canonical encrypted timetable. They create encrypted, revision-bound pending actions. The Gapwise browser validates and applies supported actions to canonical private state. Imported academic meetings cannot be targeted by those write tools.

Supabase OAuth access tokens identify the exact OAuth client, and Gapwise uses that client identity together with row-level security and a per-user approval record to isolate third-party AI access from the primary encrypted timetable/key store and unrelated signed-in features. Revoking Gapwise AI removes the delegated snapshot and queued AI actions and removes the corresponding Gapwise AI client approval; Gapwise also requests revocation of the associated OAuth grant.

## Encryption trust model

Gapwise uses browser-side AES-256-GCM application-layer encryption. Per-user data-encryption keys are wrapped under a versioned key-encryption key held by the Vercel server environment. A signed-in device can ask the Vercel key broker to unwrap and re-wrap those data keys to a device public key.

This means Supabase does not receive readable timetable payloads, but Vercel is inside the cryptographic trust boundary. The optional Gapwise AI service is also inside the trust boundary for the separate, explicitly delegated AI copy when that feature is enabled. Gapwise therefore does **not** claim end-to-end encryption, zero-knowledge encryption, or that only the user can ever decrypt cloud data.

## Friend availability and community state

Friend overlap uses a separate encrypted, deliberately lossy availability capsule. It excludes course names, room numbers, buildings, activity labels, and the full timetable. A successful common-gap request requires a mutually accepted friendship and returns at most three rounded common free windows for the selected term.

Optional community features may also store account-linked crowd reports, rate-limit metadata, publisher state, and audit metadata needed to operate and protect those features. Crowd reports are treated as time-bounded signals; exact provider backup and log retention is not established by the repository.

## Operational analytics, diagnostics, and cookies

Gapwise uses Vercel Web Analytics and Speed Insights for aggregate operational and performance measurements. Timetable contents, AI delegated snapshot plaintext, AI action plaintext, friend data, precise live location, and authentication tokens are not intentionally sent to those analytics products.

The current Gapwise application does not add advertising or cross-site tracking cookies, and it does not contain advertising. Vercel documents Web Analytics as cookie-free and privacy-focused. A cookie banner is therefore not added merely because these current telemetry components are present. If telemetry changes to use non-essential cookies, identifiable profiling, advertising, or other tracking that requires consent in an applicable jurisdiction, Gapwise must reassess notice and consent before that change ships.

Server diagnostics can include operational request/error information. Credential-shaped data is redacted from expanded catastrophic-error diagnostics before it reaches application logging. Hosting and other providers can independently retain ordinary infrastructure logs under their own settings and policies.

Vercel, Supabase, Microsoft, Google, GitHub, OpenFreeMap-related infrastructure, and any AI provider a user chooses to connect may process technical or account information when their respective hosting, authentication, mapping, operational, or AI services are used.

Gapwise does not sell personal data.

## Retention and deletion

Cloud data remains until it is replaced, explicitly deleted, or the account is deleted, subject to infrastructure logs/backups maintained by the hosting providers under their own retention practices.

An enabled AI delegation remains until it is replaced, revoked, or the account is deleted. Queued AI actions are retained as part of the AI bridge until they are completed/rejected or AI access/account data is removed; revoking the delegation removes all queued and completed AI action rows held by the Gapwise AI bridge for that user.

A signed-in user can choose **Delete account and cloud data** from the account menu. The application permanently deletes the Supabase authentication account and user-owned application records through database cascades, then clears that user's Gapwise private state from the current browser. Account deletion is permanent.

Clearing browser/site data removes locally stored Gapwise data from that browser but does not by itself delete an existing cloud account or revoke an external AI provider connection.

Provider logs and backups may have separate retention and deletion behavior that the application cannot truthfully infer from source code. Production settings and contractual retention commitments require provider-level verification.

## Access, correction, portability, objections, and privacy requests

Privacy rights depend on the law and facts that apply to the service and user; presence in a particular country does not by itself establish territorial scope. Where applicable, a person may be entitled to ask what personal information Gapwise holds about them, request access or correction, request deletion or portability, object to certain processing, or withdraw consent for optional processing.

Gapwise provides self-service controls for local data, optional cloud/AI features, AI delegation revocation, and account/cloud-data deletion. No general-purpose self-service account-data export is currently represented as a shipped feature.

For a privacy request that cannot be completed with product controls, contact the repository owner through <https://github.com/andrewmuratov> and ask for a private privacy-request channel. **Do not put personal information, identity evidence, account data, or legal documents in a public GitHub issue.** A dedicated monitored privacy contact, accountable privacy role, identity-verification procedure, and response workflow remain administrative items requiring owner confirmation and, where appropriate, qualified legal review.

## Security and privacy incidents

The primary private-cloud security design and trust boundaries are documented in [`docs/PRIVATE_CLOUD_SECURITY_ARCHITECTURE.md`](docs/PRIVATE_CLOUD_SECURITY_ARCHITECTURE.md). Gapwise also maintains [`docs/INCIDENT_RESPONSE.md`](docs/INCIDENT_RESPONSE.md), which requires privacy triage when personal information may have been accessed, lost, changed, disclosed, or made unavailable without authorization.

The runbook deliberately does not promise a universal breach-notification deadline. Reporting, notification, recordkeeping, and preservation duties depend on the applicable law, contracts, risk assessment, affected data, and incident facts. For example, if Canada's PIPEDA applies to the activity, its breach regime includes breach recordkeeping and reporting/notification when the statutory real-risk-of-significant-harm threshold is met. Applicable duties must be confirmed for the actual incident rather than copied from a generic checklist.

Security reports should follow [`SECURITY.md`](SECURITY.md).

## Accountability and provider verification

The implementation/data inventory is maintained in [`docs/TRUST_DATA_INVENTORY.md`](docs/TRUST_DATA_INVENTORY.md). It intentionally separates repository-verified behavior from provider, operator, and legal facts that require human evidence.

Before making stronger public claims, the owner still needs to verify or assign, as applicable:

- the accountable privacy role and monitored privacy-request channel;
- the operator's legal/business structure and the privacy laws that apply to its actual activities;
- production provider regions, retention/log settings, contractual terms, and privacy/data-processing commitments;
- any jurisdiction-specific request response, breach record, regulator, representative, or transfer obligations; and
- changed analytics, marketing, payment, or profiling behavior before those features are introduced.

## Changes

This notice may be updated when Gapwise changes its data handling or service providers. Material data-handling changes should be reflected here before the changed behavior is promoted to users.
