# Trust/data inventory provider supplement — 2026-08-30

**Base inventory:** [`TRUST_DATA_INVENTORY.md`](TRUST_DATA_INVENTORY.md)  
**Detailed evidence:** [`PROVIDER_PRIVACY_AUDIT_2026-08-30.md`](PROVIDER_PRIVACY_AUDIT_2026-08-30.md)  
**Core baseline:** `2f76a34e42890eed81947854de56adbb87c0f650`

The base trust/data inventory intentionally left provider/account facts in its human-confirmation column. This dated supplement reconciles the production evidence that became verifiable after that inventory snapshot. It does not rewrite implementation facts from the base inventory and does not turn remaining legal/operator unknowns into assumptions.

If a provider fact below conflicts with an older "confirmation still required" note in the base inventory, use this dated evidence for the 2026-08-30 production state. Re-verify it after plan, provider, OAuth, analytics, map, or deployment changes.

| Service / boundary                    | Verified on 2026-08-30                                                                                                                                                                                                                          | Still not established                                                                                                                         |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Vercel core hosting                   | Connected team is **Hobby**; exact core main `2f76a34e…` deployed `READY`; Hobby runtime-log API exposes about one hour; fresh retained-window credential searches were negative                                                                | Team Data Preferences toggle; complete member/RBAC/2FA roster; dashboard-only settings; legal role/transfer analysis                          |
| Vercel Web Analytics / Speed Insights | Components are mounted in the app; provider currently documents Web Analytics as cookie-free/anonymized                                                                                                                                         | Any future telemetry change; jurisdiction-specific consent analysis; dashboard-only analytics settings not exposed by connected APIs          |
| Vercel contractual privacy            | Current public DPA states processor coverage for Pro/Enterprise; connected team is Hobby, so DPA coverage is **not assumed**                                                                                                                    | Whether Gapwise needs a processor DPA; what agreement/plan should apply if it does; counsel/institutional requirements                        |
| Supabase hosting                      | Organization is **Free**; project is `ACTIVE_HEALTHY` in `ca-central-1`; no Storage buckets                                                                                                                                                     | Exact plan-dependent log retention; dashboard-only access/settings; legal transfer analysis                                                   |
| Supabase database/security            | Current public tables/privileged RPC boundaries were reviewed; private rate-limit tables have only `postgres` grants; account-deletion function is JWT protected and rejects delegated AI tokens                                                | Operator access roster; future advisor changes; provider backup/log deletion lag                                                              |
| Supabase auth                         | Leaked-password protection currently disabled, but aggregate live auth data shows 0 password-auth users out of 7 current users                                                                                                                  | Password-security posture if password sign-in is introduced; provider-side auth-log retention                                                 |
| Supabase backups                      | Provider docs recommend Free projects maintain their own off-site logical backups rather than relying on paid-plan downloadable backup access                                                                                                   | The separate encrypted off-site backup and disposable restore drill; exact provider-internal backup lifecycle beyond documented plan behavior |
| Google OAuth                          | App direct OIDC path requests `openid email profile`; fallback adds no app-specific sensitive scopes                                                                                                                                            | Provider/dashboard client configuration and provider-side retention                                                                           |
| Microsoft OAuth                       | App requests `email` through Supabase Azure and does not request `offline_access`                                                                                                                                                               | Provider/dashboard client configuration and provider-side retention                                                                           |
| GitHub OAuth                          | App adds no custom extra scopes in the Supabase sign-in call                                                                                                                                                                                    | Exact provider default grants/dashboard client configuration and provider-side retention                                                      |
| Identity-provider token handling      | No app path found that persists provider access/refresh tokens for later provider API use                                                                                                                                                       | Provider internal token/grant records                                                                                                         |
| OpenFreeMap                           | Browser map path uses `tiles.openfreemap.org`; provider says no cookies/tracking, regular logs omit IP by default, anonymized logs may be retained indefinitely, temporary incident IP logging is capped at 30 days, and Cloudflare may be used | Provider changes after this date; legal role/transfer characterization                                                                        |
| Gapwise AI hosting                    | Separate Vercel production project was `READY`; recent retained logs/errors showed no bearer/JWT-shaped exposure in the inspected window                                                                                                        | Real Claude/ChatGPT client matrices, revoke/re-auth exercises, and post-matrix exact-head release verification tracked separately             |

## Public-notice reconciliation

The hosted `/privacy` page and root `PRIVACY.md` are updated alongside this supplement to:

- name OpenFreeMap as an actual browser-side map delivery recipient;
- distinguish cookie-free Vercel Web Analytics from ordinary hosting/runtime logs;
- avoid implying that a Canada Central Supabase primary region means all provider processing is Canada-only;
- avoid claiming Vercel Pro/Enterprise DPA coverage for the connected Hobby account; and
- keep provider log/backup retention and external-provider deletion behavior explicitly bounded.

## Remaining human/operator/legal queue

The following remain outside repository proof and should stay open rather than being converted into a compliance claim:

1. verify Vercel Data Preferences and relevant provider/team access controls;
2. determine and put in place any required processor agreements or transfer mechanisms;
3. confirm any required Supabase DPA/account legal-document status;
4. complete the encrypted off-site backup and disposable restore drill;
5. establish the accountable privacy role, monitored request channel, identity-verification/request workflow, and breach record process; and
6. obtain qualified legal review for applicable law, controller/operator identity, lawful bases, territorial scope, rights, transfers, and notification duties.
