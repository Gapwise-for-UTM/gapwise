# Gapwise trust and data inventory

**Issue:** AND-156 (AND-131 Phase 1)  
**Evidence snapshot:** core implementation candidate `1e2500784c9e4203e3eebfbe598e8f8ec95d2134`  
**Reviewed:** 2026-08-29  
**Audience:** maintainers and future privacy, security, and institutional reviewers

This is the internal source of truth for what the current core application and its
configuration demonstrate. It is an inventory, not a final privacy policy, legal
opinion, certification, audit report, or claim of University of Toronto approval.
It deliberately records unknowns rather than filling them with assumptions.

## Claim classes and maintenance rules

Every material statement below has one of these classes:

- **V — implementation/config verified:** demonstrated by repository code,
  migrations, tests, or checked-in configuration at the evidence snapshot.
- **P — process commitment:** a repository instruction or operating procedure;
  source presence does not prove that the process was performed.
- **H — human/provider/legal confirmation required:** cannot be established from
  this repository. Do not publish it as fact until dated evidence is recorded.

Evidence paths are repository-relative and intentionally point to maintainable
source rather than line numbers. Re-review this inventory whenever a data model,
provider, authentication path, analytics integration, AI permission, deletion
path, or recovery process changes. A dependency name alone is not evidence that a
service receives data; runtime imports, endpoints, and configuration were also
checked.

The exact AI, docs, and mobile heads supplied to AND-156 are
`0d9ab27eee275dd816909ff839df967e5a40fb80`,
`e8b9331a24bb5db73bdc778195c0cd77ae4e15f2`, and
`55665d48d9af0d83f6a40f7daf1aad87fe0a3af5`. Those repositories were not present
in this checkout, so their behavior is **not** independently verified here. Any
cross-repository claim is marked H unless the core integration contract itself is
the claim being described.

## System boundaries

- **V:** The original imported ACORN `.ics` file is read and parsed in the browser.
  The parsed schedule may be remembered locally and may enter optional encrypted
  sync, but the original file/blob and source filename are not fields in the
  private payload or current cloud schema. Evidence: `src/lib/ics-parser.ts`,
  `src/features/timetable/import-lifecycle.ts`, `src/hooks/use-preferences.ts`,
  `src/features/security/private-data.ts`,
  `supabase/migrations/20260807132654_remove_schedule_source_filename.sql`.
- **V:** Guest mode does not require Supabase configuration. Guest schedule,
  personal items, preferences, and UI choices can reside in browser storage.
  Evidence: `.env.example`, `src/lib/supabase.ts`, `src/hooks/use-preferences.ts`,
  `src/features/personal/persistence.ts`, `src/features/gaps/preferences.ts`.
- **V:** Optional private cloud state is encrypted in the browser with AES-GCM
  before Supabase storage. Vercel is inside the cryptographic trust boundary
  because its key broker unwraps/re-wraps data keys using a server-held KEK. This
  architecture must be called **browser-encrypted** or **browser-side encrypted**,
  not end-to-end encrypted or zero knowledge. Evidence:
  `src/features/security/local-records.ts`,
  `src/features/security/envelope-crypto.ts`,
  `src/features/sync/encrypted-sync-service.ts`,
  `src/server/private-cloud/key-broker.ts`.
- **V:** Foreground location starts only through a live watcher, is reduced to an
  on-campus point or a status, and the watcher is stopped by the returned cleanup
  function. It is not part of the private sync or AI snapshot schemas. Evidence:
  `src/features/routing/live-location.ts`,
  `src/features/security/private-data.ts`, `src/features/ai/snapshot.ts`.
- **V (core contract only):** AI delegation is separate, opt-in, permissioned,
  and uses a minimized snapshot and queued typed actions. Core does not delegate
  friend data, personal-item notes, precise live location, primary encryption
  keys, or identity-provider/OAuth tokens. Academic meetings are not an AI write
  target. Evidence: `src/features/ai/types.ts`, `src/features/ai/snapshot.ts`,
  `src/features/ai/actions.ts`, `src/features/ai/client.ts`.

## Data inventory

