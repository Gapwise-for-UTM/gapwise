# Gapwise Maintainability Audit

> Snapshot: `main` at `1660d2551dda63ac1568ca0d329e3e1110a43830` on 2026-08-20.
>
> Scope: architecture, product surface, state ownership, maintainability, and readiness for the future Gapwise Pro direction. This document does not add features, change runtime behavior, migrate Supabase, or expand the public Platform or AI surfaces.

## 1. Gapwise in one page

Gapwise is a local-first UTM schedule and campus-intelligence application. The browser owns the active timetable. Deterministic modules derive gaps, route-aware timing, recommendations, and replay state from that schedule. Optional surrounding systems add encrypted persistence, public campus APIs and SDKs, and explicitly delegated AI context without becoming the student app's primary source of truth.

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

The strongest architectural property is that the core student application does not need the public API, SDK, or AI service to calculate timetable, gap, or routing truth.

## 2. Repository map

- `src/routes/` owns route shells and product composition. It is core UI composition.
- `src/routes/_app.tsx` owns active schedule state, restore/import flow, personal items, and major app orchestration. It is a core hotspot.
- `src/lib/ics-parser.ts` owns ACORN `.ics` normalization.
- `src/lib/timetable-types.ts` owns shared academic meeting types.
- `src/lib/personal-types.ts` owns the personal commitment model.
- `src/lib/gaps.ts` derives gaps from schedule boundaries.
- `src/features/gaps/` owns preferences, deterministic assessment, and destination feasibility.
- `src/features/routing/` owns route graph use, transitions, and campus-day routing.
- `src/data/utm/` owns checked-in, source-backed UTM identity and routing evidence.
- `src/features/auth/` owns Supabase authentication integration.
- `src/features/security/` owns private payload, guest persistence, and security boundaries.
- `src/features/sync/` owns restoration, encrypted persistence, and preferences.
- `src/features/ai/` owns the permissioned snapshot/action bridge and is experimental.
- `api/` and `src/server/public-campus/` expose bounded public platform adapters.
- `public/openapi.json` and the static SDK files expose public contract artifacts.
- `supabase/` owns cloud migrations, functions, and policy definitions.
- `tests/` and `e2e/` provide regression and release gates.

A practical debugging rule is to start from the user-facing route, find the shared domain module it calls, and then decide whether the problem is browser state orchestration, deterministic domain logic, checked-in campus data, or an optional cloud/platform adapter.

## 3. User-visible product map

Current significant surfaces include:

- `/today` for current/next class, current gap, recommendation, leave-by guidance, and destination feasibility.
- `/timetable` for the weekly timetable and personal commitments.
- `/gaps` for the explicit gap-plan view.
- `/route` for campus/day-route mapping and routing tools.
- `/replay` for browser-side Day Replay.
- `/developers` for the public Platform, API, and SDK surface.
- Account, OAuth, sync, and AI consent/settings surfaces for optional cloud functionality.

The product-level problem is not that each capability is invalid. It is that too many implementation capabilities are presented as separate concepts around one student job. Gap Plan, Day Route, destination feasibility, Replay, Platform, SDK, and AI/MCP can make one student utility feel like several products.

The target conceptual compression should be closer to:

- **My day**: what is next, where to go, when to leave, and what to do in the gap.
- **My week**: classes and personal commitments.
- **Campus**: places and routes when they are relevant.
- **Account/automation**: optional sync and future Pro automation.

The Platform and SDK should not compete for student-facing attention.

## 4. Data-flow traces

### A. ACORN `.ics` to normalized schedule to timetable

A file input reaches `parseIcs()` in `src/lib/ics-parser.ts`. The parser returns normalized `Meeting[]`. `AppLayout` in `src/routes/_app.tsx` owns that active browser state, which feeds timetable, Today, gap, and routing consumers.

The authority is the active normalized `Meeting[]` in the browser.

### B. Timetable to gap to recommendation

`Meeting[]`, plus fixed personal commitments converted to meeting-shaped values, reach `findGaps()`. Gap assessment and routing/transition helpers then produce deterministic recommendation data for Today and Gap Plan.

