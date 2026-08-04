# Contributing verified UTM route data

Gapwise deliberately ships without invented indoor geometry. A building becomes
"mapped" only after every published node and edge can be tied to an official UTM
document, an on-site survey that contributors are allowed to publish, or compatible
OpenStreetMap data.

For each record, include `source`, `sourceUrl`, `lastVerified` (`YYYY-MM-DD`), and
`verificationStatus`. Keep raw survey material outside this repository if it contains
personal or security-sensitive information.

## Mapping workflow

1. Add building entrances to `entrances.geojson`, using WGS84 longitude/latitude.
   Record `wheelchair=yes/no` only when the source says so; absence means unknown.
2. Add outdoor hallway/path intersections to `outdoor-nodes.geojson` and connect
   only surveyed or OSM ways in `outdoor-edges.json`. Calculate edge distance from
   the published geometry, not by guessing.
3. Under `indoor/<BUILDING>/`, list floors in `floors.json`. Indoor coordinates are
   local SVG coordinates and must never be put directly on the geographic map.
4. Add hallway intersections, room doors, exterior doors, stairs, and elevators to
   `nodes.json`. Room nodes need a `room` identifier; vertical nodes need a floor.
5. Add corridor and floor-transition edges to `edges.json`. Set `stairs: true` only
   for stairs. Set `accessibility: "accessible"` only after door widths, entrance
   access, and the complete edge have been verified; otherwise use `"unknown"` or
   `"not_accessible"`. Elevator edges should include an explicit wait
   estimate only when a local measurement supports it; otherwise the centralized
   routing default applies.
6. Connect an indoor entrance node to the matching geographic entrance ID. Test a
   room → hallway → exit → outdoor path → entrance → hallway → room route, plus a
   step-free alternative. Ask another contributor to verify the source and geometry.

Never trace a restricted floor plan, publish private room data, infer a corridor from
the shape of a building, or label an unverified route accessible. An empty dataset is
safer and more useful than a confident-looking fictional route.
