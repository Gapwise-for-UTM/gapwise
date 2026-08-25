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

## Building-by-building audit

The generated detailed tables are in [CAMPUS_ACCESS_AUDIT.md](./CAMPUS_ACCESS_AUDIT.md). The concise
release classification is:

| State                                         | Buildings                              | Required follow-up                                                                        |
| --------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------- |
| Mapped doors; some step-free coordinates      | CCT, DV, KN                            | Verify public access and match each official name to a door; survey connecting approaches |
| Mapped doors; step-free coordinate unresolved | MN, DH, IB, HM, RAWC, XR, HB, DW, OPH  | Survey labels, access, barrier-free equipment, and paths                                  |
| Inferred approach only                        | AX, EH, LL, MV, MC, PP, RIH, SW, NRB   | Locate and survey physical exterior doors; do not promote the approach                    |
| No geocoded exterior access point             | IC, WC, CUP, FCSH, GF, NSB, PL, BG, LH | Obtain authoritative geometry or field survey before routing                              |

No building is classified as fully complete/current because ordinary public access is not
affirmatively evidenced for the current geocoded doors. There are no recorded coordinate conflicts;
absence of a conflict is not evidence of completeness. All 31 official named identities (32
physical instances) remain explicit: exterior identities are `geometry_unknown`, while the two
CCT–DV connection identities are `intentionally_non_routable`.

## Data and routing impact

- Added a canonical union registry without changing the existing public routing/building contract.
- Added explicit official reconciliation states and reclassified “Connection with DV/CCT” as
  non-routable building connections.
- Added fact-specific OSM provenance. No entrances were added, removed, merged, relabelled, or
  geolocated, because the available evidence did not justify those changes.
- Generated debug GeoJSON includes both located points and `geometry: null` identity-only records,
  with confidence, access, accessibility, routability, and reconciliation properties.
- Existing selected endpoints and route results are unchanged. Global entrance-pair optimization is
  still independently tested. Accessibility coverage is unchanged: CCT (1), DV (2), and KN (3)
  have mapped accessible endpoint coordinates, but official identity matching and public access
  remain unresolved. All other step-free endpoint claims fail closed.

## Physical survey checklist

Use a stable survey ID and record date, surveyor, exact WGS84 door coordinate, building/door label,
student access and restrictions, entry/exit direction, barrier-free and automatic-door status,
steps/grade/path continuity, notes, and an external photo reference when consent and repository
policy permit. Never overwrite the upstream observation; add field evidence and document conflicts.

- **CCT, DV, KN:** identify official named doors; verify public access; inspect every step-free
  approach; document the CCT–DV connection type without claiming indoor routing.
- **MN, DH, IB, HM, RAWC, XR, HB, DW, OPH:** label every exterior door and match official identities;
  verify access, door operation, and complete step-free approach.
- **AX, EH, LL, MV, MC, PP, RIH, SW, NRB:** replace each inferred approach only after locating a real
  door; retain the approach separately if it remains useful.
- **IC, WC, CUP, FCSH, GF, NSB, PL, BG, LH:** inventory all student/public exterior doors from
  scratch and connect only surveyed approach paths.
- **Residences:** confirm resident/guest restrictions and never treat controlled access as public.
  Prioritize EH, OPH, RIH, LL, MV, PP, and SW.

Run `bun run entrances:audit` after changes. It regenerates the Markdown building table, JSON audit,
and debug GeoJSON; registry integrity tests prevent missing official identities, invented routable
geometry, duplicate IDs, and unsupported step-free endpoint evidence.
