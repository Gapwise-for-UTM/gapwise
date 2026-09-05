# Campus data ownership

Gapwise separates **public UTM campus facts** from **product behavior** so every surface can consume one source of truth without introducing a runtime dependency on another website or GitHub repository.

## Canonical source

Canonical public UTM campus facts and geometry live in:

- repository: `andrewmuratov/gapwise-data`
- path: `data/utm`

This includes building identity, aliases, categories, footprints, entrances, accessibility evidence, outdoor/indoor routing graph inputs, provenance, confidence metadata, and generated data audits.

## Core responsibility

`andrewmuratov/gapwise` owns deterministic behavior built on that dataset:

- timetable and student-state semantics;
- route calculation and pathfinding algorithms;
- route preferences and fail-closed accessibility behavior;
- gap planning and feasibility logic;
- public API/OpenAPI orchestration and SDK contracts;
- MapLibre/product presentation, including future Gapwise Live surfaces.

The core repository keeps a vendored compatibility snapshot at `src/data/utm`. Existing imports deliberately continue to use that local path. The mirror is checked byte-for-byte against `gapwise-data` in CI and is not an independent source of truth.

## Maintenance workflow

With `gapwise` and `gapwise-data` checked out as sibling repositories:

```bash
bun run campus-data:check
bun run campus-data:sync
bun run campus-data:publish
```

- `campus-data:check` fails when the core mirror diverges from the canonical data repository.
- `campus-data:sync` copies canonical data into the core compatibility mirror.
- `campus-data:publish` is an explicit maintenance path for existing core routing/survey generators that currently produce data artifacts. It copies those artifacts back to `gapwise-data` and refreshes integrity checksums.

Existing data-writing commands synchronize first and publish their resulting dataset afterward. This allows generator logic to remain in core while the resulting campus dataset is owned by `gapwise-data`.

## Consumer rule

Mobile, AI/MCP, docs, and status should **not** copy or recreate UTM campus facts. They continue consuming the stable Gapwise API/SDK/product contracts appropriate to their role.

There is intentionally no production request path like:

```text
gapwise -> data.gapwise.ca -> campus JSON
```

A deployment contains the campus snapshot it was built and tested against, so an outage of `data.gapwise.ca` or GitHub does not break routing.

## Where to make a change

- Change a building, entrance, footprint, routing graph fact, evidence record, or provenance: **`gapwise-data`**.
- Change how routes are calculated, how uncertainty is interpreted, how gaps are planned, or how maps are rendered: **`gapwise`**.
- Change a public API or SDK contract: **`gapwise`**, with normal contract-parity checks.
- Change an AI permission/tool contract: **`gapwise-ai`**; consume deterministic campus intelligence rather than forking it.
- Change documentation of a released contract: **`gapwise-docs`**; link raw campus evidence back to `gapwise-data`.

The machine-readable version of this boundary is also recorded in `gapwise.ecosystem.json` and `campus-data.source.json`.
