# UTM all-entrances audit — 2026-09-10

This checkpoint records the remote evidence sweep for Gapwise's goal of showing **all real exterior entrances** for UTM academic/student-facing buildings and residences without inventing geometry or access claims.

## Truth rules

- An official entrance name proves the named entrance identity, not an exact coordinate unless the source publishes one.
- An OpenStreetMap `entrance=*` node may establish door geometry and building association, but not ordinary student/public access unless separately evidenced.
- A barrier-free designation does not by itself prove that the entire approach is step-free.
- A pedestrian approach point is not a physical entrance.
- Residence access restrictions must remain explicit and must never be silently treated as public access.

## Current Gapwise baseline

The canonical entrance GeoJSON currently contains 32 geocoded access points: 23 mapped physical doors and 9 inferred pedestrian approaches. Those points cover 21 of the 30 registered UTM buildings. Nine registered buildings currently have no geocoded exterior access point: `IC`, `WC`, `CUP`, `FCSH`, `GF`, `NSB`, `PL`, `BG`, and `LH`.

Only six mapped doors currently carry affirmative accessibility metadata: one at CCT, two at DV, and three at KN. Ordinary student/public access and direction remain unknown for current geocoded records unless independently evidenced.

## Official UTM barrier-free identities already represented

The existing truth layer preserves the following official UTM Facilities entrance identities as identity-only evidence where exact door geometry has not been reconciled:

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

## Additional remote evidence noted during the 2026-09-10 sweep

### Maanjiwe nendamowinan (MN)

In addition to the UTM Facilities identities Main, Field side, and Lot #1, current University of Toronto materials independently refer to a **North Entrance (2nd floor)** and a **south/front-lawn entrance**. These names must not be assumed to be five distinct physical door groups: directional names may overlap the Facilities identities. The current Gapwise data has one anonymous mapped MN door at `[-79.6654141, 43.5513221]` (OSM node `13738201127`). No reviewed source safely maps that coordinate to one of the official/directional labels.

### Academic/student-facing buildings

Remote sources and the existing truth layer establish multiple entrance identities for the academic core, notably:

- DH — Main, Field side, plus three currently mapped OSM doors whose exact identity reconciliation remains unresolved.
- IB — Main, North, South; Gapwise currently has two mapped OSM doors.
- CCT — Main and Link, with the CCT↔DV building connection tracked separately; Gapwise currently has one mapped accessible door.
- DV — Main and End of 5 Minute Walk, with the DV↔CCT connection tracked separately; Gapwise currently has four mapped doors, two carrying accessibility metadata.
- HM — Main; Gapwise currently has one mapped door.
- KN — three mapped doors, all currently carrying accessibility metadata; exact official identity reconciliation remains unresolved.
- RAWC — Main; one mapped door currently exists.
- XR — 5 Minute Walk side and Academic Annex side; two mapped doors currently exist.
- HB — Main and Rear; two mapped doors currently exist.
- DW — Main; one mapped door currently exists.
- NSB — Main and Rear are officially named, but no geocoded exterior point is currently in Gapwise.
- BG — Main is officially named, but no geocoded exterior point is currently in Gapwise.

Remote sources do not yet establish complete door-by-door geometry for every exterior door on these buildings. Unlisted service/fire/restricted doors must therefore remain absent until directly verified rather than inferred from imagery.

### Residences

The current data is especially incomplete for residences:

- OPH has two mapped physical doors; official identities Main and Rear remain unreconciled to exact mapped doors.
- EH currently has only an inferred pedestrian approach, while official Facilities evidence names Main and Rear ×2 physical instances.
- RIH currently has only an inferred approach, while official Facilities evidence names Main.
- LL, MV, MC, PP, SW, and NRB currently use inferred residence approach points rather than verified physical doors.
- UTM Housing materials describe townhouse-style residence areas with individual exterior unit access, so one aggregate entrance per residence complex would be structurally wrong. Door-level inventory is required before those areas can be considered complete.

## What is safe to preview now

The current application can truthfully preview the existing mapped doors, inferred approaches, and the building-level partial/unmapped coverage semantics. It should **not** display guessed entrance pins for identity-only records. The purpose of this branch is to provide a durable audit baseline for the upcoming per-building geometry work while preserving the fail-closed production model.

## Completion requirement for each building

A building is complete only after every known student/public exterior entrance has a stable identity and publishable WGS84 geometry, with access restrictions, directionality, barrier-free/automatic-door evidence, step/threshold/grade notes, continuous step-free approach verification where applicable, source/provenance, survey date, and reconciliation to official UTM identities where possible.

The authoritative implementation tracker is GitHub issue #157.
