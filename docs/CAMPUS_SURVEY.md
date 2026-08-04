# UTM campus field-survey workflow

Gapwise only routes over records that can be traced to a field survey or another
publishable source. Do not infer corridors, entrances, accessibility, or distances
from a building outline. Do not collect restricted floor plans, faces, student
information, access-control details, or anything you are not allowed to publish.

The canonical input format is [`survey/campus-survey.schema.json`](../survey/campus-survey.schema.json).
Runtime validation and conversion live in
[`src/data/utm/survey-format.ts`](../src/data/utm/survey-format.ts). Start from the
ready-to-fill [`survey/2026-08-04-template.json`](../survey/2026-08-04-template.json).

## Before visiting campus

1. Copy the dated template to a new file named for the survey date, for example
   `survey/2026-08-04-mn-floor-1.json`.
2. Add every surveyed building to `buildings` and list only floors you will record.
   Use a code from the recognition registry. Recognition does not imply route coverage.
3. Choose a consistent measuring method. A laser measure is preferred indoors; a
   measuring wheel or recorded path length is useful outdoors. Do not guess distances.
4. Give every record a stable lowercase ID, such as `mn:door:main-east` or
   `mn:edge:main-east-hall-1a`. IDs may contain numbers, dots, colons, underscores,
   and hyphens.
5. Decide how photos will be referenced without committing private or sensitive
   images. `photoReference` may be a non-secret inventory label.

## What to record in the field

For every point or connection, collect the equivalent of this field card:

```text
NODE ID
BUILDING
FLOOR
KIND
LABEL OR ROOM
CONNECTED FROM
DISTANCE
ENVIRONMENT
STAIRS
ACCESSIBILITY
BIDIRECTIONAL
PHOTO REFERENCE
NOTES
```

`nodes` support these kinds:

- `entrance` — a building entrance with WGS84 `longitude` and `latitude`;
- `hallway` — a measured indoor corridor point;
- `junction` — a place where surveyed paths branch;
- `room` — the public door location for a classroom or other appropriate room;
- `stairs` and `elevator` — one node per surveyed floor landing;
- `door` — an interior doorway or other meaningful transition;
- `outdoor_path` — a measured outdoor path point with WGS84 coordinates.

Indoor nodes use a consistent local `indoorX`/`indoorY` coordinate system for that
building. The coordinates are for diagram placement; `distanceMeters` on each edge is
the routing distance. Outdoor path points use `building: null` and `floor: null`.

Every edge records `connectedFrom`, `connectedTo`, measured `distanceMeters`,
`environment` (`indoor`, `outdoor`, or `covered`), `stairs`, `bidirectional`, and one
of exactly three accessibility states:

- `accessible` — the complete connection was checked and is step-free;
- `not_accessible` — the connection is known not to be step-free;
- `unknown` — accessibility was not fully verified.

Use `unknown` whenever any part of a connection is uncertain. A stairs edge cannot be
`accessible`. Set `bidirectional: false` for one-way doors or paths and make
`connectedFrom`/`connectedTo` match the permitted direction.

## Enter and validate the survey

Fill the JSON file after the visit. The importer checks the TypeScript-validated
format in addition to the documented JSON Schema. It reports all practical issues at
once, including:

- duplicate or reserved node/edge IDs;
- missing edge endpoints and isolated survey nodes;
- zero, negative, non-finite, or implausibly large distances;
- unrecognized or undeclared buildings and undeclared floors;
- missing coordinate pairs and out-of-range geographic coordinates;
- malformed records, extra fields, invalid node kinds, environments, and
  accessibility states;
- indoor edges whose endpoints do not belong to the same building;
- stairs edges with contradictory accessibility or no stairs endpoint;
- duplicate connections and self-loops.

Run a dry-run first. It validates and converts in memory but writes nothing:

```sh
bun run survey:dry-run -- survey/2026-08-04-mn-floor-1.json
```

The unfilled template is intentionally accepted by dry-run so its structure can be
checked. A real import refuses to replace production data with an empty graph.

After fixing every reported issue, generate the production graph:

```sh
bun run survey:import -- survey/2026-08-04-mn-floor-1.json
```

The input file is a complete production snapshot, not an append-only patch. Once
routing data exists, begin with the latest committed survey source and add the new
records; importing a file that omits earlier records will remove them from the
generated graph. Review that deletion diff before committing.

To inspect a different output without touching the production graph:

```sh
bun run survey:import -- survey/2026-08-04-mn-floor-1.json \
  --output /tmp/utm-survey-routing.json --dry-run
```

The importer validates the complete input before writing, sorts nodes and edges by ID,
and replaces `src/data/utm/generated/survey-routing.json` atomically. Invalid input
does not partially modify the production file.

## Review before committing

Run the full project checks:

```sh
bun install --frozen-lockfile
bun test
bun run typecheck
bun run lint
bun run format:check
bun run build
bun audit
git diff --check
```

Review the generated diff for unexpected coordinates, private notes, photo contents,
or credentials. Test at least one route in each direction, one disconnected-path
failure, and a step-free request. A second person should review the measurements before
the route is described as verified in a release.