“Retention” below describes behavior visible in source, not provider backup or log
retention. “User control” describes shipped core controls or ordinary browser
controls; it is not a legal data-subject-request procedure.

| Class | Data category                                                      | Purpose and source                                                                                  | Boundary / storage                                                                                                                                            | Protection and subprocessors                                                                                                                                                    | Retention / deletion                                                                                                                                     | User control                                                                                    | Verification source                                                                                                                                                                     | Human confirmation                                                                                                                                           |
| ----- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| V     | Original ACORN `.ics` bytes and filename                           | User-selected import; parse timetable                                                               | Browser File API and page memory only; no current cloud field                                                                                                 | Browser-local parsing; browser/OS is the immediate processor                                                                                                                    | Page/file lifecycle; no application cloud copy                                                                                                           | Choose file; reload/clear site data                                                             | `src/lib/ics-parser.ts`; `src/features/timetable/import-lifecycle.ts`; removal migration named above                                                                                    | Confirm production traffic/log tooling does not capture request bodies from an unimplemented upload path                                                     |
| V     | Parsed academic timetable                                          | Today/timetable/gap/route planning; derived from imported calendar                                  | Page memory; optional localStorage remembrance; optional encrypted private record in IndexedDB and Supabase ciphertext                                        | Local computation; AES-GCM for secure local/cloud record; Supabase and Vercel only when cloud sync is enabled                                                                   | Local until replaced/forgotten/site data cleared; cloud current record until replaced, cloud sync deletion, or account cascade                           | “Remember” choice; forget/replace timetable; cloud sync controls; account deletion              | `src/hooks/use-preferences.ts`; `src/features/security/private-data.ts`; `src/features/sync/encrypted-sync-service.ts`                                                                  | Provider backup/log deletion lag and verified production configuration                                                                                       |
| V     | Personal timetable items and notes                                 | User-created planning items                                                                         | localStorage; optional encrypted private payload in IndexedDB/Supabase                                                                                        | Same browser encryption boundary as private timetable                                                                                                                           | Until edited/deleted, site data cleared, encrypted cloud state deleted, or account deleted                                                               | Create/edit/delete; cloud controls; account deletion                                            | `src/features/personal/persistence.ts`; `src/features/security/private-data.ts`                                                                                                         | Same provider retention unknowns                                                                                                                             |
| V     | Preferences and academic-planning state                            | Routing/gap/display/residence choices, coursework and planned-work blocks entered or derived in app | localStorage and/or optional encrypted private payload                                                                                                        | Same browser encryption boundary for cloud copy                                                                                                                                 | Until replaced/cleared/cloud state or account deleted                                                                                                    | Settings; restore controls; browser site-data controls; account deletion                        | `src/features/sync/preferences.ts`; `src/features/gaps/preferences.ts`; `src/features/security/private-data.ts`                                                                         | Confirm whether all UI surfaces expose granular deletion expected by policy                                                                                  |
| V     | Authentication account, identities, and session                    | Optional Microsoft, Google, or GitHub sign-in                                                       | Identity provider; Supabase Auth; browser localStorage, falling back to sessionStorage or page memory                                                         | PKCE/session controls; Supabase and selected identity provider                                                                                                                  | Account/session until sign-out, expiry/revocation, or account deletion; provider-side records unknown                                                    | Sign in, sign out, delete account; provider account/grant controls                              | `src/features/auth/auth-service.ts`; `src/lib/supabase.ts`; `supabase/functions/delete-account/index.ts`                                                                                | Exact auth metadata retained by each provider, production settings, logs, backups, jurisdiction, and provider-side grant deletion                            |
| V     | Account onboarding metadata                                        | Record account first-run completion                                                                 | Supabase `user_onboarding` plus authenticated onboarding endpoint                                                                                             | RLS/grants; Supabase/Vercel                                                                                                                                                     | Cascades with auth user; no separate time limit in current schema                                                                                        | Complete onboarding; account deletion                                                           | `api/onboarding.ts`; `supabase/tests/database/onboarding_security.test.sql`; current schema migrations                                                                                  | Provider backup/log deletion lag and verified production configuration                                                                                       |
| V     | Encryption keys, envelopes, nonces, versions, record IDs/revisions | Encrypt, restore, and rotate optional private state                                                 | Non-extractable device/private keys and encrypted records in IndexedDB; wrapped DEKs and cryptographic metadata in Supabase; KEK in Vercel server environment | Web Crypto, AES-GCM, device wrapping, authenticated requests; Supabase/Vercel                                                                                                   | Device material until local secure store/site data cleared; server records cascade with account; KEK lifecycle is operational                            | Disable/delete cloud data; clear site data; delete account                                      | `src/features/security/security-store.ts`; `src/features/security/device-keys.ts`; `src/server/private-cloud/key-broker.ts`; encrypted-cloud migrations                                 | KEK custody, rotation evidence, access roster, backup and recovery are dashboard/operator confirmations                                                      |
| V     | Friend profile, invite, relationship, and rate-limit metadata      | Optional friend connection and abuse control                                                        | Supabase tables; invite token stored as a hash                                                                                                                | RLS/restricted RPCs; Supabase                                                                                                                                                   | Invite has schema expiry; relationship can be revoked; rows cascade with users; expired-row cleanup timing is not demonstrated                           | Create/disable/claim invite; accept/reject/revoke friend; delete account                        | `src/features/friends/friend-service.ts`; `supabase/migrations/20260811002848_friend_timetable_overlap.sql`; `supabase/migrations/20260818172504_reject_oauth_from_privileged_rpcs.sql` | Cleanup job/retention for expired invites and rate-limit rows; provider backups/logs                                                                         |
| V     | Lossy friend availability capsule                                  | Return bounded common free windows without sharing full timetable facts                             | Browser-derived encrypted capsule in IndexedDB/Supabase; bounded server response after mutual-friend authorization                                            | Separate encrypted purpose/key; excludes names, courses, rooms, buildings and labels; Supabase and Vercel common-gap boundary                                                   | One current capsule per user until replaced/deleted/account cascade                                                                                      | Revoke relationship; delete cloud state/account; clear local data                               | `src/features/security/availability-capsule.ts`; `src/features/friends/friend-service.ts`; `src/server/private-cloud/common-gap.ts`                                                     | Operational/log retention and production rate-limit configuration                                                                                            |
| V     | AI delegated snapshot and permission metadata                      | Optional assistant reads of selected timetable/planning categories                                  | Core builds plaintext in browser and sends it to configured Gapwise AI; Supabase schema stores AI ciphertext/metadata                                         | Separate opt-in permission set; separate AI encryption domain is represented by bridge contract; Gapwise AI, Vercel, Supabase, and invoked AI provider may process request data | Core revoke deletes delegation and actions through bridge contract; database cascades on account; external AI-provider retention is outside core control | Enable selected categories; separate write toggles; revoke delegation; account deletion         | `src/features/ai/snapshot.ts`; `src/features/ai/types.ts`; `src/features/ai/client.ts`; `supabase/migrations/20260818163355_add_ai_delegation_bridge.sql`                               | Re-verify AI repo head, deployed key/config/log handling, AI provider identity and terms for each user-selected client, deletion completion and jurisdiction |
| V     | Queued AI actions and results                                      | Bounded create/update/delete personal items and update gap preferences                              | Encrypted AI bridge row plus browser-decrypted typed action                                                                                                   | Revision, permission, type and idempotency bounds; no academic meeting mutation type                                                                                            | Until applied/rejected or delegation/account deletion in core contract; no TTL shown                                                                     | Review/apply/reject through app; revoke AI; delete account                                      | `src/features/ai/actions.ts`; `src/features/ai/types.ts`; AI bridge migration                                                                                                           | Re-verify AI implementation, operational cleanup and provider backups/logs                                                                                   |
| V     | Foreground precise location                                        | Center/anchor campus routing while surface is active                                                | Browser geolocation and component memory; only on-campus point is exposed to UI state                                                                         | Browser permission; no sync/AI schema; map rendering may request OpenFreeMap tiles independently                                                                                | Watch lifetime only in core implementation                                                                                                               | Browser permission; stop/leave surface; revoke browser permission                               | `src/features/routing/live-location.ts`; `src/config/map.ts`                                                                                                                            | Browser/vendor behavior and whether hosting/tile request logs allow coarse network inference                                                                 |
| V     | Crowd report and publisher operational state                       | Time-bounded campus crowd indications and authorized publisher updates                              | Supabase private/public tables                                                                                                                                | Auth identity, RLS, RPC validation/rate limits; public aggregate/published output                                                                                               | Crowd reports expire within two hours in query semantics; publisher audit/state have no source-defined deletion schedule; account FKs differ by record   | Submit report; no dedicated history UI found; account deletion applies where FK cascades permit | `supabase/migrations/20260824140000_campus_community_state.sql`; `src/features/campus-state/`                                                                                           | Cleanup of expired rows, publisher/audit retention, lawful/operational basis, production enablement                                                          |
| V     | Aggregate analytics and performance telemetry                      | Operations and performance                                                                          | Vercel Analytics and Speed Insights initialized in every app render                                                                                           | Vercel; code does not intentionally add timetable/private/token properties                                                                                                      | Not specified in repository                                                                                                                              | Browser privacy controls/content blocking                                                       | `src/main.tsx`; `package.json`                                                                                                                                                          | Production Analytics settings, exact fields/cookies, retention, jurisdiction, access and deletion capabilities                                               |
| V     | Runtime error diagnostics                                          | Render/error diagnosis, especially Lovable editor preview                                           | Console/runtime; sanitized synthetic error, route path, and supplied non-private context can go to Lovable hooks when present                                 | Error wrapper avoids forwarding original caught error to Lovable integration; hosting/runtime logs may independently exist                                                      | No repository-defined provider retention                                                                                                                 | No dedicated user control; preview hook exists only when injected                               | `src/lib/error-capture.ts`; `src/lib/lovable-error-reporting.ts`; `src/server.ts`                                                                                                       | Vercel/Lovable log fields, access, environment scope, retention and deletion; production dashboard review                                                    |
| V     | Public API request metadata and authenticated subject              | Serve deterministic campus endpoints and authenticated common-gap/key-broker/onboarding operations  | Vercel runtime; Supabase token verification and database as applicable                                                                                        | Origin/method/body bounds, authenticated subject checks, OAuth-client isolation for privileged paths                                                                            | No application request-history table found; platform logs unknown                                                                                        | Do not call endpoint; sign out/revoke session; account deletion for stored user rows            | `api/`; `src/server/private-cloud/auth.ts`; `src/server.ts`                                                                                                                             | Vercel logs/firewall/retention, IP processing, and production settings                                                                                       |
| V     | Map style/tile request metadata                                    | Render campus basemap                                                                               | Direct browser requests to OpenFreeMap tile/style endpoints                                                                                                   | OpenFreeMap receives ordinary network request metadata; OpenStreetMap is data provenance, not shown as the runtime tile endpoint                                                | Not specified in repository                                                                                                                              | Avoid map surface/network request; browser privacy controls                                     | `src/config/map.ts`                                                                                                                                                                     | OpenFreeMap hosting chain, logs, retention, terms and jurisdiction                                                                                           |

