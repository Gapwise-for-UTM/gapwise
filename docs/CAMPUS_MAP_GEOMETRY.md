# UTM campus map geometry

Gapwise treats campus geography as product data, not as a property of whichever basemap happens to be rendered.

## Source-of-truth rules

`src/data/utm/building-footprints.ts` is the only source of building identity used by the interactive map.

The canonical layer has one `Polygon` or `MultiPolygon` per recognized building code. A campus building may contain multiple disconnected polygons (for example a residence complex), but every polygon belongs to one explicit registry code.

The map must use the canonical footprint for all four interactions:

1. pointer hover,
2. click/tap selection,
3. selected/hover highlight geometry,
4. search-camera focus.

The basemap building layer is visual only. Entrance coordinates are routing/navigation data only. Neither may be used to guess building identity.

### Fail closed

If one geographic point belongs to zero canonical footprints, it selects no building.

If one geographic point belongs to more than one canonical footprint, it also selects no building. Ambiguity is a data-quality problem to fix explicitly; it must never be resolved by choosing the nearest entrance, nearest building centre, or first rendered feature.

This rule is intentionally stricter than a forgiving generic map UI because Gapwise uses building identity for student navigation.

## Current canonical sources

The footprint fragments in `src/data/utm/footprints/` come from current OpenStreetMap geometry and are tied to explicit source way/relation IDs. Gapwise does not derive these identities by spatial proximity.

Several dense/complex academic buildings use reviewed OSM multipolygon relations:

| Gapwise code | Building | OSM relation |
| --- | --- | --- |
| `XR` | Student Centre | `20449622` |
| `DH` | Deerfield Hall | `20449623` |
| `DV` | William G. Davis Building | `20449624` |
| `KN` | Kaneff Centre / Innovation Complex | `20462171` |

The Erindale regression cluster is specifically protected by canonical geometry for:

- `EH` — Erindale Hall
- `DW` — Erindale Studio Theatre
- `DV` — William G. Davis Building
- `KN` — Kaneff Centre / Innovation Complex

`tests/building-footprints.test.ts` must remain green before these geometries are accepted.

The OpenStreetMap audit generator is intentionally conservative. If current source geometry cannot be assigned without ambiguity it stays in the audit report instead of being assigned to a nearby building. One current OSM way in the Davis/CCT complex is deliberately left unresolved by the generator because its raw entrance membership is ambiguous; the reviewed relation geometry is the runtime source of truth instead.

## Campus boundary and camera

`src/features/routing/campus-region.ts` owns the common definition of the mapped UTM region.

The semantic on-campus test remains the routing-network hull plus network-distance rule used by live location. The camera uses a padded rectangle derived from the same routing geometry because MapLibre `maxBounds` is rectangular.

`CampusMap` therefore uses:

- `maxBounds` from `getCampusCameraBounds(UTM_ROUTING_GRAPH)`,
- `renderWorldCopies: false`,
- a campus-scale minimum zoom,
- a constrained maximum pitch,
- a compass/rotatable camera,
- campus-bounds fitting for the overview/reset action.

The user can explore UTM naturally but cannot pan Gapwise across the world or zoom out to a world-scale map.

## Search and camera contract

Selecting a search result sets a canonical building code. `CampusMap` then fits the exact canonical footprint plus its verified entrances with the caller-provided responsive padding.

Search must not scroll the document to make the result visible. Camera animation should keep the existing reduced-motion behaviour: no animated movement when the user requests reduced motion.

## 3D is appearance, never identity

3D models must never participate in hit-testing.

`src/data/utm/campus-models.ts` is the integration contract for future local GLB/GLTF models. Each model is keyed to a canonical building code and includes a WGS84 anchor, altitude, rotation, scale, provenance, licence, and verification status.

The expected MapLibre architecture is:

1. basemap / terrain-quality visual context,
2. canonical footprint interaction layer,
3. optional georeferenced GLB/GLTF custom layer sharing the MapLibre camera/depth buffer,
4. Gapwise routes and entrance/user markers.

If a model is missing or fails to render, selection remains correct because the canonical footprint stays authoritative.

### Zero-cost model pipeline

The preferred path is reproducible and offline:

1. use open, redistribution-compatible geographic building data;
2. preserve real `building:part`, height/levels, roof and material information when available;
3. generate/clean geometry with open-source tooling such as OSM2World and Blender when appropriate;
4. export optimized local GLB files;
5. verify the model transform against the canonical footprint before adding it to `CAMPUS_BUILDING_MODELS`;
6. serve models as local static assets, with no paid map/model API required at runtime.

City of Mississauga LOD2/massing data may be useful as a geometry cross-check or model source only after the exact dataset's redistribution/licensing terms have been confirmed for Gapwise. Public visibility of an ArcGIS layer is not by itself permission to copy it into the repository.

The official UTM/Concept3D map is a visual and identity QA reference. Gapwise must not scrape, download, reproduce, or reverse-engineer proprietary Concept3D rendering/model assets. Comparable visual quality should be produced independently from permitted/open sources.

## Review checklist for a footprint change

A geometry change is not complete until all of the following are true:

- source ID/provenance is explicit;
- the registry code is exact;
- no nearest-feature/proximity assignment is introduced;
- representative interior points resolve to the intended code;
- sampled overlap cannot cross-resolve to another code;
- the geometry fits inside the shared UTM camera envelope;
- the Erindale/Davis/Studio Theatre/Kaneff regression cluster remains distinct;
- search focus and map selection use the same geometry;
- TypeScript, unit tests, lint, formatting, build and browser checks pass.
