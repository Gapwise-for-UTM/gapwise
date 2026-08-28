# Gapwise one-page product overview

> **INTERNAL DRAFT — OWNER REVIEW REQUIRED BEFORE SHARING**

## Product and audience

Gapwise for UTM is an independent, privacy-focused web application for University of Toronto Mississauga students. It turns a student-provided ACORN `.ics` timetable export into Today, Timetable, Gap Plan, and campus day-route views. It is not an official University of Toronto service, and this draft does not claim university review, approval, sponsorship, or endorsement.

## Current product boundary

- Timetable parsing occurs in the browser; the original `.ics` file is not uploaded by the application.
- Guest mode remains useful without an account.
- Optional sign-in uses Supabase Auth.
- Optional private cloud state is encrypted in the browser before storage. Gapwise does **not** describe the design as end-to-end encrypted or zero knowledge because the deployed origin/session/key-broker trust boundary remains relevant.
- Live location is opt-in and foreground-only; background tracking is outside the product guardrail.
- Optional AI/MCP delegation is permissioned and separate from public campus APIs and ordinary private account state. The exact delegated-resource contract must be reconciled with current `gapwise-ai` code before institutional sharing.

## System shape

The browser hosts timetable parsing, user interaction, local state, routing, and private-state cryptography. Vercel serves the web application and server/API surfaces. Supabase provides authentication and optional server-side account storage. The maintained Phase 1 trust inventory is the authority for current processor/data-category mapping; provider contractual, residency, and external-dashboard facts remain qualified wherever that inventory says human/provider confirmation is required.

## Reviewer-relevant safeguards

- Browser-local timetable import and data minimization are core design boundaries.
- Authorization, tenant isolation, runtime, dependency, deployment, and private-cloud controls have repository tests/configuration evidence; those artifacts are not an independent audit.
- A public vulnerability-disclosure/security.txt implementation is currently being validated in core PR #184.
- Incident-response and operational-trust procedures are currently being validated in core PR #185. The existence of a runbook does not prove a response exercise, uptime level, RTO/RPO, or successful recovery.
- Accessibility regression coverage is catalogued in `../ACCESSIBILITY_MATRIX.md`; Phase 7 governance is still in progress and no formal WCAG conformance or third-party certification is claimed.
- Actual backup/restore exercise status must be taken from Linear AND-154, not inferred from a runbook or helper script.

## Open institutional-review items

Before institutional reliance, reconcile the package against the exact deployed build and current evidence; finish/publish the remaining AND-131 phases; complete any owner/legal/provider confirmations; obtain any institution-specific legal/privacy/security review; and keep independent penetration testing, insurance, certifications, and university authorization explicitly unclaimed unless they actually occur.

See [README.md](README.md) and [EVIDENCE_REGISTER.md](EVIDENCE_REGISTER.md) for current package status and gaps.
