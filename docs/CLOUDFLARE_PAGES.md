# Cloudflare Pages deployment

Gapwise guest mode and the legacy cloud path are deployable as a client-only static Vite
application. They need no Worker, Pages Function, KV, D1, paid map API, or other paid Cloudflare
service. The encrypted private-cloud path is different: its key-broker and common-gap endpoints are
Vercel Node functions. Do not enable `VITE_PRIVATE_CLOUD_MODE=shadow` or `encrypted` on a standalone
Cloudflare Pages deployment unless those same-origin API routes have been deliberately implemented,
reviewed, and verified on that platform.

## Build settings

Connect the repository in Cloudflare Pages and use:

```text
Production branch: development (or the branch you intentionally release)
Build command: bun run build
Build output directory: dist
Root directory: /
```

Cloudflare's current build image detects `bun.lock`. If a fixed toolchain is desired,
set `BUN_VERSION` to the version used locally.

`public/_redirects` supplies the SPA fallback:

```text
/* /index.html 200
```

`public/_headers` supplies a restrictive Content Security Policy and other security
headers while allowing the isolated OpenFreeMap tile origin and optional Supabase
project connections. Fonts use the local system stack and require no external origin.

## Optional environment variables

Guest mode requires no environment variables. To enable account and sync controls,
set these for Production (and Preview only if desired):

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_PRIVATE_CLOUD_MODE=off
```

These values are compiled into the public client bundle, so only the browser-safe
publishable/anon key is allowed. Never configure a service-role key.

`GAPWISE_KEK_V<n>` is not a Pages variable. Never copy a production Vercel KEK into Cloudflare,
into a `VITE_` variable, or into a static build. Production private-cloud activation is governed by
[`PRIVATE_CLOUD_MIGRATION_RUNBOOK.md`](PRIVATE_CLOUD_MIGRATION_RUNBOOK.md).

After the first deploy, add the final Pages origin to Supabase's allowed redirect URLs,
GitHub OAuth configuration, and email magic-link redirect configuration as described in
`docs/SUPABASE.md`.

## Verification

Run locally before deploying:

```sh
bun install --frozen-lockfile
bun test
bun run typecheck
bun run build
```

Confirm `dist/index.html`, `dist/_redirects`, and `dist/_headers` exist. Test a deep-link
refresh, guest import, map attribution, and—if configured—the GitHub and email magic-link sign-in round trips.
