# UTM unresolved live OSM entrance candidates — 2026-09-12

This checkpoint preserves the unresolved portion of the successful live OSM entrance-discovery run on PR #325. It is intentionally an evidence ledger, **not** a production entrance list: none of the nodes below should be assigned to a Gapwise building until independent building identity evidence closes the gap.

## Source and truth rules

The discovery workflow queried the current OpenStreetMap map API inside the UTM audit bounds `-79.6715,43.5450,-79.6600,43.5524` and found 39 `entrance=*` nodes. At the audited PR head, 34 were already represented in Gapwise, 0 new nodes had a unique canonical building-boundary match, 5 were ambiguous, and 5 were unmatched.

Exact OSM node→way membership is useful corroborating topology, but it does not by itself prove a canonical Gapwise building identity unless the member building way is itself named/ref-tagged strongly enough to make that identity defensible. A pedestrian approach, corridor, or nearby building boundary is never converted into a door assignment. Ordinary access, direction, and accessibility remain unknown unless independently evidenced.

## MN — first reconciliation priority

Production currently contains one defensible exact MN physical door:

- `13738201127` — `entrance=yes` — `[-79.6654141, 43.5513221]` — exact member of OSM way `172234228`, tagged `building=university`, `name=Maanjiwe nendamowinan`.

That establishes **MN building identity**, but not the official UTM entrance-name identity. The node is not tagged `entrance=main`, so it must not be silently relabelled as Facilities' `Main` entrance.

Two nearby current OSM nodes remain unresolved MN candidates:

| OSM node      | OSM tag         | WGS84 coordinate            | Exact OSM topology                                                                                | Why held back                                                                                             |
| ------------: | --------------- | --------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `13736687034` | `entrance=main` | `[-79.6656006, 43.5509053]` | pedestrian way `1499474239`; footway `1499491685`; way `1500142666`; indoor corridor `1500298510` | Not a member of MN's named building way; `main` + proximity/corridor topology does not prove MN identity. |
| `13736687041` | `entrance=main` | `[-79.6662061, 43.5510741]` | footway `1500122686`; ways `1500122688`, `1500149686`, `1507392979`; indoor corridor `1500298513` | Not a member of MN's named building way; `main` + proximity/corridor topology does not prove MN identity. |

Authoritative UTM Facilities evidence independently names MN barrier-free entrance identities `Main`, `Field side`, and `Lot #1`; separate U of T material identifies a `North Entrance (2nd floor)`. Those identities remain deliberately separate from the unresolved coordinates above until an exact door↔identity match is independently supportable. Official-map screenshots may corroborate the multi-entrance pattern, but are not coordinate evidence.

## Other unmatched live OSM doors

The same live discovery run contains three additional `entrance=yes` nodes clustered on OSM building way `1127621275`. The way is currently tagged only `building=yes` and has no reviewed `name`/`ref` identity in the discovery artifact, so assigning these doors to a canonical Gapwise building would be guesswork.

| OSM node      | WGS84 coordinate            | Exact OSM topology                                                                              | Current disposition                                                             |
| ------------: | --------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
|  `2383656944` | `[-79.6632279, 43.5502743]` | building way `1127621275`; way `1149032682`                                                     | Unmatched. Preserve as a real OSM door candidate, but do not assign a building. |
| `10307744174` | `[-79.6631071, 43.5504326]` | footway `160783313`; way `1127621274`; building way `1127621275`; indoor corridor `1127621752`  | Unmatched. Corridor/footway membership does not establish building identity.    |
| `10309718335` | `[-79.6632161, 43.5504459]` | footway `1127388383`; way `1127621273`; building way `1127621275`; indoor corridor `1127621752` | Unmatched. Corridor/footway membership does not establish building identity.    |

These three nodes should be revisited if OSM gains a defensible building `name`/`ref`, an authoritative UTM source identifies the structure and exact door placement, or field verification records the physical door/building relationship. Until then they remain outside production.

## Reconciliation gate

A candidate may move into the canonical entrance registry only when its physical-door status and building identity are independently defensible. Entrance-name reconciliation is a separate gate: even a correctly assigned building door must retain a generic identity if the evidence does not prove which official entrance name belongs to it.

This ledger is intended to make the remaining live OSM evidence auditable without weakening the fail-closed production rules.
