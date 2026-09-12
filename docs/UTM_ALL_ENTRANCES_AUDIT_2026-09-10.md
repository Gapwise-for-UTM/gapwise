# UTM all-entrances audit — 2026-09-10

This checkpoint records the remote evidence sweep for Gapwise's goal of showing **all real exterior entrances** for UTM academic/student-facing buildings and residences without inventing geometry or access claims.

## Truth rules

- An official entrance name proves the named entrance identity, not an exact coordinate unless the source publishes one.
- An OpenStreetMap `entrance=*` node may establish door geometry and building association, but not ordinary student/public access unless separately evidenced.
- A barrier-free designation does not by itself prove that the entire approach is step-free.
- A pedestrian approach point is not a physical entrance.
- Residence access restrictions must remain explicit and must never be silently treated as public access.
- Screenshot pixels, nearest-building guesses, footway endpoints, and corridor geometry are not substitutes for a defensible door-to-building identity match.

## Current branch inventory

The current PR branch contains 43 geocoded access points: **34 mapped physical doors** and **9 explicitly inferred pedestrian approaches**. Those points cover 23 of the 30 registered UTM buildings. Seven registered buildings currently have no publishable geocoded exterior access point: `WC`, `CUP`, `FCSH`, `GF`, `PL`, `BG`, and `LH`.

The current live OSM sweep found 39 `entrance=*` nodes inside the UTM audit bounds. Relative to the earlier branch baseline, 11 previously unrepresented physical doors have been safely reconciled: DV +3, IB +3, NSB +2, IC +1, CCT +1, and XR +1. No coordinates in that batch were inferred from official-map screenshot pixels.

Accessibility metadata remains sparse and deliberately fail-closed. Existing affirmative wheelchair metadata is preserved where current source data supports it; ordinary public/student access, directionality, and continuous step-free approach remain unknown unless independently evidenced. The IB emergency-only door is retained for physical completeness but excluded from ordinary endpoint routing.

## Official UTM barrier-free identities already represented

The truth layer preserves the following official UTM Facilities entrance identities. Identity-only records remain unreconciled where exact door geometry cannot yet be defended; a published barrier-free identity is not automatically merged into the nearest OSM door.

- AX — Main
- WC — Rear
- CCT — Main; Link; Connection with DV
- DH — Main; Field side
- DW — Main
- HM — Main
- HB — Main; Rear
- IB — Main; North; South
- MN — Main; Field side; Lot #1
- NSB — Main; Rear
- RAWC — Main
- BG — Main
- XR — 5 Minute Walk side; Academic Annex side
- DV — Main; End of 5 Minute Walk; Connection with CCT
- EH — Main; Rear ×2 physical instances
- OPH — Main; Rear
- RIH — Main

The CCT↔DV identities describe a building connection and remain intentionally non-routable until indoor topology is modeled.

Only the narrow one-to-one Main matches currently supported by both official identity evidence and unique current OSM building-attached `entrance=main` geometry are reconciled in the candidate layer. Buildings with multiple plausible main-tagged doors stay unresolved rather than being assigned by proximity.

## Additional remote evidence noted during the 2026-09-10 to 2026-09-12 sweep

### Maanjiwe nendamowinan (MN) — highest priority

Current authoritative UTM Facilities evidence explicitly names three barrier-free exterior entrance identities: **Main**, **Field side**, and **Lot #1**.

Additional University of Toronto material independently refers to an **MN North Entrance (2nd floor)**. This establishes a named/cardinal north exterior entrance and its level context, but does not establish that “North Entrance” is synonymous with Main, Field side, or Lot #1. Other U of T event material also refers directionally to a south/front-lawn entrance. Directional labels must not be assumed to represent additional distinct physical door groups when they may overlap the Facilities identities.

The production dataset currently contains one safely reconciled exact MN door coordinate: OSM node `13738201127` at `[-79.6654141, 43.5513221]`. That node is an exact member of MN's named `building=university` OSM way (`172234228`), so its MN building identity is defensible. Its current OSM tag is only `entrance=yes`, not `entrance=main`, so Gapwise does **not** relabel it as the official Main entrance by assumption.

