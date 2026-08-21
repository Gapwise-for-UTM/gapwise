# UTM campus access audit

Generated deterministically by `bun run routing:audit`. “Verified” in the routing table establishes a published door coordinate and building association; it does **not** imply public or step-free access unless those fields are affirmative. Unknown remains unknown and step-free routing fails closed. Unresolved text in the first table refers strictly to coordinate-qualified routing records; official identity-only evidence is reconciled separately below.

| Building | Routable verified doors | Routable inferred approaches | Graph-connected points | Verified step-free doors | Unresolved |
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

The official University of Toronto interactive map (https://map.utoronto.ca/?id=1809) was visually reviewed on 2026-08-21 as a corroborating QA reference. Its accessibility markers reinforce that several academic-core buildings have multiple exterior access points, including clusters around MN/DH/IB/HM/CCT/DV/KN/XR/EH/OPH. Gapwise does **not** scrape, copy, reverse-engineer, or transpose proprietary marker positions into routing coordinates.

The “minimum unresolved accessible coordinates” column is a conservative lower bound: official barrier-free physical instances minus currently geocoded entrances that are independently marked accessible. A value of zero does **not** prove identity-level reconciliation; the routable coordinates still need an explicit source match to the named official entrance.

| Building | Official named identities | Physical instances | Routable verified doors | Explicitly accessible coordinates | Minimum unresolved accessible coordinates | Official labels |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| AX | 1 | 1 | 0 | 0 | 1 | Main |
| WC | 1 | 1 | 0 | 0 | 1 | Rear |
| CCT | 3 | 3 | 1 | 1 | 2 | Main; Link; Connection with DV |
| DH | 2 | 2 | 3 | 0 | 2 | Main; Field side |
| DW | 1 | 1 | 1 | 0 | 1 | Main |
| HM | 1 | 1 | 1 | 0 | 1 | Main |
| HB | 2 | 2 | 2 | 0 | 2 | Main; Rear |
| IB | 3 | 3 | 2 | 0 | 3 | Main; North; South |
| MN | 3 | 3 | 1 | 0 | 3 | Main; Field side; Lot #1 |
| NSB | 2 | 2 | 0 | 0 | 2 | Main; Rear |
| RAWC | 1 | 1 | 1 | 0 | 1 | Main |
| BG | 1 | 1 | 0 | 0 | 1 | Main |
| XR | 2 | 2 | 2 | 0 | 2 | 5 Minute Walk side; Academic Annex side |
| DV | 3 | 3 | 4 | 2 | 1 | Main; End of 5 Minute Walk; Connection with CCT |
| EH | 2 | 3 | 0 | 0 | 3 | Main; Rear ×2 |
| OPH | 2 | 2 | 2 | 0 | 2 | Main; Rear |
| RIH | 1 | 1 | 0 | 0 | 1 | Main |

The same official Facilities source also names **Early Learning Centre: Main**. Early Learning Centre is not currently in the Gapwise UTM building registry, so it is recorded here as an upstream coverage gap rather than silently assigned to another building. Absence from the barrier-free list does not prove that a building is inaccessible.