## External service and processor register

This register distinguishes an actual runtime data recipient from source-data
attribution or development tooling. Legal roles such as “processor” versus
“independent controller” require human/legal review.

| Class | Service                                            | Current purpose / possible data                                                                                                      | Activation                                                          | Repository evidence                                                                       | Confirmation still required                                                                       |
| ----- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| V     | Vercel                                             | Web/API/AI hosting boundary, encrypted key broker trust boundary, aggregate analytics/performance, ordinary request/runtime metadata | Production application; analytics components always mounted         | `src/main.tsx`; `api/`; `src/server/private-cloud/`; `docs/VERCEL.md`                     | Contract, subprocessor chain, residency, retention, log fields/access, production settings        |
| V     | Supabase                                           | Auth, Postgres/RLS, Edge account deletion, ciphertext and account/relationship/operational metadata                                  | Optional signed-in/cloud/AI/community features                      | `src/lib/supabase.ts`; `supabase/`; `.env.example`                                        | Project region, plan/current dashboard settings, backups/logs/retention, DPA/terms                |
| V     | Google                                             | Optional OAuth/GIS identity                                                                                                          | User chooses Google sign-in                                         | `src/features/auth/auth-service.ts`; `.env.example`                                       | Production client settings, account fields/scopes, retention/legal role                           |
| V     | Microsoft                                          | Optional OAuth identity through Supabase                                                                                             | User chooses Microsoft sign-in                                      | `src/features/auth/auth-service.ts`                                                       | Same provider-specific confirmations                                                              |
| V     | GitHub                                             | Optional OAuth identity; repository/CI/dependency-update platform for maintainers                                                    | User chooses GitHub sign-in; development always uses hosted repo/CI | `src/features/auth/auth-service.ts`; `.github/workflows/ci.yml`; `.github/dependabot.yml` | Auth fields/scopes and runtime retention; organizational access/log settings for development data |
| V/H   | Gapwise AI                                         | Optional delegated snapshots/actions and OAuth/MCP bridge                                                                            | Explicit user enablement                                            | `src/features/ai/`; AI database migrations                                                | H: independent inspection of supplied AI head and deployment; hosting/key/log/deletion evidence   |
| V/H   | User-selected AI/MCP provider                      | Receives invoked tool result/conversation data after user connects and calls tools                                                   | User choice and provider authorization                              | Core OAuth consent/delegation surfaces and `PRIVACY.md`                                   | H: provider identity varies; terms, retention, training controls, jurisdiction, deletion          |
| V     | OpenFreeMap                                        | Basemap style and tile delivery; network/request metadata                                                                            | Opening a map surface                                               | `src/config/map.ts`                                                                       | Hosting/subprocessors, logs, retention, jurisdiction                                              |
| V     | Lovable                                            | Connected development/editor preview and optional sanitized preview error hook                                                       | Maintainer/editor environment; hook only when injected              | `.lovable/project.json`; `src/lib/lovable-error-reporting.ts`                             | Whether hook is present in production, account/project logs, retention, access, terms             |
| V     | GitHub Actions                                     | CI execution and short-lived failure artifacts (7 days for Playwright failure evidence)                                              | Pull request/push workflows                                         | `.github/workflows/ci.yml`                                                                | Repository/organization log retention and access settings                                         |
| V     | OpenStreetMap contributors / U of T public sources | Provenance for checked-in campus facts; not shown receiving ordinary user private data                                               | Maintainer data refresh or user clicking source links               | `src/data/utm/provenance.ts`; `docs/CAMPUS_DATA_SOURCES.md`                               | No processor designation implied; confirm any future live-fetch pipeline separately               |