The authority is schedule boundaries plus deterministic gap and routing rules, not an LLM.

### C. Class/building to route

Meeting location and building identity reach the canonical UTM registry and `UTM_ROUTING_GRAPH`. Routing and transition planning produce travel, uncertainty, accessibility, and timing state for the map, Today, and destination-feasibility UI.

The authority is checked-in UTM data plus deterministic routing logic. Unknown evidence remains unknown.

### D. Account/auth to private synced state

Supabase Auth provides identity. Optional encrypted sync serializes private state in the browser, encrypts it before cloud persistence, and restores it back into browser-owned state.

Supabase is persistence and identity infrastructure, not a plaintext timetable authority.

### E. Friend/social flow

Friendship metadata and deliberately lossy overlap representations remain separate from raw timetable exposure. Social functionality should not become a raw schedule or location-sharing system.

### F. Public campus data to API to SDK

Checked-in UTM data and shared domain logic feed bounded Vercel API handlers. OpenAPI and static SDK artifacts expose that surface to external consumers.

The authority remains shared deterministic modules and canonical campus data. The SDK should stay a thin wrapper rather than becoming a second routing engine.

### G. Gapwise state to Gapwise AI/MCP

Browser-owned state reaches an explicit permission selection and minimized delegated snapshot before reaching the separate Gapwise AI service and an authorized MCP client.

Gapwise facts remain distinct from assistant inference. Academic meetings are not writable by AI.

### H. Local/browser state versus cloud state

Local/browser state is the active operational state. Guest persistence and personal-item storage can exist locally. Signed-in private sync stores encrypted private payloads. AI delegation adds another intentionally bounded copy of selected context and must not become an independent schedule authority.

## 5. State model

Browser-owned active state includes:

- normalized academic `Meeting[]`;
- current term and view state;
- personal commitments;
- gap, routing, and user preferences;
- derived gaps, routes, and recommendations;
- transient import and restoration UI state.

Locally persisted state can include:

- guest timetable state where enabled;
- personal items and preferences through the current persistence helpers;
- local cryptographic records needed by private sync.

Supabase persisted state can include:

- identity and auth state;
- encrypted private-state payloads and required metadata;
- key-envelope and broker-related metadata;
- friendship/social metadata;
- AI policy/delegation metadata where applicable.

Public state includes:

- the UTM campus dataset;
- bounded campus API responses;
- OpenAPI and SDK assets.

Derived and reconstructable state includes:

- gaps;
- route plans;
- transition budgets;
- Today recommendations;
- Day Replay state.

The main forward-looking risk is multiple overlapping schedule authorities. Generated study blocks must not be independently represented in React memory, personal-item local storage, encrypted cloud revisions, and AI queued actions without one canonical transaction and edit policy.

## 6. Complexity hotspots

### Hotspot 1: `AppLayout` is an orchestration monolith

**Evidence:** `src/routes/_app.tsx` combines import, restoration, auth transitions, encrypted autosave, navigation, global app state, personal items, desktop/mobile rendering paths, and derived schedule composition.

**Risk:** unrelated changes can regress restoration, mobile/desktop behavior, auth transitions, or schedule state.

**Smallest correction:** extract pure domain adapters and small orchestration hooks one at a time. Do not rewrite the route shell.

### Hotspot 2: parallel `Meeting` and `PersonalItem` schedule concepts

**Evidence:** academic classes are `Meeting` objects, while fixed `PersonalItem` objects are repeatedly converted to meeting-shaped values in `_app.tsx` and `src/features/ai/snapshot.ts`.

**Risk:** conversion rules can diverge across gaps, routing, AI delegation, and future generated study blocks.

**Smallest correction:** one pure `fixedPersonalItemToMeeting(item): Meeting | null` adapter with characterization tests.

### Hotspot 3: large timetable/map coordination components

**Evidence:** timetable and map surfaces coordinate rendering, lifecycle, responsive/mobile behavior, and MapLibre interaction in relatively large components.

**Risk:** desktop/mobile and map lifecycle regressions become harder to isolate.

**Smallest correction:** extract pure view-model derivation before splitting rendering components.

