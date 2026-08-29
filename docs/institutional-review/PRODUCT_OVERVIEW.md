# Gapwise one-page product overview

> **INTERNAL DRAFT — OWNER REVIEW REQUIRED BEFORE SHARING**

## Product and audience

Gapwise for UTM is an independent, privacy-focused web application for University of Toronto Mississauga students. It turns a student-provided ACORN `.ics` timetable export into Today, Timetable, Gap Plan, and campus day-route views. It is not an official University of Toronto service, and this draft does not claim university review, approval, sponsorship, or endorsement.

## Current product boundary

- Timetable parsing occurs in the browser; the original `.ics` file is not uploaded by the application.
- Guest mode remains useful without an account.
- Optional sign-in uses Supabase Auth with user-selected Google, Microsoft, or GitHub identity providers.
- Optional private cloud state is encrypted in the browser before storage. Gapwise does **not** describe the design as end-to-end encrypted or zero knowledge because the deployed origin/session/key-broker trust boundary remains relevant.
- Live location is opt-in and foreground-only; background tracking is outside the product guardrail.
- Optional AI/MCP delegation is permissioned and separate from public campus APIs and ordinary private account state. The exact delegated-resource contract must be reconciled with current `gapwise-ai` deployment before institutional reliance.

## System shape

The browser hosts timetable parsing, user interaction, local state, routing, and private-state cryptography. Vercel serves the web application and server/API surfaces. Supabase provides authentication and optional account/cloud storage. The maintained trust inventory is the authority for current processor/data-category mapping; provider contractual, residency, backup, log-retention, and external-dashboard facts remain qualified wherever that inventory says human/provider confirmation is required.

## Reviewer-relevant safeguards

- Browser-local timetable import and data minimization are core design boundaries.
- Repository safeguards are traceable by category: authorization in `../../tests/private-cloud-api.test.ts`; tenant isolation/RLS in `../../tests/friend-overlap.test.ts` and `../../tests/security.test.ts`; runtime hardening in `../../tests/runtime-security-regressions.test.ts`; dependency and supply-chain controls in `../../tests/security.test.ts` plus the CI production-dependency audit; deployment headers in `../../tests/deployment-security.test.ts`; and private-cloud cryptography/sync in `../../tests/crypto.test.ts`, `../../tests/encrypted-sync-service.test.ts`, and `../../tests/private-cloud-api.test.ts`. The higher-level control map is `../SECURITY_CONTROL_MATRIX.md`. These are repository and CI evidence, not an independent audit or proof of production-only configuration.
- A public vulnerability-disclosure policy and canonical `security.txt` are implemented. GitHub private vulnerability reporting is the preferred private intake when it is available; if it is unavailable, the policy directs reporters to contact the repository owner through the GitHub profile and request a private channel before sending exploit details.
- Incident-response and operational-trust procedures are maintained in `../INCIDENT_RESPONSE.md`; a runbook does not prove a response exercise, uptime level, RTO/RPO, or successful recovery.
- A public `/accessibility` statement and internal accessibility evidence worksheet distinguish current automated evidence from unperformed manual/independent assessment.
- A public `/trust` surface summarizes evidence-backed trust boundaries and links to canonical source material.
- Actual backup/restore exercise status must be taken from the relevant retained exercise evidence, not inferred from a runbook or helper script.

## Open institutional-review items

Before institutional reliance, reconcile this package against the exact deployed build and current cross-repository evidence; complete owner/legal/provider confirmations; obtain any institution-specific legal/privacy/security review; and keep independent penetration testing, insurance, certifications, measured service levels, and university authorization explicitly unclaimed unless they actually occur.

See [README.md](README.md) and [EVIDENCE_REGISTER.md](EVIDENCE_REGISTER.md) for current package status and gaps.
