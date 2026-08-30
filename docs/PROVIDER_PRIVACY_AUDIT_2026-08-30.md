# Production provider privacy audit — 2026-08-30

**Linear:** AND-174  
**Core baseline:** `2f76a34e42890eed81947854de56adbb87c0f650`  
**Scope:** production provider/account facts, OAuth data minimization, map delivery, retention boundaries, and hosted privacy-notice reconciliation

This is a dated evidence record, not a legal opinion or a blanket compliance claim. It distinguishes live account evidence, repository/runtime evidence, provider-published facts, and items that still require operator or legal confirmation.

## Evidence classes

- **Live** — read from the connected production provider account on 2026-08-30.
- **Repository** — verified from the exact application source or deployed commit.
- **Provider** — stated in the provider's current public documentation or legal notice.
- **Open** — not established by source code or the connected provider APIs; do not publish as fact until separately verified.

## Vercel

### Live production/account evidence

- **Live:** the Gapwise Vercel team is on the **Hobby** plan.
- **Live:** the core `gapwise` project is linked to `andrewmuratov/gapwise` and serves `gapwise.ca`, `www.gapwise.ca`, and `api.gapwise.ca`.
- **Live:** core commit `2f76a34e42890eed81947854de56adbb87c0f650` deployed successfully to production and reached `READY`.
- **Live:** the Hobby runtime-log window exposed by the connected Vercel API is approximately one hour. Fresh searches on the exact merged production deployment found no `Bearer` or `service_role` matches in the retained window.
- **Live:** reviewed production build output contained ordinary dependency/build/chunk/deployment information and no whole-environment dump or credential-shaped output was observed.
- **Live:** the `gapwise-ai` Vercel project is deployed separately and was `READY` on its then-current production main. Recent production error/log checks did not expose bearer/JWT-shaped material in the available window.

### Provider-published behavior

- **Provider:** Vercel Web Analytics is described as privacy-friendly, first-party analytics. Current Vercel documentation states that Web Analytics stores anonymized data and does not use cookies; visitor identification is derived from a hash that resets rather than a persistent cross-site identifier. See <https://vercel.com/docs/analytics> and Vercel's current analytics/privacy documentation.
- **Provider:** Vercel's current Privacy Notice describes service-generated information such as logs, IP-derived coarse location, diagnostics, deployment metadata, system configuration, and telemetry. See <https://vercel.com/legal/privacy-notice>.
- **Provider:** Vercel's Data Processing Addendum effective 2026-03-31 states that its processor terms apply to customers on **Enterprise and Pro** plans. The connected Gapwise team is Hobby, so this audit does **not** assume that Vercel's published DPA applies to the current Gapwise account. See <https://vercel.com/legal/dpa>.
- **Provider:** Vercel's public privacy materials state that for Hobby and Pro users, de-identified information may be disclosed to AI business partners for model/product improvement subject to the team's data preferences.

### Open Vercel items

- **Open:** the connected tools do not expose the team's current **Data Preferences** toggle. The operator must verify the current setting if code/agent-chat training or disclosure preferences matter to the project's privacy posture.
- **Open:** project/team membership, RBAC/access roster, 2FA status, and dashboard-only privacy/security toggles are not fully exposed by the connected project APIs used in this audit.
- **Open:** if applicable law or an institutional counterparty requires a processor DPA for hosted end-user data, the current Hobby-plan position must be resolved through an eligible Vercel agreement/plan or other provider/legal confirmation; no DPA coverage is claimed here.
- **Open:** legal characterization of Vercel's role for each Gapwise data category and any required international-transfer mechanism requires legal review.

## Supabase

### Live production/account evidence

- **Live:** organization `pzgchytzuikqwytawuux` is on the **Free** plan.
- **Live:** production project `olrtvbblxbgcxbhvujaw` is `ACTIVE_HEALTHY` in AWS region `ca-central-1` (Canada Central).
- **Live:** the active project has zero rows in `storage.buckets`; the shipped application also has no Supabase Storage object-bucket data path.
- **Live:** the only deployed Edge Function is `delete-account`; it is active with JWT verification enabled. Its source revalidates the bearer token with Supabase Auth and rejects delegated OAuth/MCP client tokens before using admin deletion authority.
- **Live:** the two `private` rate-limit tables reported by Security Advisor as RLS-without-policy are granted only to `postgres`, not `anon` or `authenticated`.
- **Live:** authenticated-callable friend/key-rotation `SECURITY DEFINER` functions were inspected. Their live definitions use a fixed empty `search_path`, direct-session/`auth.uid()` ownership checks, restricted grants, and bounded argument validation where applicable.
- **Live:** Supabase currently warns that leaked-password protection is disabled. Aggregate inspection found zero password-auth users among seven current auth users. This does not justify enabling password sign-in without reassessing the provider setting.

### Provider-published behavior

- **Provider:** Supabase states that a project's primary Postgres database, Auth service, and Storage objects are hosted in the project's chosen primary region, while logs, backups, Edge Function execution, exports, and subprocessors can affect a broader residency/transfer analysis. See <https://supabase.com/docs/guides/security/gdpr-compliance> and <https://supabase.com/docs/guides/platform/regions>.
- **Provider:** Supabase states that Pro, Team, and Enterprise projects receive plan-specific automated daily-backup access and recommends that **Free** projects regularly create their own logical exports and maintain off-site backups. See <https://supabase.com/docs/guides/platform/backups>.
- **Provider:** Supabase's Logs Explorer can contain Auth, API/edge, Edge Function, Postgres, Realtime, and Storage logs. API/edge logs can contain permitted network metadata such as `cf-connecting-ip`, `cf-ipcountry`, user agent, referrer, and `x-real-ip`; retention depends on plan. See <https://supabase.com/docs/guides/monitoring-and-debugging/logs>.
- **Provider:** Supabase publishes a DPA for customers that need a formal data-processing contract. See <https://supabase.com/docs/guides/security/gdpr-compliance> and <https://supabase.com/legal/dpa>.