### Hotspot 4: manually synchronized Platform representations

**Evidence:** handlers, OpenAPI, SDK JavaScript, TypeScript declarations, public snapshots, examples, and docs describe the same external surface.

**Risk:** representational drift can occur even though underlying routing and gap calculations are shared.

**Smallest correction:** freeze expansion and later generate more artifacts from one contract only if external adoption justifies the maintenance cost.

## 7. API / SDK / Platform audit

**Verdict: FREEZE / QUARANTINE.**

The student application imports shared domain modules directly and does not depend on the public API or SDK for core timetable, gap, or routing behavior. That isolation is good and should be preserved.

The SDK is a thin endpoint wrapper rather than a duplicate routing engine, so immediate removal is not justified. The maintenance cost is the number of public representations that must remain synchronized.

Until there is a named external consumer and a clear maintenance objective:

- keep existing endpoints secure and correct;
- fix regressions and contract drift;
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
- revocable and bounded delegated state.

The cost is a distributed security and state surface spanning browser state, Supabase metadata, a separate service, OAuth/MCP clients, and queued actions. That complexity is justified only if real users use AI delegation.

Do not expand AI write authority while the schedule-item and state model is still ambiguous.

## 9. Product versus infrastructure

### Core student product

- ACORN import;
- Timetable;
- Today;
- gap detection and deterministic recommendations;
- campus routing and destination feasibility;
- personal commitments;
- privacy-first guest mode.

### Supporting infrastructure

- Supabase Auth;
- optional encrypted private sync;
- restoration logic;
- preferences;
- CI, e2e, and security gates;
- canonical UTM data maintenance.

### Optional Platform surface

- public campus API;
- OpenAPI;
- JS/TS SDK;
- open UTM snapshot;
- developer documentation.

### Experimental and future-facing

- Gapwise AI/MCP delegation;
- future Quercus/provider integration;
- generated academic planning;
- enrollment intelligence;
- study-space intelligence beyond current building/routing facts.

## 10. Pro-readiness analysis

- **Quercus/provider ingestion: NEEDS REFACTOR FIRST.** Provider-specific data needs a clean normalization boundary before it touches schedule state.
- **Assignment/deadline records: NEEDS REFACTOR FIRST.** The current model is centered on meetings and personal items, not due-only academic work.
- **Generated study blocks: NEEDS REFACTOR FIRST.** They must not become a third incompatible schedule concept.
- **Dynamic replanning: CURRENT ARCHITECTURE WOULD MAKE THIS DANGEROUS.** It needs canonical state authority, conflict/transaction policy, and generated-versus-user edit semantics.
- **Timetable optimization: NEEDS REFACTOR FIRST.** Existing deterministic primitives are useful, but schedule-item and state ownership must be clearer.
- **Study-space recommendations: NEEDS SMALL EXTENSION.** Existing campus/routing data is useful, but study-space facts need their own evidence model.
- **Study-space availability: NEEDS REFACTOR OR AN EXTERNAL SOURCE.** Do not infer occupancy.
- **Enrollment/section alerts: CURRENTLY DANGEROUS AS A PRODUCT PROMISE.** They require a legitimate and reliable enrollment-data source.
- **AI planning/explanation: NEEDS REFACTOR FIRST.** AI should reason over deterministic availability and constraint outputs rather than own schedule arithmetic.

The Pro vision is feasible, but not safely by extending today's models ad hoc.

## 11. Future unified schedule model

Do not add a giant framework now. The future need is a small provider-agnostic boundary that can represent different schedule-relevant things without converting them inconsistently in every consumer.

A future discriminated schedule-item model may eventually need to represent:

- academic meetings;
- personal commitments;
- generated study blocks;
- exam or quiz meetings;
- deadline/due-only items;
- travel and transition as derived state rather than stored user content.

The immediate step is not to implement that union. It is to centralize the existing fixed-personal-item to `Meeting` adaptation so future work has one seam to replace.

## 12. Quercus integration boundary

If Quercus or Canvas integration is ever implemented, the desired boundary is:

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

