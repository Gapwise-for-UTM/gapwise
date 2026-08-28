# Security Policy

## Supported deployment

Security fixes target the current production deployment and the `main` branch. Preview branches are test environments and must never share the production key-encryption key.

## Reporting a vulnerability

The public Vulnerability Disclosure Policy and canonical contact details are at
<https://gapwise.ca/security>. Machine-readable contact details are published at
<https://gapwise.ca/.well-known/security.txt>.

Please do not publish exploitable security details, credentials, authentication tokens, private timetable data, or cryptographic key material in a public issue or pull request.

Use GitHub private vulnerability reporting for this repository when it is available. If that option is unavailable, contact the repository owner through the GitHub profile and request a private reporting channel before sending exploit details.

A useful report includes:

- the affected URL, route, or component;
- clear reproduction steps using non-sensitive test data;
- the security impact;
- browser/runtime information when relevant; and
- any suggested mitigation, if known.

Do not access another person's account or data, perform denial-of-service testing against production, exfiltrate secrets, or intentionally retain data that is not yours while testing.

## Security model

Gapwise uses browser-side application-layer encryption for optional private cloud data. Supabase stores ciphertext and account/relationship metadata. A Vercel-hosted key broker is inside the trust boundary because it can unwrap per-user data-encryption keys using a server-held versioned key-encryption key.

Accordingly, Gapwise does not claim end-to-end encryption, zero knowledge, or immunity from malicious same-origin JavaScript. The detailed threat model is in [`docs/PRIVATE_CLOUD_SECURITY_ARCHITECTURE.md`](docs/PRIVATE_CLOUD_SECURITY_ARCHITECTURE.md).

## Secret handling

Production KEKs, Supabase secret/service-role credentials, OAuth secrets, and access tokens must never be committed to the repository, placed in browser-exposed `VITE_` variables, pasted into issues, or included in screenshots/logs. Production and Preview use separate KEKs.

If a production secret is exposed, treat it as compromised and rotate it rather than attempting to hide the exposure.
