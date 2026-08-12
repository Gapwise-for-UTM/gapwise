# Static guest-mode fallback

Gapwise's core timetable parsing, gap analysis, recommendations, and bundled campus routing are local-first and can be served as a static Vite application. This document exists as a vendor-portability/free-tier escape hatch, not as the production deployment guide.

Production uses Vercel because encrypted cloud sync and friend common-gap discovery require the reviewed same-origin `/api/key-broker` and `/api/common-gap` Node functions.

## What a static fallback supports

A backend-free static deployment can support:

- ACORN `.ics` import and parsing in the browser;
- local timetable and personal-item use;
- gap calculations and recommendations;
- bundled UTM routing and OpenFreeMap tiles; and
- local guest persistence supported by the browser.

For the safest emergency/static fallback, omit the Supabase browser variables entirely so the build runs as guest-only.

A standalone static host does **not** provide production encrypted cloud restore/sync or privacy-preserving friend common-gap requests unless equivalent same-origin server endpoints, KEK handling, authentication checks, and request boundaries are deliberately implemented and reviewed on that platform. Never copy a production Vercel KEK into frontend configuration.

## Cloudflare Pages example

If Cloudflare Pages is used for the guest-only fallback, a simple configuration is:

```text
Production branch: main
Build command: bun run build
Build output directory: dist
Root directory: /
```

`public/_redirects` supplies a static-host SPA fallback and `public/_headers` mirrors the restrictive browser/security headers used by production. These files are portability helpers; Vercel production uses `vercel.json` as its authoritative deployment configuration.

Do not set a retired private-cloud rollout flag. The application source is permanently encrypted-only, and the full signed-in cloud feature set depends on the reviewed server endpoints rather than a client mode switch.

## Verification

Before relying on a static fallback, run:

```sh
bun install --frozen-lockfile
bun run typecheck
bun run lint
bun test
bun run build
bun run format:check
```

Then verify deep-link refresh, guest import, timetable/gap behavior, routing, map attribution, and the expected absence of signed-in private-cloud functionality.