### Open Supabase items

- **Open:** exact current Free-plan log-retention duration was not established by the connected Management API; the public docs state that retention is plan-dependent. Do not invent a number.
- **Open:** the connected APIs used here do not establish that a Supabase DPA has been executed or otherwise legally binds this specific organization. If required, obtain/confirm the applicable agreement rather than treating a public template as account evidence.
- **Open:** Free-plan backup posture does not substitute for the project's separate encrypted off-site backup and restore-drill requirement.
- **Open:** organization membership/access posture and dashboard-only security settings should be recorded separately if they become launch/institutional requirements.

## OAuth identity providers

The application requests identity-only data and does not implement provider-API access for email, files, calendars, repositories, or other user content.

- **Repository — Google:** the direct Google OIDC path requests `openid email profile`. The Supabase Google fallback does not add application-specific sensitive scopes.
- **Repository — Microsoft:** the Supabase Azure path explicitly requests `email`; the application does not request `offline_access`.
- **Repository — GitHub:** the Supabase GitHub path does not add application-specific extra scopes.
- **Repository:** the sign-in implementation consumes the resulting Supabase session/account identity. No application path was found that persists identity-provider access or refresh tokens for later provider API calls.
- **Provider boundary:** identity providers can retain their own authentication/security records and grant state under their own policies. Account/provider-side retention is not controlled by deleting the Gapwise account.

These statements are deliberately limited to the app-requested scopes and implementation. Provider defaults and dashboard OAuth-client configuration can change independently and should be rechecked if authentication configuration changes.

## OpenFreeMap / map delivery

### Repository/runtime evidence

- **Repository:** the production map configuration requests OpenFreeMap style/tile resources from `https://tiles.openfreemap.org`; OpenStreetMap is data provenance rather than the browser's primary runtime tile host.
- **Repository:** map requests are ordinary direct browser network requests. Gapwise does not attach timetable records, account tokens, friend data, or precise live-location coordinates as custom analytics fields to the tile request path.

### Provider-published behavior

OpenFreeMap's current Privacy Policy (<https://openfreemap.org/privacy/>) states:

- it is operated by Hyperknot Software Kft. in Hungary;
- it does not use cookies or tracking technologies;
- regular server logs are anonymized and omit IP addresses by default, while recording items such as browser type, referring/exit pages, timestamps, and operating system;
- anonymized server logs are retained indefinitely;
- during a security incident or abuse investigation, IP logging may be enabled temporarily for at most 30 days and the IP-containing logs are then deleted; and
- it may use Cloudflare as a CDN, meaning Cloudflare can also process the network request under Cloudflare's own privacy terms.

The hosted privacy notice must name OpenFreeMap because opening a map can therefore create a direct third-party request even though Gapwise does not send the user's private timetable payload to the map provider.

## Analytics and cookie posture

- **Repository:** Vercel Web Analytics and Speed Insights are mounted in the application shell.
- **Provider:** current Vercel Web Analytics documentation describes that product as cookie-free and anonymized. That supports the existing statement that Gapwise does not need a cosmetic cookie banner merely because Web Analytics is mounted.
- **Boundary:** this does not create a permanent exemption from consent rules. If Gapwise introduces advertising, cross-site tracking, persistent identifiers, session replay, or another non-essential tracker, the legal/consent assessment must be redone before deployment.
- **Boundary:** ordinary provider request/runtime logs are separate from Web Analytics and can contain technical network metadata even when Web Analytics itself is cookie-free.

## Reconciliation with public notices

This audit supports the following public statements and limitations:

1. Vercel, Supabase, the selected identity provider, OpenFreeMap, and any explicitly connected AI provider are real service/data recipients in the shipped architecture.
2. Web Analytics is currently cookie-free, but provider infrastructure can still process normal request metadata.
3. Supabase's primary project region is Canada Central, but Gapwise must not turn that into a claim that all provider processing is Canada-only.
4. The current Vercel Hobby plan must not be described as covered by Vercel's Pro/Enterprise DPA.
5. Account deletion removes the application's current user-owned cloud records through the shipped deletion path; provider logs/backups and independently retained third-party records can follow separate cycles.
6. OAuth sign-in is identity-scoped and does not authorize general provider-account content access.

## Remaining operator/legal evidence

The following cannot be truthfully manufactured by repository changes:

- verify and record the Vercel team Data Preferences setting;
- decide whether the hosting arrangement requires a processor DPA and, if so, put an applicable agreement/plan in place;
- confirm any required Supabase DPA/account legal-document status;
- maintain an encrypted off-site database backup and complete a disposable-target restore drill;
- record provider/team access ownership, MFA/RBAC, and emergency access where required;
- have qualified counsel determine applicable privacy law, controller/operator identity, international-transfer requirements, lawful bases, rights-request operations, and breach-notification obligations; and
- rerun this audit whenever provider plan, analytics, OAuth scopes, map host, AI provider, or data architecture materially changes.

Until those items are resolved, they remain explicit operational/legal boundaries rather than hidden assumptions.