No active advertising or payment service, Sentry, PostHog, or direct OpenAI
SDK/integration was found in the core runtime at this snapshot. This is a bounded
code observation, **not** a claim that provider dashboards or the separately
deployed AI repository contain no additional integration. Historical payment-era
schema files remain in migration history for replay provenance, while the current
forward retirement migration removes their live ledger and entitlement objects.
Production was checked before retirement: payment ledgers were already absent and
the legacy entitlement table was empty. This is schema-history context, not an
active payment processor.

## Retention, deletion, and recovery findings

### Verified behavior

- **V:** The account-deletion Edge Function accepts a direct authenticated browser
  session, rejects OAuth/MCP-client tokens, and calls Supabase Auth admin deletion.
  User-owned rows with `on delete cascade` are then database-cascade candidates.
  The current-browser cleanup path removes secure local records and ordinary
  private stores. Evidence: `supabase/functions/delete-account/index.ts`,
  `src/features/auth/AccountSettingsDialog.tsx`,
  `src/features/sync/encrypted-sync-service.ts`, database migrations.
- **V:** Deleting browser/site data alone does not prove cloud account deletion or
  external provider grant revocation. Signing out removes the application session,
  not necessarily identity-provider history.
- **V:** The schema generally stores a current encrypted private record and current
  availability capsule rather than plaintext history. AI actions and audit-like
  community/publisher state are separate exceptions with their own rows.
