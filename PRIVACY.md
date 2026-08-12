# Gapwise Privacy Notice

_Last updated: 2026-08-11_

Gapwise for UTM is an independent student project. It is not affiliated with, endorsed by, or an official service of the University of Toronto.

This notice describes the data handling of the public Gapwise application at `gapwise-utm.vercel.app`.

## What stays in your browser

- The original ACORN `.ics` file is parsed locally and is not uploaded.
- Gap calculations and campus route calculations run in the browser.
- Guest timetables remain local to the browser.
- Signed-in users may keep non-extractable cryptographic keys and encrypted private records in IndexedDB when the browser supports durable `CryptoKey` storage.

## Optional signed-in cloud features

If you sign in with GitHub or a passwordless email link, Supabase processes the authentication account and browser session required for that feature.

If you explicitly enable private cloud sync, Gapwise encrypts the private timetable/settings payload in the browser before it is written to Supabase. Supabase stores ciphertext, cryptographic metadata, and the minimum account/relationship metadata required to provide the feature.

The original `.ics` file is never stored in the cloud. Gapwise does not store a history of calculated routes or gap recommendations.

## Encryption trust model

Gapwise uses browser-side AES-256-GCM application-layer encryption. Per-user data-encryption keys are wrapped under a versioned key-encryption key held by the Vercel server environment. A signed-in device can ask the Vercel key broker to unwrap and re-wrap those data keys to a device public key.

This means Supabase does not receive readable timetable payloads, but Vercel is inside the cryptographic trust boundary. Gapwise therefore does **not** claim end-to-end encryption, zero-knowledge encryption, or that only the user can ever decrypt cloud data.

## Friend availability

Friend overlap uses a separate encrypted, deliberately lossy availability capsule. It excludes course names, room numbers, buildings, activity labels, and the full timetable. A successful common-gap request requires a mutually accepted friendship and returns at most three rounded common free windows for the selected term.

## Operational analytics

Gapwise uses Vercel Web Analytics and Speed Insights for aggregate operational and performance measurements. Timetable contents and authentication tokens are not intentionally sent to those analytics products.

Vercel, Supabase, GitHub (when GitHub sign-in is used), and the user's email provider (when passwordless email sign-in is used) may process technical or account information as independent service providers under their own policies.

Gapwise does not sell personal data and does not contain advertising.

## Retention and deletion

Cloud data remains until it is replaced, explicitly deleted, or the account is deleted, subject to infrastructure logs/backups maintained by the hosting providers under their own retention practices.

A signed-in user can choose **Delete account and cloud data** from the account menu. The application permanently deletes the Supabase authentication account and user-owned application records through database cascades, then clears that user's Gapwise private state from the current browser. Account deletion is permanent.

Clearing browser/site data removes locally stored Gapwise data from that browser but does not by itself delete an existing cloud account.

## Security

The security design and trust boundaries are documented in [`docs/PRIVATE_CLOUD_SECURITY_ARCHITECTURE.md`](docs/PRIVATE_CLOUD_SECURITY_ARCHITECTURE.md). Security reports should follow [`SECURITY.md`](SECURITY.md).

## Changes

This notice may be updated when Gapwise changes its data handling or service providers. Material data-handling changes should be reflected here before the changed behavior is promoted to users.
