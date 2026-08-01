# Vercel deployment

Gapwise is a client-only Vite SPA. Connect the GitHub repository to Vercel; `vercel.json` selects Vite, installs with Bun, builds `dist`, provides the TanStack Router SPA fallback, security headers, and cache rules. Vercel Git integration handles previews and production; GitHub Actions does not deploy.

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in both Production and Preview when cloud features are wanted. They are browser-safe configuration; never add a database password, GitHub OAuth secret, or service-role key. Guest deployments need no variables. Follow [SUPABASE.md](SUPABASE.md) for preview redirect patterns and add the exact production origin once assigned.

After deployment, verify `/`, a deep-link refresh, `/site.webmanifest`, `/favicon.svg`, `/icon-192.png`, and `/icon-512.png`. Confirm maps, Google fonts, Supabase OAuth/WebSockets, and MapLibre blob workers are permitted by CSP. Cloudflare files in `public/` remain supported independently.