- **V:** Source-defined expiry exists for friend invites and crowd reports, but
  expiry in query semantics is not evidence that old rows are physically purged.
- **P:** `docs/DISASTER_RECOVERY.md` and `scripts/backup-database.sh` define a
  sensitive logical-backup and disposable restore-drill procedure.
- **H:** No completed backup, off-site encryption, restore drill, provider backup
  retention, RPO, or RTO is proven by repository presence. OAuth configuration,
  DNS, environment secrets, KEKs, provider logs, and non-database settings are not
  recovered by the SQL procedure.

### Deletion limitations to preserve in later public material

1. Account deletion is intended to remove the Supabase auth user and cascading
   application rows, but provider backups/logs may persist according to unverified
   provider practices.
2. Current-browser cleanup does not clear other browsers/devices that are offline.
3. An external AI provider may retain conversation/tool output under the user's
   provider relationship even after the Gapwise delegation is revoked.
4. Expired invites, crowd reports, and rate-limit rows have no verified physical
   purge job in this repository.
5. Publisher audit rows intentionally use restrictive foreign keys and have no
   approved retention/deletion schedule in source.

## User-facing control inventory

| Class | Control                                                     | Scope / limitation                                                                                                | Evidence                                                                 |
| ----- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| V     | Guest mode                                                  | Core local timetable experience without account/cloud provider                                                    | `.env.example`; `src/lib/supabase.ts`; application routes                |
| V     | Remember/forget timetable and browser site-data controls    | Current browser only                                                                                              | `src/hooks/use-preferences.ts`                                           |
| V     | Enable/disable encrypted cloud sync and restoration choices | Optional encrypted private state; does not delete auth account by itself                                          | `src/features/sync/CloudSyncControls.tsx`; restoration modules           |
| V     | Sign in/out                                                 | Application session; provider-side account/grant handling is separate                                             | `src/features/auth/`; `src/lib/supabase.ts`                              |
| V     | Delete account and cloud data                               | Supabase auth user/application cascades and current-browser private cleanup; provider logs/backups remain unknown | `src/features/auth/AccountSettingsDialog.tsx`; deletion Edge Function    |
| V     | AI category/write toggles and revoke                        | Delegated copy/actions; external AI conversation retention remains provider-controlled                            | `src/features/ai/AiIntegrationControls.tsx`; `src/features/ai/client.ts` |
| V     | Friend invite/accept/reject/revoke                          | Relationship/capsule access; does not establish physical cleanup of all expired metadata                          | `src/features/friends/`                                                  |
| V     | Foreground geolocation permission                           | Browser permission and active watcher only                                                                        | `src/features/routing/live-location.ts`                                  |

