# Gapwise Maintainability Audit

> Snapshot: `main` at `1660d2551dda63ac1568ca0d329e3e1110a43830` (2026-08-20).
>
> Scope: architecture, product surface, state ownership, maintainability, and readiness for the future Gapwise Pro direction. This document intentionally does **not** add features, change runtime behavior, migrate Supabase, or expand the public Platform/AI surfaces.

## 1. Gapwise in one page

Gapwise is a local-first UTM schedule and campus-intelligence application. The browser owns the active timetable. Deterministic modules derive gaps, route-aware timing, recommendations, and replay state from that schedule. Optional surrounding systems add encrypted persistence, public campus APIs/SDKs, and explicitly delegated AI context without becoming the student app's primary source of truth.

```text
ACORN .ics
   |
   v
browser-local parser
   |
   v
Meeting[]  <---------------------------+
   |                                    |
   +--> timetable / Today               |
   +--> findGaps()                      |
   +--> routing + transition planner    |
   +--> deterministic gap assessment    |
   +--> Day Replay                      |
                                        |
PersonalItem[] -- fixed-item adapter ---+

Optional signed-in path
browser state
   |
   +--> browser encryption --> Supabase private persistence
   +--> explicit minimized delegation --> Gapwise AI / MCP

Public UTM data
   |
   +--> shared deterministic routing/gap logic
           |--> student app (direct module imports)
           |--> public API
           |--> JS/TS SDK (thin API wrapper)
           +--> public AI campus tools
```

The strongest architectural property is that the core student application does not need the public API, SDK, or AI service to calculate timetable/gap/routing truth.

## 2. Repository map

| Area | What it owns | Authority | Classification |
| --- | --- | --- | --- |
| `src/routes/` | Route shells and product composition | UI composition only | CORE |
| `src/routes/_app.tsx` | Active schedule state, restore/import flow, personal items, major app orchestration | Browser runtime state | CORE / HOTSPOT |
| `src/lib/ics-parser.ts` | ACORN `.ics` normalization | Parser contract | CORE |
| `src/lib/timetable-types.ts` | Academic meeting model | Shared domain types | CORE |
| `src/lib/personal-types.ts` | Personal commitment model | Shared personal domain types | CORE |
| `src/lib/gaps.ts` | Gap derivation from schedule boundaries | Deterministic domain logic | CORE |
| `src/features/gaps/` | Preferences, assessment, destination feasibility | Deterministic gap rules | CORE |
| `src/features/routing/` | Route graph use, transitions, campus-day routing | Deterministic route rules | CORE |
| `src/data/utm/` | Canonical checked-in UTM identity/routing evidence | Reviewed source-backed data | CORE DATA |
| `src/features/auth/` | Supabase Auth/session UI | Supabase identity | SUPPORTING |
| `src/features/security/` | Private payload boundaries, guest persistence, encryption policy | Security contracts | SUPPORTING |
| `src/features/sync/` | Restoration, encrypted persistence, preferences | Browser + encrypted cloud state | SUPPORTING |
| `src/features/ai/` | Permissioned snapshot/action bridge | Explicit delegated subset only | EXPERIMENTAL |
| `api/` | Vercel public/authenticated endpoints | Adapter over shared logic | PLATFORM |
| `src/server/public-campus/` | Public campus service composition | Shared deterministic logic | PLATFORM |
| `public/openapi.json`, `public/sdk/` | Public contract/client artifacts | Manually synchronized platform representation | PLATFORM |
| `docs/` | Architecture, operations, privacy/platform guidance | Documentation | SUPPORTING |
| `tests/`, `e2e/` | Regression and release gates | Behavior contracts | SUPPORTING |
| `supabase/` | Migrations/functions/policies | Cloud persistence/auth boundary | SUPPORTING |

A practical debugging rule: start from the user-facing route, find the shared domain module it calls, then determine whether the bug is in browser state orchestration (`_app.tsx`), deterministic domain logic, checked-in campus data, or an optional cloud/platform adapter.