Provider-specific IDs, pagination/auth details, and raw response shapes should stop at the adapter boundary. Core gap and routing logic should not know what Quercus is.

No ACORN or Quercus password collection should be introduced.

## 13. Smart-planning boundary

Deterministic logic should own:

- available time windows;
- hard conflicts;
- class and personal commitments;
- travel and transition budgets;
- deadline ordering;
- minimum and maximum block constraints;
- protected buffers;
- whether a proposed block physically fits.

Probabilistic or AI reasoning may help with:

- rough duration estimation;
- suggested decomposition of work;
- prioritization under uncertainty;
- explanation and rationale;
- preference interpretation.

An LLM should never become the source of truth for whether two events overlap, whether the student can physically reach the next class, or whether a deadline has passed.

## 14. Study-space architecture

Study spaces should not be modeled as buildings. They are better treated as destinations/resources that reference a canonical building or location and carry their own evidence-backed attributes, such as:

- noise/activity profile;
- seating or work type;
- hours and access restrictions;
- power and amenities;
- evidence and provenance;
- optional availability source with explicit confidence.

This preserves the existing building identity/routing layer instead of overloading it.

## 15. Social/free versus Pro boundary

Likely free growth and utility features include:

- timetable;
- Today;
- gaps;
- basic routing and campus context;
- schedule sharing and privacy-preserving overlap;
- potentially "who is free?" if privacy and network density are validated.

Likely Pro academic-automation features include:

- Quercus/provider sync;
- assignment and deadline ingestion;
- generated study plans and blocks;
- dynamic replanning;
- advanced timetable optimization;
- smart study-location recommendations;
- deeper reliable university automation.

The architecture should not encode the paywall into core domain models. Entitlements should gate automation and orchestration, not create separate versions of timetable truth.

## 16. Product-bloat analysis

A normal student can currently encounter Timetable, Today, Gap Plan, Day Route, destination feasibility, Replay, account/sync, friend overlap, Platform/API/SDK, and AI/MCP.

**Product bloat is currently the bigger problem than code bloat.** Much of the underlying routing, privacy, and persistence complexity is justified. The product presentation exposes too many implementation surfaces as independent ideas.

Recommended conceptual compression:

- **Today** absorbs "what next, what can I do, can I go there, and when should I leave?"
- **Timetable** remains the weekly truth view and personal-plan surface.
- **Campus** appears contextually when a place or route matters.
- **Replay** stays optional and de-emphasized unless usage proves it is core.
- **Developers/API/SDK** stay separate from student navigation.
- **AI/automation** remains an optional capability, not a parallel product identity.

## 17. Dead-code / deletion candidates

No high-confidence runtime deletion should be performed from this audit alone.

The strongest candidates are de-emphasis and freeze, not immediate deletion:

- Platform/API/SDK expansion;
- AI/MCP expansion;
- duplicate UI entry points that expose the same Today/gap/route job.

Before deleting code, prove reachability and usage with repository search, route tests, and production behavior. Avoid "cleanup" that silently removes security or fallback paths.

## 18. Architectural invariants worth preserving

- Raw ACORN `.ics` parsing stays browser-local.
- Guest mode remains first-class.
- Core timetable, gap, and routing calculations remain deterministic.
- Canonical UTM identity and routing evidence stays source-backed and checked in.
- Unknown route and accessibility facts remain unknown; fail closed rather than fabricate.
- The student app does not depend on the public API or SDK.
- Optional private cloud state is encrypted in the browser before persistence.
- Supabase remains identity and persistence infrastructure, not plaintext timetable authority.
- AI advice remains distinct from Gapwise facts.
- AI delegation remains explicit, minimized, and revocable.
- Public campus APIs remain separated from private student, account, and friend state.
- Free-infrastructure compatibility remains the default until usage justifies spending.

## 19. Top 10 technical-debt tasks