Two nearby unresolved `entrance=main` OSM nodes remain explicit MN reconciliation candidates: `13736687034` at `[-79.6656006, 43.5509053]` and `13736687041` at `[-79.6662061, 43.5510741]`. They are attached to pedestrian/indoor-corridor topology and lie only a few metres from the current named MN footprint, but neither node is itself a member of MN's named building way. `entrance=main` + proximity + corridor membership is therefore insufficient to publish them as MN doors without independent building-identity evidence.

This distinction intentionally keeps **building identity** separate from **entrance-name identity**. Official-map screenshots corroborate the multi-entrance count/location pattern only; they are not used to derive coordinates or bridge either identity gap.

### Academic/student-facing buildings changed in this branch

- DV — seven mapped physical doors after adding OSM nodes `1728239002`, `13568164839`, and `13793115966`. Official Main / End of 5 Minute Walk identities remain unreconciled where multiple plausible doors exist.
- IB — five mapped physical doors after adding emergency-only node `2383651237` and main-tagged nodes `13731205423` and `13731205428`. Official Main / North / South identity reconciliation remains intentionally conservative.
- NSB — two mapped physical doors (`13568522572`, `13731083800`), both currently `entrance=main`. Official Main / Rear naming is not assigned merely from the shared `main` tag.
- IC — one mapped physical main entrance (`13568164840`). Its building identity is topology-backed by exact membership in OSM building way `1127939664`, named `Innovation Complex`; `wheelchair=yes` is preserved while access and direction remain unknown.
- CCT — two mapped physical doors after adding current OSM main entrance `13568164833`.
- XR — three mapped physical doors after adding current OSM main/revolving entrance `13738903094`.

### Other academic/student-facing buildings

- DH — three mapped OSM doors; official Main and Field side identities remain unreconciled.
- HM — one mapped door. The official Main identity has a narrow one-to-one current OSM reconciliation.
- KN — three mapped doors with affirmative wheelchair metadata; exact official entrance-name reconciliation remains unresolved.
- RAWC — one mapped door. The official Main identity has a narrow one-to-one current OSM reconciliation.
- HB — two mapped doors; official Main and Rear identities remain unreconciled.
- DW — one mapped door; official Main identity remains unreconciled.
- AX — still represented by an inferred pedestrian approach, not a verified door.
- WC and BG — official entrance identities exist but exact publishable door geometry is still unresolved.

Remote sources still do not establish complete door-by-door geometry for every exterior door on these buildings. Unlisted service, fire, staff-only, or restricted doors must remain absent until directly verified rather than inferred from imagery.

### Residences

The current data is especially incomplete for residences:

- OPH has two mapped physical doors; official identities Main and Rear remain unreconciled to exact mapped doors.
- EH currently has only an inferred pedestrian approach, while official Facilities evidence names Main and Rear ×2 physical instances.
- RIH currently has only an inferred approach, while official Facilities evidence names Main.
- LL, MV, MC, PP, SW, and NRB currently use inferred residence approach points rather than verified physical doors.
- UTM Housing materials describe townhouse-style residence areas with individual exterior unit access, so one aggregate entrance per residence complex would be structurally wrong. Door-level inventory is required before those areas can be considered complete.

## Marker-position correctness

Entrance marker geographic placement is now separated from interactive styling at the DOM architecture level. MapLibre owns an inert `.map-entrance-marker-anchor` wrapper and therefore exclusively owns its geographic projection transform. The child `.map-entrance-marker` button owns hover, focus, sizing, selection, and scale styling. No arbitrary pixel correction is used.

The focused browser regression binds the MN marker to its exact audited WGS84 coordinate and checks it through building selection/fitBounds, hover/focus state changes, zoom, route fitting, keyboard pan, theme/style reload, and repeated MN↔DH building switching. A camera movement must move the projected anchor while the stored entrance ID/longitude/latitude stay exact; a style reload without camera movement must leave the projection stationary.

## What is safe to preview now

The application can truthfully preview the mapped physical doors, inferred approaches, and building-level partial/unmapped coverage semantics on this branch. It should **not** display guessed entrance pins for identity-only records, convert approaches into doors, or claim unrestricted/step-free access where evidence is unknown.

## Completion requirement for each building

A building is complete only after every known student/public exterior entrance has a stable identity and publishable WGS84 geometry, with access restrictions, directionality, barrier-free/automatic-door evidence, step/threshold/grade notes, continuous step-free approach verification where applicable, source/provenance, survey date, and reconciliation to official UTM identities where possible.

The authoritative implementation tracker is GitHub issue #157.
