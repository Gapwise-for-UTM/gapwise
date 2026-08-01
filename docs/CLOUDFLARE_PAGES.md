# Cloudflare Pages deployment

Gapwise is a client-only static Vite application. It needs no Worker, Pages Function,
KV, D1, paid map API, or other paid Cloudflare service.

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
headers while allowing the isolated OpenFreeMap tile origin, Google-hosted fonts, and
optional Supabase project connections.

## Optional environment variables

Guest mode requires no environment variables. To enable account and sync controls,
set these for Production (and Preview only if desired):

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

These values are compiled into the public client bundle, so only the browser-safe
publishable/anon key is allowed. Never configure a service-role key.

After the first deploy, add the final Pages origin to Supabase's allowed redirect URLs
and GitHub OAuth configuration as described in `docs/SUPABASE.md`.

## Verification

Run locally before deploying:

```sh
bun install
bun test
bun run build
```

Confirm `dist/index.html`, `dist/_redirects`, and `dist/_headers` exist. Test a deep-link
refresh, guest import, map attribution, and—if configured—the GitHub sign-in round trip.