## 3. User-visible product map

Current significant surfaces include:

- `/today` — current/next class, current gap, recommendation, leave-by guidance, destination feasibility.
- `/timetable` — weekly timetable and personal commitments.
- `/gaps` — explicit gap-plan view.
- `/route` — campus/day-route map and routing tools.
- `/replay` — browser-side Day Replay.
- `/developers` — public Platform/API/SDK surface.
- OAuth/consent and account/settings surfaces — optional identity/private sync/AI delegation.

The product-level problem is not that each capability is invalid; it is that too many implementation capabilities are presented as separate concepts around one student job. Gap Plan, Day Route, destination feasibility, Replay, Platform, SDK, and AI/MCP can make one student utility feel like several products.

The target conceptual compression should be closer to:

1. **My day** — what is next, where to go, when to leave, what to do in the gap.
2. **My week** — classes and personal commitments.
3. **Campus** — places/routes when needed.
4. **Account/automation** — optional sync and future Pro automation.

The Platform and SDK should not compete for student-facing attention.

## 4. Data-flow traces

### A. ACORN `.ics` -> normalized schedule -> timetable

`UploadPanel` / file input -> `parseIcs()` in `src/lib/ics-parser.ts` -> normalized `Meeting[]` -> `AppLayout` browser state in `src/routes/_app.tsx` -> timetable/Today/gap/routing consumers.

**Authority:** the active normalized `Meeting[]` in the browser.

### B. Timetable -> gap -> recommendation

`Meeting[]` (+ fixed personal commitments converted to meeting-shaped values) -> `findGaps()` -> `planGapAssessment()` and transition/routing helpers -> Gap Plan / Today recommendation UI.

**Authority:** schedule boundaries plus deterministic gap/routing rules, not an LLM.

### C. Class/building -> route

Meeting location/building identity -> canonical UTM registry and `UTM_ROUTING_GRAPH` -> routing/transition planner -> route state, travel estimate, uncertainty/accessibility status -> map/Today/feasibility UI.

**Authority:** checked-in UTM data plus deterministic routing logic. Unknown evidence remains unknown.

### D. Account/auth -> private synced state

Supabase Auth identity -> optional encrypted-sync opt-in -> browser serializes private state -> browser encryption -> Supabase persistence -> restoration back into browser-owned state.

**Authority:** active plaintext schedule remains in the browser; Supabase is persistence/identity infrastructure, not a plaintext timetable authority.

### E. Friend/social flow

Friendship metadata and deliberately lossy overlap representations are separate from raw timetable exposure. Social functionality should continue to avoid turning friend discovery into a raw schedule/location-sharing system.

### F. Public campus data -> API -> SDK

Checked-in UTM data + shared domain logic -> bounded Vercel API handlers -> OpenAPI/static client representation -> external consumer.

**Authority:** shared deterministic modules and canonical campus data. The SDK should remain a thin wrapper rather than a second routing engine.

### G. Gapwise state -> Gapwise AI/MCP

Browser-owned state -> explicit permission selection -> minimized AI snapshot/delegated state -> separate Gapwise AI service -> authorized MCP client.

**Authority:** Gapwise facts remain distinct from assistant inference. Academic meetings are not writable by AI.

### H. Local/browser vs cloud state

Local/browser state is the active operational state. Guest persistence and personal-item storage may exist locally. Signed-in private sync stores encrypted private payloads. AI delegation adds another intentionally bounded copy of selected context and must not become an independent schedule authority.

## 5. State model

### Browser-owned / active

- normalized academic `Meeting[]`;
- current term/view state;
- personal commitments;
- gap/routing/user preferences;
- derived gaps/routes/recommendations;
- transient import/restoration UI state.

### Locally persisted

- guest timetable state where enabled;
- personal items/preferences as defined by current persistence helpers;
- encryption/key-related local records required by private sync.

### Supabase persisted

- identity/auth state;
- encrypted private-state payloads and required metadata;
- key envelopes/broker-related metadata;
- friendship/social metadata;
- AI policy/delegation metadata where applicable.

