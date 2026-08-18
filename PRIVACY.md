# Gapwise Privacy Notice

_Last updated: 2026-08-18_

Gapwise for UTM is an independent student project. It is not affiliated with, endorsed by, or an official service of the University of Toronto.

This notice describes the data handling of the public Gapwise application at `gapwise.ca` and the optional Gapwise AI integration service.

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

## Friend availability

Friend overlap uses a separate encrypted, deliberately lossy availability capsule. It excludes course names, room numbers, buildings, activity labels, and the full timetable. A successful common-gap request requires a mutually accepted friendship and returns at most three rounded common free windows for the selected term.

## Operational analytics

Gapwise uses Vercel Web Analytics and Speed Insights for aggregate operational and performance measurements. Timetable contents, AI delegated snapshot plaintext, AI action plaintext, and authentication tokens are not intentionally sent to those analytics products.

Vercel, Supabase, Microsoft, Google, GitHub, and any AI provider a user chooses to connect may process technical or account information as independent service providers when their respective hosting, authentication, operational, or AI services are used.

Gapwise does not sell personal data and does not contain advertising.

## Retention and deletion

Cloud data remains until it is replaced, explicitly deleted, or the account is deleted, subject to infrastructure logs/backups maintained by the hosting providers under their own retention practices.

An enabled AI delegation remains until it is replaced, revoked, or the account is deleted. Queued AI actions are retained as part of the AI bridge until they are completed/rejected or AI access/account data is removed; revoking the delegation removes all queued and completed AI action rows held by the Gapwise AI bridge for that user.

A signed-in user can choose **Delete account and cloud data** from the account menu. The application permanently deletes the Supabase authentication account and user-owned application records through database cascades, then clears that user's Gapwise private state from the current browser. Account deletion is permanent.

Clearing browser/site data removes locally stored Gapwise data from that browser but does not by itself delete an existing cloud account or revoke an external AI provider connection.

## Security

The primary private-cloud security design and trust boundaries are documented in [`docs/PRIVATE_CLOUD_SECURITY_ARCHITECTURE.md`](docs/PRIVATE_CLOUD_SECURITY_ARCHITECTURE.md). The separate AI bridge's architecture, privacy rules, and threat model are maintained in the private `gapwise-ai` repository while the integration is under development. Security reports should follow [`SECURITY.md`](SECURITY.md).

## Changes

This notice may be updated when Gapwise changes its data handling or service providers. Material data-handling changes should be reflected here before the changed behavior is promoted to users.
