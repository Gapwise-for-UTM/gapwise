# Campus data and documentation boundaries

Canonical public UTM campus facts, geometry, routing graph inputs, provenance, and data-maintenance guidance live in [`Gapwise-for-UTM/gapwise-data`](https://github.com/Gapwise-for-UTM/gapwise-data).

Public human-readable data documentation lives at **https://docs.gapwise.ca/data/** and the raw first-party distribution lives at **https://data.gapwise.ca/datasets/utm/latest/**.

This repository intentionally retains only:

- the validated runtime compatibility snapshot under `src/data/utm`;
- deterministic routing, gap-planning, map, API, and SDK behavior;
- consumer-side tests and integration contracts;
- the transitional data-maintenance adapters that are still coupled to core routing types.

Do not add new source-of-truth campus facts or public data documentation here. Change canonical campus facts in `gapwise-data`, and change released public documentation in `gapwise-docs`.

The runtime app does **not** fetch `data.gapwise.ca` or GitHub on student requests. The snapshot is pinned and tested at build time for reliability.