## Source-visible security and development controls

- **V:** Tenant-scoped tables use RLS/policies and constrained RPCs; privileged
  browser-private APIs reject OAuth client tokens. Database tests cover friend,
  OAuth/MCP, RLS, and deletion isolation. Evidence: `supabase/migrations/`,
  `supabase/tests/database/`, `src/server/private-cloud/auth.ts`.
- **V:** Private records use versioned AES-GCM contexts/AAD, bounded payloads,
  non-extractable browser keys where supported, separate availability keys, and no
  plaintext cloud fallback. Evidence: `src/features/security/`, encrypted-cloud
  migrations and tests.
- **V:** Account deletion is server-only and its service-role credential is not a
  `VITE_` browser variable. Environment guidance prohibits exposing server secrets.
  Evidence: `.env.example`, deletion Edge Function.
- **V:** CI uses read-only repository permissions, pinned third-party Actions,
  frozen dependency installation, production dependency audit, contract checks,
  formatting, typecheck/lint/unit/build for runtime changes, Playwright, isolated
  Supabase tests/lint, and SDK package/consumer checks. Evidence:
  `.github/workflows/ci.yml`.
- **P/H:** `SECURITY.md`, operational runbooks, CODEOWNERS, Dependabot, and the PR
  checklist define maintenance processes. Their existence does not prove response
  times, review performance, successful recovery, or independent assessment.
- **H:** There is no basis here to claim a penetration test, SOC 2, ISO 27001,
  formal accessibility certification, institutional approval, contractual uptime,
  or any verified incident/legal-request count.

## Human-confirmation register

Nothing in this register is complete merely because it appears in this document.
Record an owner, date, non-secret evidence reference, and approved publication
language before changing H to V or P.