### Public

- UTM campus dataset;
- bounded campus API responses;
- OpenAPI/SDK assets.

### Derived/reconstructable

- gaps;
- route plans;
- transition budgets;
- Today recommendations;
- Day Replay derived state.

The main forward-looking risk is **multiple overlapping schedule authorities**. Generated study blocks must not be independently represented in React memory, personal-item local storage, encrypted cloud revisions, and AI queued actions without a single canonical transaction/edit policy.

## 6. Complexity hotspots

### Hotspot 1 — `AppLayout` is an orchestration monolith

**Evidence:** `src/routes/_app.tsx` combines import, restoration, auth transitions, encrypted autosave, navigation, global app state, personal items, desktop/mobile rendering paths, and derived schedule composition.

**Risk:** unrelated changes can regress restoration, mobile/desktop behavior, auth transitions, or schedule state. It is difficult for a new maintainer to identify where a responsibility belongs.

**Smallest plausible correction:** extract pure domain adapters and small orchestration hooks one at a time; do not rewrite the route shell.

### Hotspot 2 — parallel `Meeting` and `PersonalItem` schedule concepts

**Evidence:** academic classes are `Meeting` objects, while fixed `PersonalItem` objects are repeatedly converted to meeting-shaped values in `_app.tsx` and `src/features/ai/snapshot.ts`.

**Risk:** conversion rules can diverge across gaps, routing, AI delegation, and future generated study blocks.

**Smallest plausible correction:** one pure `fixedPersonalItemToMeeting(item): Meeting | null` adapter with characterization tests.

### Hotspot 3 — large timetable/map coordination components

**Evidence:** timetable/map product surfaces coordinate rendering, lifecycle, responsive/mobile behavior, and MapLibre interaction in relatively large components.

**Risk:** desktop/mobile and map lifecycle regressions become harder to isolate.

**Smallest plausible correction:** extract pure view-model derivation before splitting rendering components.

### Hotspot 4 — manually synchronized Platform representations

**Evidence:** handlers, OpenAPI, SDK JavaScript, TypeScript declarations, public snapshots, examples, and docs describe the same external surface.

**Risk:** representational drift even when underlying routing/gap calculations are shared.

**Smallest plausible correction:** freeze expansion; later generate more artifacts from one contract if external adoption justifies it.

## 7. API / SDK / Platform audit

**Verdict: FREEZE / QUARANTINE.**

The student application imports shared domain modules directly and does not depend on the public API or SDK for core timetable/gap/routing behavior. That isolation is good and should be preserved.

The SDK is a thin endpoint wrapper rather than a duplicate routing engine, so immediate removal is not justified. The maintenance cost is instead the number of public representations that must remain synchronized.

Until there is a named external consumer and a clear maintenance objective:

- keep existing endpoints secure and correct;
- fix regressions/contract drift;
- do not add endpoints merely because the underlying app gained another feature;
- reduce student-facing prominence of developer-platform concepts.

## 8. Gapwise AI / MCP audit

**Verdict: FREEZE / QUARANTINE as experimental infrastructure.**

Good existing boundaries include:

- explicit opt-in separate from ordinary sign-in;
- minimized permission categories;
- academic meetings read-only to AI;
- reuse of deterministic Gapwise calculations;
- distinction between Gapwise-supplied facts and assistant advice;
- revocable/bounded delegated state.

The cost is a distributed security/state surface spanning browser state, Supabase metadata, a separate service, OAuth/MCP clients, and queued actions. That complexity is justified only if real users use AI delegation.

Do not expand AI write authority while the schedule-item/state model is still ambiguous.

## 9. Product versus infrastructure

### CORE STUDENT PRODUCT

- ACORN import;
- Timetable;
- Today;
- gap detection and deterministic recommendations;
- campus routing / destination feasibility;
- personal commitments;
- privacy-first guest mode.

### SUPPORTING INFRASTRUCTURE