1. **Centralize fixed `PersonalItem` to `Meeting` conversion.** Impact 5/5, risk 1/5, effort XS. This creates one seam for consistent gaps, routing, AI, and future generated blocks.
2. **Extract schedule composition from `_app.tsx`.** Impact 5/5, risk 2/5, effort S. This makes schedule derivation independently testable.
3. **Extract encrypted restore/autosave orchestration into a focused hook or service.** Impact 5/5, risk 3/5, effort M. This separates auth/sync behavior from UI composition.
4. **Separate navigation/shell state from schedule state in `_app.tsx`.** Impact 4/5, risk 3/5, effort M. This reduces mobile/desktop coupling.
5. **Define a documented schedule-item boundary before Pro work.** Impact 5/5, risk 3/5, effort M. This prevents assignments and generated blocks from becoming parallel models.
6. **Freeze and inventory Platform artifacts and consumers.** Impact 3/5, risk 1/5, effort XS. This gives an evidence-based reason to keep, generate, or later remove SDK surfaces.
7. **Reduce manual Platform contract drift.** Impact 3/5, risk 2/5, effort M. Do this only after the consumer inventory exists.
8. **Extract pure timetable/map view-model derivation from large UI components.** Impact 4/5, risk 3/5, effort M. This makes responsive and MapLibre changes safer.
9. **Document one canonical private-plan transaction/edit policy.** Impact 5/5, risk 2/5, effort S. This is required before AI-generated planning can safely write schedule state.
10. **Simplify student-facing information architecture.** Impact 5/5, risk 3/5, effort M. This addresses the larger product-bloat problem without deleting useful engines.

## 20. The FIRST refactor

Implement one pure adapter:

```ts
fixedPersonalItemToMeeting(item: PersonalItem): Meeting | null
```

Then replace duplicated fixed-item conversion in:

- `src/routes/_app.tsx`;
- `src/features/ai/snapshot.ts`.

Add focused characterization tests covering:

- fixed item to meeting fields;
- optional notes/color behavior where relevant to student UI;
- missing start/end returning `null`;
- flexible items returning `null`;
- location-unknown semantics.

This change should not alter storage, UI, routing, or AI permissions. It is small enough to review as a complete diff and creates the first real seam for a future unified schedule model.

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
- [ ] How does restoration decide between memory, local, and cloud state?
- [ ] Does the student app call the public API?
- [ ] Who currently consumes the SDK externally?
- [ ] What can Gapwise AI read or write under each permission?
- [ ] Why are academic meetings read-only to AI?
- [ ] What happens if Supabase is unavailable?
- [ ] What happens if Gapwise AI is unavailable?
- [ ] What happens if public API endpoints are unavailable?
- [ ] Which state is authoritative after a user edits a personal item?
- [ ] How would a future generated study block be edited, rejected, or regenerated?
- [ ] Which product concepts are user jobs versus implementation surfaces?

## 22. Recommended product freeze

### Safe to maintain

- current timetable, import, Today, gap, and routing behavior;
- privacy and security fixes;
- canonical UTM data corrections with evidence;
- encrypted sync and auth reliability;
- release and regression coverage;
- accessibility and real-device fixes.

### Safe to refactor

- the fixed-personal-item adapter;
- schedule composition helpers;
- `_app.tsx` orchestration boundaries in small behavior-preserving slices;
- pure view-model extraction from large UI components;
- documentation and contract-generation improvements that do not expand surface area.

### Freeze

- new public API endpoints;
- SDK expansion;
- Gapwise AI/MCP capability expansion;
- new social surface area beyond bug and privacy fixes;
- Replay expansion unless usage evidence justifies it.

### Do not build yet

- Quercus integration;
- the Gapwise Pro assignment planner;
- automated replanning;
- payments and paywalls;
- study-space availability claims;
- enrollment or section automation without a legitimate reliable data source;
- multi-university expansion.

## Final judgment

Gapwise is not fundamentally broken. The most valuable deterministic, privacy, and routing boundaries are coherent and worth preserving. The immediate problem is that the product and orchestration layers have accumulated more concepts than a student or a new maintainer should need to hold at once.

The correct next move is subtraction and clarification, not a rewrite and not another major feature. Preserve the deterministic, local-first core, freeze optional platform experiments, centralize the existing schedule-model seam, and require evidence before expanding the student-facing surface or beginning the Pro automation vision.
