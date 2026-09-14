# UTM field survey runbook

This runbook closes the remaining evidence gaps for Maanjiwe nendamowinan (MN), the CCT ↔ Hazel McCallion Academic Learning Centre / Library connection, and the official residence entrances currently represented only as identities or approaches.

Gapwise remains fail-closed: a nearby point, a screenshot marker, or a plausible-looking door is not enough to publish exact routing geometry.

## Survey tool

Open `/survey` on a phone. Useful deep links are:

- `/survey?building=MN`
- `/survey?building=CCT`
- `/survey?building=OPH`
- `/survey?building=EH`
- `/survey?building=RIH`

The page stores its draft in browser `localStorage`. Entrance observations export as the existing `CampusSurvey` schema and are validated before download. The CCT/HMALC walkthrough exports separately because indoor corridor notes are **not** routable geometry until they are converted to the local indoor coordinate system.

For a physical OSM door already known to Gapwise, select that exact candidate only while standing at the matching door. That records the field identity reconciliation while retaining the source-backed OSM coordinate. For a newly discovered door, capture the browser location at the threshold and record the reported accuracy; reconcile the reading against the physical building and compatible source geometry before import.

Never select an `approach_only` point as a door.

## 1. MN: complete exterior perimeter

UTM Facilities names three barrier-free exterior identities: **Main**, **Field side**, and **Lot #1**. Separate first-party U of T event logistics name a **North entrance (2nd floor)**. Those identities are deliberately not assumed to be synonyms.

Gapwise currently carries three useful physical-door candidates for field reconciliation:

- OSM `13738201127` — confirmed MN physical door geometry, exact official identity unknown.
- OSM `13736687034` — `entrance=main` near MN, but its building identity is not strong enough for automatic assignment.
- OSM `13736687041` — `entrance=main` near MN, with the same unresolved building-identity problem.

Do one uninterrupted perimeter walk. Start from a memorable corner and continue in one direction until returning to the start. Record **every exterior door**, not only the four named targets. For each door capture the physical side of the building, floor/level, signage, observed access restriction, stairs/ramp at the threshold, automatic opener/button if visible, nearby pedestrian path, door count, photo reference, and either a selected existing OSM candidate or a live field position.

Then explicitly reconcile Main, Field side, Lot #1, and North entrance (2nd floor). If the site evidence does not distinguish an identity, leave it unresolved.

## 2. CCT ↔ HMALC / Library Link

First-party UTM sources establish that a doorway/link joins CCT to the Hazel McCallion Academic Learning Centre / Library. They do **not** publish a complete route graph.

Start at a clearly named public point in CCT and walk continuously to a clearly named public point in HMALC / the Library. In the walkthrough recorder, create a new segment whenever any of these occurs:

- a door or controlled threshold;
- a meaningful turn or corridor junction;
- a level change;
- stairs, elevator, or ramp choice;
- an access-hours/signage boundary;
- the building identity changes from CCT to HM/HMALC.

Measure the segment distance rather than guessing it. Record stairs and accessibility only from direct observation. Do not use indoor phone GPS as corridor geometry. The walkthrough JSON is evidence capture; after review, convert it into `src/data/utm/indoor/CCT/` and `src/data/utm/indoor/HM/` local-coordinate nodes and edges and add the cross-building connection explicitly.

Before publishing, test both directions and a step-free alternative. If the step-free route is not completely verified, leave its accessibility `unknown`.

## 3. Residence entrance reconciliation

UTM Facilities currently gives the target identities:

- **Erindale Hall (EH):** Main; Rear ×2.
- **Oscar Peterson Hall (OPH):** Main; Rear.
- **Roy Ivor Hall (RIH):** Main.

### OPH

Gapwise already has two source-backed physical exterior doors:

- OSM `13738728068` at `[-79.6659355, 43.5486076]`.
- OSM `1728224590` at `[-79.6656991, 43.5487850]`.

Stand at each door and determine whether field evidence resolves **Main** versus **Rear**. The existence of an OPH main lobby is corroborated independently, but that does not by itself select either coordinate.

### EH

The existing Gapwise point `1312381405` is an **approach only**, not a door. Walk the whole relevant exterior and record three exact physical entrances: Main, Rear 1, Rear 2. Give the two Rear instances stable distinguishing descriptions so they do not collapse into one record.

### RIH

The existing Gapwise point `1312390438` is also an **approach only**. Locate and record the exact physical Main entrance rather than promoting the approach by proximity.

## 4. Review and import

Put the downloaded entrance survey under `survey/` and dry-run it first:

```bash
bun run survey:dry-run survey/<field-survey>.json
```

Review the generated graph and provenance. Only then import it:

```bash
bun run survey:import survey/<field-survey>.json
bun run routing:refresh
bun run routing:audit
bun test tests/campus-survey.test.ts tests/utm-entrance-registry.test.ts tests/utm-official-access.test.ts tests/field-survey-targets.test.ts
```

For CCT/HMALC, the walkthrough export is **not** accepted directly by `survey:import`. Build the indoor floor-local nodes/edges only after the walkthrough geometry is defensible, then follow `src/data/utm/indoor/README.md` and test an end-to-end route that crosses the building boundary.

## Source boundary

The University of Toronto interactive map may be used for visual QA and corroboration only under the current Gapwise evidence policy. Do not derive WGS84 coordinates from screenshot pixels, scrape proprietary map assets, or reverse-engineer private map data. If U of T or the map provider later supplies an authorized structured API/data export, ingest it as a new explicit source with its terms and provenance recorded.