- Supabase Auth;
- optional encrypted private sync;
- restoration logic;
- preferences;
- CI/e2e/security gates;
- canonical UTM data maintenance.

### OPTIONAL PLATFORM SURFACE

- public campus API;
- OpenAPI;
- JS/TS SDK;
- open UTM snapshot;
- developer documentation.

### EXPERIMENTAL / FUTURE-FACING

- Gapwise AI/MCP delegation;
- future Quercus/provider integration;
- generated academic planning;
- enrollment intelligence;
- study-space intelligence beyond current building/routing facts.

## 10. Pro-readiness analysis

| Capability | Readiness | Reason |
| --- | --- | --- |
| Quercus/provider ingestion | NEEDS REFACTOR FIRST | Provider-specific data needs a clean normalization boundary before touching schedule state. |
| Assignment/deadline records | NEEDS REFACTOR FIRST | Current model is centered on meetings/personal items, not due-only academic work. |
| Generated study blocks | NEEDS REFACTOR FIRST | Must not become a third incompatible schedule concept. |
| Dynamic replanning | CURRENT ARCHITECTURE WOULD MAKE THIS DANGEROUS | Requires canonical state authority, conflict/transaction policy, generated-vs-user edit semantics. |
| Timetable optimization | NEEDS REFACTOR FIRST | Constraint engine can reuse existing deterministic primitives, but schedule-item/state ownership must be clearer. |
| Study-space recommendations | NEEDS SMALL EXTENSION | Existing campus/routing data is useful, but study-space facts need their own structured evidence model. |
| Study-space availability | NEEDS REFACTOR / EXTERNAL SOURCE | Reliability depends on a defensible availability source; do not infer occupancy. |
| Enrollment/section alerts | CURRENTLY DANGEROUS AS A PRODUCT PROMISE | Requires reliable/legitimate enrollment data and careful platform boundaries. |
| AI planning/explanation | NEEDS REFACTOR FIRST | AI should reason over deterministic availability/constraint outputs, not own schedule arithmetic. |

The Pro vision is feasible, but not safely by extending today's models ad hoc.

## 11. Future unified schedule model

Do **not** add a giant framework now. The future need is a small provider-agnostic boundary capable of representing different schedule-relevant things without converting them inconsistently in every consumer.

Conceptually, a future discriminated schedule-item model may need to represent:

- academic meeting;
- personal commitment;
- generated study block;
- exam/quiz meeting;
- deadline/due-only item;
- travel/transition as derived state rather than stored user content.

The immediate architectural step is not to implement that union. It is to centralize the existing fixed-personal-item -> `Meeting` adaptation so future work has one seam to replace.

## 12. Quercus integration boundary

If Quercus or Canvas integration is ever implemented:

```text
provider API/auth
   |
   v
provider-specific adapter
   |
   v
validated provider-agnostic academic records
   |
   +--> due items / coursework
   +--> calendar/schedule items where appropriate
   |
   v
Gapwise deterministic planning inputs
```

Provider-specific IDs, pagination/auth details, and raw response shapes should stop at the adapter boundary. Core gap/routing logic should not know what Quercus is.

No ACORN or Quercus password collection should be introduced.

## 13. Smart-planning boundary

### Deterministic logic should own

- available time windows;
- hard conflicts;
- class/personal commitments;
- travel/transition budgets;
- deadline ordering;
- minimum/maximum block constraints;
- protected buffers;
- whether a proposed block physically fits.

### Probabilistic/AI reasoning may help with

- rough duration estimation;
- suggested decomposition of work;
- prioritization under uncertainty;
- explanation/rationale;
- preference interpretation.

An LLM should never become the source of truth for whether two events overlap, whether the student can physically reach the next class, or whether a deadline has passed.

## 14. Study-space architecture

Study spaces should not be modeled as buildings. They are better treated as **destinations/resources** that reference a canonical building/location and carry their own evidence-backed attributes, for example:

- noise/activity profile;
- seating/work type;
- hours/access restrictions;
- power/amenities;
- evidence/provenance;
- optional availability source with explicit confidence.

This preserves the existing building identity/routing layer instead of overloading it.

## 15. Social/free versus Pro boundary

### Likely free growth/utility layer

- timetable;
- Today;
- gaps;
- basic routing/campus context;
- schedule sharing / privacy-preserving overlap;
- potentially "who is free?" if privacy and density are validated.

### Likely Pro academic-automation layer

- Quercus/provider sync;
- assignment/deadline ingestion;
- generated study plans/blocks;
- dynamic replanning;
- advanced timetable optimization;
- smart study-location recommendations;
- deeper reliable university automation.

The architecture should not encode the paywall into core domain models. Entitlements should gate orchestration/access to automation, not create separate versions of timetable truth.

## 16. Product-bloat analysis

A normal student can currently encounter concepts including Timetable, Today, Gap Plan, Day Route, destination feasibility, Replay, account/sync, friend overlap, Platform/API/SDK, and AI/MCP.

**Product bloat is currently the bigger problem than code bloat.** Much of the underlying routing, privacy, and persistence complexity is justified; the product presentation exposes too many implementation surfaces as independent ideas.

Recommended conceptual model:

- **Today** absorbs "what next / gap / can I go there / when to leave".
- **Timetable** remains the weekly truth view and personal-plan surface.
- **Campus** appears contextually when a place/route matters.
- **Replay** stays optional/de-emphasized unless usage proves it is a core behavior.
- **Developers/API/SDK** remain separate from student navigation.
- **AI/automation** is an optional capability, not a parallel product identity.

## 17. Dead-code / deletion candidates

No high-confidence runtime deletion should be performed from this audit alone.

The strongest candidates are **de-emphasis/freeze**, not immediate deletion:

- Platform/API/SDK expansion;
- AI/MCP expansion;
- any duplicate UI entry points that expose the same Today/gap/route job.

Before deleting code, prove reachability/usage with repository search, route tests, and production behavior. Avoid "cleanup" that silently removes security or fallback paths.

## 18. Architectural invariants worth preserving

1. Raw ACORN `.ics` parsing stays browser-local.
2. Guest mode remains first-class.
3. Core timetable/gap/routing calculations remain deterministic.
4. Canonical UTM identity/routing evidence is source-backed and checked in.
5. Unknown route/accessibility facts remain unknown; fail closed rather than fabricate.
6. Student app does not depend on the public API/SDK.
7. Optional private cloud state is encrypted in the browser before persistence.
8. Supabase is identity/persistence infrastructure, not plaintext timetable authority.
9. AI advice is distinct from Gapwise facts.
10. AI delegation stays explicit, minimized, and revocable.
11. Public campus APIs remain separated from private student/account/friend state.
12. Free-infrastructure compatibility remains a default constraint until usage justifies spending.

## 19. Top 10 technical-debt tasks

| # | Task | Impact | Risk | Effort | Prerequisites | What becomes easier |
| --- | --- | ---: | ---: | --- | --- | --- |
| 1 | Centralize fixed `PersonalItem` -> `Meeting` conversion | 5 | 1 | XS | characterization tests | future unified schedule model; consistent gaps/AI |
| 2 | Extract schedule composition (`academic + fixed personal`) from `_app.tsx` | 5 | 2 | S | #1 | smaller route shell, testable schedule derivation |
| 3 | Extract encrypted restore/autosave orchestration into focused hook/service | 5 | 3 | M | state behavior tests | auth/sync changes without touching UI composition |
| 4 | Separate app navigation/shell state from schedule state in `_app.tsx` | 4 | 3 | M | #2/#3 | easier mobile/desktop shell changes |
| 5 | Introduce a documented schedule-item boundary before Pro work | 5 | 3 | M | #1/#2 | assignments/generated blocks without parallel models |
| 6 | Freeze and inventory Platform artifacts/consumers | 3 | 1 | XS | none | objective decision on keeping/generating/removing SDK surfaces |
| 7 | Reduce manual Platform contract drift | 3 | 2 | M | #6 + real external consumer | safer API/SDK maintenance |
| 8 | Extract pure timetable/map view-model derivation from large UI components | 4 | 3 | M | characterization/e2e coverage | safer responsive/MapLibre refactors |
| 9 | Document one canonical private-plan transaction/edit policy | 5 | 2 | S | #5 | safe future AI planning/replanning |
| 10 | Simplify student-facing information architecture | 5 | 3 | M | usage evidence | less product bloat without deleting useful engines |

