# UTM campus access audit

Generated deterministically by `bun run routing:audit`. “Verified” in the first table means the cited source establishes a geocoded door and building association; it does **not** imply public or step-free access unless those fields are affirmative. “Graph-connected” means only that the point is attached to the bundled pedestrian graph; it does not by itself establish endpoint eligibility. Unknown remains unknown and step-free routing fails closed. Official identity-only evidence is reconciled separately below.

| Building | Verified geocoded doors | Inferred geocoded approaches | Graph-connected access points | Explicitly accessible geocoded doors | Unresolved |
| --- | ---: | ---: | ---: | ---: | --- |
| MN | 1 | 0 | 1 | 0 | Ordinary public access status is not affirmatively published. Step-free status requires an authoritative source or field survey. |
| DH | 3 | 0 | 3 | 0 | Ordinary public access status is not affirmatively published. Step-free status requires an authoritative source or field survey. |
| IB | 2 | 0 | 2 | 0 | Ordinary public access status is not affirmatively published. Step-free status requires an authoritative source or field survey. |
| DV | 4 | 0 | 4 | 2 | Ordinary public access status is not affirmatively published. Step-free status requires an authoritative source or field survey. |
| CCT | 1 | 0 | 1 | 1 | Ordinary public access status is not affirmatively published. |
| HM | 1 | 0 | 1 | 0 | Ordinary public access status is not affirmatively published. Step-free status requires an authoritative source or field survey. |
| KN | 3 | 0 | 3 | 3 | Ordinary public access status is not affirmatively published. |
| IC | 0 | 0 | 0 | 0 | No publishable exterior access point is recorded. |
| RAWC | 1 | 0 | 1 | 0 | Ordinary public access status is not affirmatively published. Step-free status requires an authoritative source or field survey. |
| XR | 2 | 0 | 2 | 0 | Ordinary public access status is not affirmatively published. Step-free status requires an authoritative source or field survey. |
| HB | 2 | 0 | 2 | 0 | Ordinary public access status is not affirmatively published. Step-free status requires an authoritative source or field survey. |
| AX | 0 | 1 | 1 | 0 | Ordinary public access status is not affirmatively published. Step-free status requires an authoritative source or field survey. One or more approach points are topology inferences, not verified doors. |
| WC | 0 | 0 | 0 | 0 | No publishable exterior access point is recorded. |
| CUP | 0 | 0 | 0 | 0 | No publishable exterior access point is recorded. |
| DW | 1 | 0 | 1 | 0 | Ordinary public access status is not affirmatively published. Step-free status requires an authoritative source or field survey. |
| FCSH | 0 | 0 | 0 | 0 | No publishable exterior access point is recorded. |
| GF | 0 | 0 | 0 | 0 | No publishable exterior access point is recorded. |
| NSB | 0 | 0 | 0 | 0 | No publishable exterior access point is recorded. |
| PL | 0 | 0 | 0 | 0 | No publishable exterior access point is recorded. |
| BG | 0 | 0 | 0 | 0 | No publishable exterior access point is recorded. |
| LH | 0 | 0 | 0 | 0 | No publishable exterior access point is recorded. |
| EH | 0 | 1 | 1 | 0 | Ordinary public access status is not affirmatively published. Step-free status requires an authoritative source or field survey. One or more approach points are topology inferences, not verified doors. |
| LL | 0 | 1 | 1 | 0 | Ordinary public access status is not affirmatively published. Step-free status requires an authoritative source or field survey. One or more approach points are topology inferences, not verified doors. |
| MV | 0 | 1 | 1 | 0 | Ordinary public access status is not affirmatively published. Step-free status requires an authoritative source or field survey. One or more approach points are topology inferences, not verified doors. |
| MC | 0 | 1 | 1 | 0 | Ordinary public access status is not affirmatively published. Step-free status requires an authoritative source or field survey. One or more approach points are topology inferences, not verified doors. |
| OPH | 2 | 0 | 2 | 0 | Ordinary public access status is not affirmatively published. Step-free status requires an authoritative source or field survey. |
| PP | 0 | 1 | 1 | 0 | Ordinary public access status is not affirmatively published. Step-free status requires an authoritative source or field survey. One or more approach points are topology inferences, not verified doors. |
| RIH | 0 | 1 | 1 | 0 | Ordinary public access status is not affirmatively published. Step-free status requires an authoritative source or field survey. One or more approach points are topology inferences, not verified doors. |
| SW | 0 | 1 | 1 | 0 | Ordinary public access status is not affirmatively published. Step-free status requires an authoritative source or field survey. One or more approach points are topology inferences, not verified doors. |
| NRB | 0 | 1 | 1 | 0 | Ordinary public access status is not affirmatively published. Step-free status requires an authoritative source or field survey. One or more approach points are topology inferences, not verified doors. |

## Official UTM barrier-free entrance reconciliation

UTM Facilities separately publishes named **barrier-free building entrances** in its snow and ice removal strategy: https://www.utm.utoronto.ca/facilities/utm-strategy-snow-and-ice-removal. These records establish the entrance identity and barrier-free designation, but the page does not publish exact door coordinates. Gapwise therefore keeps them as non-routable evidence candidates until a candidate can be matched to publishable geometry or a field survey.

The official University of Toronto interactive map (https://map.utoronto.ca/?id=1809) remains a visual-QA reference only. The reproducibility investigation, including the network limitations encountered on 2026-08-25, is recorded in `docs/UTM_ENTRANCE_REGISTRY.md`. No marker position was transcribed into routing coordinates and no structured official entrance feed was validated.

The “minimum unresolved accessible coordinates” column is a conservative lower bound: official barrier-free physical instances minus currently geocoded entrances that are independently marked accessible. A value of zero does **not** prove identity-level reconciliation; the geocoded coordinates still need an explicit source match to the named official entrance.

| Building | Official named identities | Physical instances | Verified geocoded doors | Explicitly accessible coordinates | Minimum unresolved accessible coordinates | Official labels |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| MN | 3 | 3 | 1 | 0 | 3 | Main; Field side; Lot #1 |
| DH | 2 | 2 | 3 | 0 | 2 | Main; Field side |
| IB | 3 | 3 | 2 | 0 | 3 | Main; North; South |
| DV | 3 | 3 | 4 | 2 | 1 | Main; End of 5 Minute Walk; Connection with CCT |
| CCT | 3 | 3 | 1 | 1 | 2 | Main; Link; Connection with DV |
| HM | 1 | 1 | 1 | 0 | 1 | Main |
| RAWC | 1 | 1 | 1 | 0 | 1 | Main |
| XR | 2 | 2 | 2 | 0 | 2 | 5 Minute Walk side; Academic Annex side |
| HB | 2 | 2 | 2 | 0 | 2 | Main; Rear |
| AX | 1 | 1 | 0 | 0 | 1 | Main |
| WC | 1 | 1 | 0 | 0 | 1 | Rear |
| DW | 1 | 1 | 1 | 0 | 1 | Main |
| NSB | 2 | 2 | 0 | 0 | 2 | Main; Rear |
| BG | 1 | 1 | 0 | 0 | 1 | Main |
| EH | 2 | 3 | 0 | 0 | 3 | Main; Rear ×2 |
| OPH | 2 | 2 | 2 | 0 | 2 | Main; Rear |
| RIH | 1 | 1 | 0 | 0 | 1 | Main |

The same official Facilities source also names **Early Learning Centre: Main**. Early Learning Centre is not currently in the Gapwise UTM building registry, so it is recorded here as an upstream coverage gap rather than silently assigned to another building. Absence from the barrier-free list does not prove that a building is inaccessible.