| ID    | Required confirmation / decision                                                                                                                                                                              | Suggested owner                 | Publication blocker for                     |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------- |
| HC-01 | Inspect the supplied AI, docs, and mobile exact heads and reconcile their data flows, providers, deletion language, and exclusions with this core inventory                                                   | Engineering/security            | Ecosystem-wide trust claims                 |
| HC-02 | Export/review production Vercel settings: regions where configurable, logs and analytics fields, cookies, access, retention/deletion, subprocessors, environment separation                                   | Owner + privacy/legal           | Subprocessor/residency/retention page       |
| HC-03 | Export/review production Supabase project region/plan, Auth providers/scopes/metadata, logs, backups, PITR status, retention, deletion lag, access and subprocessors                                          | Owner + privacy/legal           | Subprocessor/residency/recovery claims      |
| HC-04 | Review Google, Microsoft, and GitHub production OAuth configuration, requested scopes, provider-side records/revocation and applicable terms                                                                  | Owner + privacy/legal           | Authentication disclosures                  |
| HC-05 | Verify Gapwise AI deployment, separate-key custody/rotation, plaintext/log minimization, OAuth-client isolation, revocation/deletion completion, hosting chain and external-provider behavior against AI head | AI maintainer + security        | AI/MCP trust section                        |
| HC-06 | Inventory each supported external AI/MCP client/provider and link its current user-facing terms, privacy, training, retention, residency and deletion controls without generalizing across providers          | Privacy/legal                   | Provider-specific AI disclosures            |
| HC-07 | Confirm OpenFreeMap and Lovable production/development request data, hosting chain, logs, retention, access, jurisdiction, and contractual role                                                               | Owner + privacy/legal           | Complete subprocessor register              |
| HC-08 | Decide and implement physical cleanup schedules for expired friend invites, crowd reports and rate-limit rows; approve retention for publisher state/audit rows                                               | Product + privacy + engineering | Retention schedule                          |
| HC-09 | Confirm whether retired payment-era database objects ever received production data before removal; approve any separate archival/retention handling if evidence is found                                      | Owner + database operator       | Accurate historical processor/data register |
| HC-10 | Execute and record an encrypted logical backup and disposable restore drill, including separate KEK recovery; define honest RPO/RTO only after evidence exists                                                | Operator/security               | Recovery assertions                         |
| HC-11 | Test production account deletion end-to-end with a disposable account, including all current tables, AI revoke/grant behavior and other-device/browser limitations                                            | QA + privacy                    | Public deletion claim                       |
| HC-12 | Review actual Vercel/Supabase/Lovable/GitHub logs for inadvertent private fields, tokens, route/query data and IP/user-agent handling; document redaction/access                                              | Security/operations             | Logging disclosure                          |
| HC-13 | Obtain legal review of service roles, subprocessors, data-sale/advertising wording, lawful basis, student privacy requests, contractual terms, and jurisdiction/residency statements                          | Legal/privacy                   | Public legal/trust material                 |
| HC-14 | Confirm current corporate/business status, University trademark/affiliation boundaries and absence/presence of any written university relationship                                                            | Owner/legal                     | Institutional relationship statement        |
| HC-15 | Establish dated review evidence for incident response, vulnerability handling, accessibility/manual testing, and access-control rosters without claiming audits or certifications                             | Security/accessibility owner    | Governance and assurance claims             |

## Safe claim summary for later phases

Subject to re-verification at publication time, the core repository supports these
implementation statements: the app does not request ACORN credentials; the
original `.ics` is parsed in the browser and has no upload/cloud schema; guest mode
is first-class; optional private state is browser-encrypted before Supabase storage;
Vercel remains in the primary cryptographic trust boundary; foreground location is
not background-tracked or included in sync/AI schemas; AI delegation is separate,
opt-in and category-limited; academic meetings are read-only across the current AI
action types; and account deletion has a dedicated browser-session-only server
path.

Do **not** turn those statements into claims of end-to-end encryption,
zero-knowledge operation, certification, independent audit, penetration testing,
provider residency, guaranteed deletion time, legal compliance, official U of T
affiliation, uptime, or zero incidents/requests without the corresponding human or
provider evidence.