## 20. The FIRST refactor

Implement one pure adapter:

```ts
fixedPersonalItemToMeeting(item: PersonalItem): Meeting | null
```

Then replace duplicated fixed-item conversion in:

- `src/routes/_app.tsx`;
- `src/features/ai/snapshot.ts`.

Add focused characterization tests covering:

- fixed item -> meeting fields;
- optional notes/color behavior where relevant to student UI;
- missing start/end -> `null`;
- flexible item -> `null`;
- location-unknown semantics.

This should not change storage, UI, routing, or AI permissions. It is small enough to review as a complete diff and creates the first real seam for a future unified schedule model.

## 21. Founder comprehension checklist

Before major feature expansion, the founder should be able to answer these without asking an LLM:

- [ ] Where does the active `Meeting[]` live?
- [ ] What does `parseIcs()` guarantee about a normalized meeting?
- [ ] What is a `PersonalItem`, and when does it become meeting-shaped?
- [ ] Which function derives gaps?
- [ ] Which modules own deterministic gap assessment?
- [ ] Where does route truth originate?
- [ ] What does route "unknown/unavailable" mean?
- [ ] What does Supabase store versus what stays browser-local?
- [ ] What is encrypted before cloud persistence?
- [ ] How does restoration decide between memory/local/cloud state?
- [ ] Does the student app call the public API? (It should not need to.)
- [ ] Who currently consumes the SDK externally?
- [ ] What can Gapwise AI read/write under each permission?
- [ ] Why are academic meetings read-only to AI?
- [ ] What happens if Supabase is unavailable?
- [ ] What happens if Gapwise AI is unavailable?
- [ ] What happens if public API endpoints are unavailable?
- [ ] Which state is authoritative after a user edits a personal item?
- [ ] How would a future generated study block be edited, rejected, or regenerated?
- [ ] Which product concepts are user jobs versus implementation surfaces?

## 22. Recommended product freeze

### SAFE TO MAINTAIN

- current timetable/import/Today/gap/routing behavior;
- privacy/security fixes;
- canonical UTM data corrections with evidence;
- encrypted sync/auth reliability;
- release/regression coverage;
- accessibility and real-device fixes.

### SAFE TO REFACTOR

- the fixed-personal-item adapter;
- schedule composition helpers;
- `_app.tsx` orchestration boundaries in small behavior-preserving slices;
- pure view-model extraction from large UI components;
- documentation/contract generation improvements that do not expand surface area.

### FREEZE

- new public API endpoints;
- SDK expansion;
- Gapwise AI/MCP capability expansion;
- new social surface area beyond bug/privacy fixes;
- Replay expansion unless usage evidence justifies it.

### DO NOT BUILD YET

- Quercus integration;
- Gapwise Pro assignment planner;
- automated replanning;
- payments/paywalls;
- study-space availability claims;
- enrollment/section automation without a legitimate reliable data source;
- multi-university expansion.

## Final judgment

Gapwise is not fundamentally broken. The most valuable deterministic, privacy, and routing boundaries are coherent and worth preserving. The immediate problem is that the product and orchestration layers have accumulated more concepts than a student or a new maintainer should need to hold at once.

The correct next move is **subtraction and clarification**, not a rewrite and not another major feature. Preserve the deterministic/local-first core, freeze optional platform experiments, centralize the existing schedule-model seam, and require evidence before expanding the student-facing surface or beginning the Pro automation vision.
