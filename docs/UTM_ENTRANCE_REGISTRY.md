# UTM Entrance Registry

## Truth model

Gapwise records five independent claims: **existence**, **geometry**, **ordinary public/student
access**, **barrier-free suitability**, and **routing eligibility**. Evidence for one claim never
silently proves another. In particular, an OSM `entrance=*` node supports mapped door existence and
geometry, but not unrestricted access; an official barrier-free name supports existence and the
barrier-free designation, but not coordinates or the accessibility of the path leading to it.

Registry geometry confidence means:

- `field_verified`: a dated Gapwise field record supports the coordinate (none currently exist);
- `official`: an official structured source publishes the coordinate (none currently imported);
- `mapped`: reviewed OSM door geometry;
- `inferred`: a pedestrian graph approach, explicitly not a door;
- `unknown`: an identity exists but no publishable coordinate has been matched.

`verified` means only that the cited source affirmatively supports the particular fact containing
that value. `routable` requires coordinates and a graph-node identity. Official identities without
geometry remain candidates. CCT–DV connection identities are building connections and intentionally
non-routable because Gapwise does not model their indoor topology. Step-free routing remains
fail-closed: both endpoint accessibility and every traversed edge must be affirmative.

## Source investigation (2026-08-25)

The audit reviewed the vendored data and source references, and attempted direct HTTPS retrieval of
`https://map.utoronto.ca/?id=1809` and the UTM Facilities snow/ice page. Both requests were rejected
by this execution environment's CONNECT proxy with HTTP 403 before an application response was
available. Internet search tooling was also unavailable (HTTP 401). Consequently, no network log,
bundle, map configuration, feature service, static JSON, or documented public endpoint could be
validated in this run. The `id=1809` URL contract alone is not evidence of an API or a licence.

The prior visual QA record is retained only as corroboration. No marker coordinates or attributes
were transcribed from screenshots, and no official-map coordinate is shipped. A reproducible
official importer was therefore **not** created: there is no validated structured input to import.
The next connected audit should capture browser network requests, identify the publisher and terms,
test any discovered endpoint without bypassing access controls, and archive only data whose public
reuse is established.

Current production evidence is the UTM Facilities named barrier-free list and reviewed OpenStreetMap
entrance/path topology. OSM attribution and its ODbL boundary are recorded in the source registry.
Neither source is treated as globally complete.

## Current connected verification (2026-09-13)

Subsequent connected audits successfully re-checked the live UTM Facilities snow/ice page and ran a
fresh campus-bounds OpenStreetMap entrance discovery. Facilities still explicitly names MN's
barrier-free entrance identities as **Main**, **Field side**, and **Lot #1**, but does not publish
exact door coordinates. The current OSM sweep found 39 `entrance=*` nodes in the audit bounds; 34 are
represented by reviewed Gapwise physical-door geometry and five remain unresolved/unmatched. The
official U of T interactive-map screenshots remain corroborating evidence only and are never used to
derive WGS84 door coordinates.

MN therefore remains deliberately partial. OSM node `13738201127` is the one exact door currently
safe to assign to MN because it is a member of MN's named OSM building way. The nearby
`entrance=main` nodes `13736687034` and `13736687041` remain reconciliation candidates rather than
production MN doors because neither is a member of the named MN building geometry. Proximity,
pedestrian/indoor-corridor topology, and screenshot placement are not sufficient to bridge that
building-identity gap.

## Building-by-building audit

The generated detailed tables are in [CAMPUS_ACCESS_AUDIT.md](./CAMPUS_ACCESS_AUDIT.md). The current
branch contains **34 mapped physical doors** plus **9 explicitly inferred pedestrian approaches**,
covering 23 of 30 registered buildings with some geocoded access point. Seven buildings still have
no publishable geocoded exterior access point: `WC`, `CUP`, `FCSH`, `GF`, `PL`, `BG`, and `LH`.

The concise release classification is:

| State                                         | Buildings                                | Required follow-up                                                                        |
| --------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------- |
| Mapped doors; some step-free coordinates      | CCT, DV, KN, IC                          | Verify public access and match each official name to a door; survey connecting approaches |
| Mapped doors; step-free coordinate unresolved | MN, DH, IB, HM, RAWC, XR, HB, DW, NSB, OPH | Survey labels, access, barrier-free equipment, and paths                                  |
| Inferred approach only                        | AX, EH, LL, MV, MC, PP, RIH, SW, NRB     | Locate and survey physical exterior doors; do not promote the approach                    |
| No geocoded exterior access point             | WC, CUP, FCSH, GF, PL, BG, LH             | Obtain authoritative geometry or field survey before routing                              |

No building is classified as fully complete/current because ordinary public/student access is not
affirmatively evidenced for the current geocoded doors, and the public sources are not complete
inventories of every exterior door. There are no recorded coordinate conflicts; absence of a
conflict is not evidence of completeness.

All 31 official UTM Facilities named identities (32 physical instances) remain explicit in the truth
layer. The narrow one-to-one **HM Main** and **RAWC Main** matches are reconciled to current OSM
geometry. The two CCT–DV connection identities remain `intentionally_non_routable`; other exterior
identity records remain geometry-unresolved unless independent evidence supports an exact match.

## Data and routing impact

- The canonical union registry keeps mapped physical doors, inferred approaches, and official
  identity-only evidence distinct rather than collapsing one evidence type into another.
- The live OSM expansion adds 11 reviewed physical doors relative to the earlier baseline: DV +3,
  IB +3, NSB +2, IC +1, CCT +1, and XR +1. No screenshot-derived coordinates are used.
- The IB emergency entrance is retained for physical completeness with `emergency_only` access and
  is excluded from ordinary routing endpoints.
- IC's mapped entrance preserves affirmative `wheelchair=yes` metadata, but its local graph
  attachment is currently isolated from the MN main-campus pedestrian component; that is not hidden
  by inventing a connecting edge.
- Generated debug GeoJSON includes both located points and `geometry: null` identity-only records,
  with confidence, access, accessibility, routability, and reconciliation properties.
- Current affirmative accessible-door geometry is CCT (1), DV (2), KN (3), and IC (1). This does not
  establish unrestricted public access, official entrance-name reconciliation, or a continuous
  step-free route. All unsupported step-free claims continue to fail closed.
- Global entrance-pair optimization and graph integrity remain independently tested whenever the
  routing graph changes.

## Physical survey checklist

Use a stable survey ID and record date, surveyor, exact WGS84 door coordinate, building/door label,
student access and restrictions, entry/exit direction, barrier-free and automatic-door status,
steps/grade/path continuity, notes, and an external photo reference when consent and repository
policy permit. Never overwrite the upstream observation; add field evidence and document conflicts.

- **MN first:** enumerate every exterior door group and reconcile Main / Field side / Lot #1 plus
  any independently evidenced directional identities only where an exact physical-door match is
  defensible.
- **CCT, DV, KN, IC:** identify official/named doors where applicable; verify public access; inspect
  every step-free approach; document the CCT–DV connection without claiming unsupported indoor
  routing; resolve IC's isolated graph attachment only from real pedestrian topology.
- **DH, IB, HM, RAWC, XR, HB, DW, NSB, OPH:** label every exterior door and match official
  identities where evidence permits; verify access, door operation, and complete step-free approach.
- **AX, EH, LL, MV, MC, PP, RIH, SW, NRB:** replace each inferred approach only after locating a real
  door; retain the approach separately if it remains useful.
- **WC, CUP, FCSH, GF, PL, BG, LH:** inventory all relevant exterior doors from scratch and connect
  only evidenced pedestrian approaches.
- **Residences:** confirm resident/guest restrictions and never treat controlled access as public.
  Townhouse-style areas require door/unit-level enumeration rather than one aggregate pin.

Run `bun run entrances:audit` after entrance-data changes. It regenerates the Markdown building
table, JSON audit, and debug GeoJSON; registry integrity tests prevent missing official identities,
invented routable geometry, duplicate IDs, and unsupported step-free endpoint evidence.
