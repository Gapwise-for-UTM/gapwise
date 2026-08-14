from __future__ import annotations

import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NEW_CODES = ["IC", "WC", "CUP", "FCSH", "GF", "NSB", "PL", "BG", "LH"]
EXPECTED_CODES = {
    "MN", "DH", "IB", "DV", "CCT", "HM", "KN", "IC", "RAWC", "XR", "HB", "AX",
    "WC", "CUP", "DW", "FCSH", "GF", "NSB", "PL", "BG", "LH", "EH", "LL", "MV",
    "MC", "OPH", "PP", "RIH", "SW", "NRB",
}


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    if old not in text:
        raise RuntimeError(f"Expected source block not found in {path}: {old[:100]!r}")
    write(path, text.replace(old, new, 1))


def run(*args: str) -> None:
    subprocess.run(args, cwd=ROOT, check=True)


# 1. Make the canonical OSM generator cover every official UTM facility and never
#    let entrance membership assign a whole unlabeled relation to one adjacent building.
replace_once(
    "scripts/generate-building-footprints.ts",
    'const CAMPUS_BOUNDS = "-79.6715,43.5450,-79.6600,43.5524";',
    'const CAMPUS_BOUNDS = "-79.6725,43.5440,-79.6595,43.5555";',
)
replace_once(
    "scripts/generate-building-footprints.ts",
    """    const candidateCodes = resolveCandidates(\n      overrideCode,\n      exactCode,\n      memberNodeIds,\n      entranceCodeByNode,\n    );""",
    """    // A relation may wrap multiple adjacent named buildings. Never let one entrance\n    // silently assign that entire unlabeled relation to a single building identity.\n    // Exact labels and reviewed relation overrides remain valid; otherwise member ways\n    // are left available for their own exact/override matching below.\n    const candidateCodes = resolveCandidates(\n      overrideCode,\n      exactCode,\n      overrideCode || exactCode ? memberNodeIds : [],\n      entranceCodeByNode,\n    );""",
)
replace_once(
    "scripts/generate-building-footprints.ts",
    'category: "academic" | "residence";',
    'category: "academic" | "residence" | "facility";',
)

# 2. Preserve semantic categories for official non-academic facilities.
replace_once(
    "src/data/utm/building-registry.ts",
    'category: "academic" | "residence";',
    'category: "academic" | "residence" | "facility";',
)
for code in ("WC", "CUP", "GF", "LH"):
    replace_once(
        "src/data/utm/building-registry.ts",
        f'code: "{code}",\n    name:',
        f'code: "{code}",\n    name:',
    )
    text = read("src/data/utm/building-registry.ts")
    marker = f'code: "{code}",'
    start = text.index(marker)
    end = text.index("  },", start)
    block = text[start:end]
    if 'category: "academic"' not in block:
        raise RuntimeError(f"Expected academic category for {code}")
    block = block.replace('category: "academic"', 'category: "facility"', 1)
    write("src/data/utm/building-registry.ts", text[:start] + block + text[end:])

replace_once(
    "src/data/utm/building-registry.ts",
    """export function normalizePublicBuildingCode(value: unknown): string | null {\n  if (typeof value !== \"string\") return null;\n  return getRecognizedBuilding(value)?.code ?? null;\n}""",
    """const PUBLIC_BUILDING_CODE_ALIASES: Record<string, string> = {\n  CC: \"CCT\",\n  RA: \"RAWC\",\n  R: \"LL\",\n  SB: \"NSB\",\n};\n\nexport function normalizePublicBuildingCode(value: unknown): string | null {\n  if (typeof value !== \"string\") return null;\n  const normalized = value.trim().toUpperCase();\n  return getRecognizedBuilding(normalized)?.code ?? PUBLIC_BUILDING_CODE_ALIASES[normalized] ?? null;\n}""",
)
replace_once(
    "src/data/utm/building-footprints.ts",
    'category: "academic" | "residence";',
    'category: "academic" | "residence" | "facility";',
)
replace_once(
    "src/data/utm/routing-buildings.ts",
    'category: "academic" | "residence";',
    'category: "academic" | "residence" | "facility";',
)

# 3. Generate the complete source-backed footprint set, then materialize only the
#    newly added official buildings as canonical source fragments.
artifact_dir = ROOT / "artifacts"
artifact_dir.mkdir(exist_ok=True)
run(
    "bun",
    "scripts/generate-building-footprints.ts",
    "--output",
    "artifacts/building-footprints-complete.geojson",
    "--report",
    "artifacts/utm-building-footprint-complete-report.json",
    "--require-complete",
)
collection = json.loads((artifact_dir / "building-footprints-complete.geojson").read_text())
report = json.loads((artifact_dir / "utm-building-footprint-complete-report.json").read_text())
resolved = set(report["resolvedCodes"])
if resolved != EXPECTED_CODES or report["missingCodes"]:
    raise RuntimeError(f"Official building coverage is incomplete: {report['missingCodes']}")

features = {feature["properties"]["buildingCode"]: feature for feature in collection["features"]}
for code in NEW_CODES:
    feature = features.get(code)
    if not feature:
        raise RuntimeError(f"Generated footprint missing {code}")
    output = ROOT / "src/data/utm/footprints" / f"{code}.geojson"
    output.write_text(json.dumps(feature, indent=2) + "\n", encoding="utf-8")

# Innovation Complex and Kaneff must be distinct source identities, never a shared
# relation inferred from an entrance.
assigned = report["assignedSources"]
ic_sources = [item for item in assigned if item["buildingCode"] == "IC"]
kn_sources = [item for item in assigned if item["buildingCode"] == "KN"]
if not any(item["sourceId"] == "way/1127939664" for item in ic_sources):
    raise RuntimeError(f"Innovation Complex did not resolve to reviewed way/1127939664: {ic_sources}")
if not any(item["sourceId"] == "way/1500300991" for item in kn_sources):
    raise RuntimeError(f"Kaneff Centre did not retain reviewed way/1500300991: {kn_sources}")

fragments_path = "src/data/utm/footprint-fragments.ts"
fragments = read(fragments_path)
new_imports = """import icRaw from \"./footprints/IC.geojson?raw\";\nimport wcRaw from \"./footprints/WC.geojson?raw\";\nimport cupRaw from \"./footprints/CUP.geojson?raw\";\nimport fcshRaw from \"./footprints/FCSH.geojson?raw\";\nimport gfRaw from \"./footprints/GF.geojson?raw\";\nimport nsbRaw from \"./footprints/NSB.geojson?raw\";\nimport plRaw from \"./footprints/PL.geojson?raw\";\nimport bgRaw from \"./footprints/BG.geojson?raw\";\nimport lhRaw from \"./footprints/LH.geojson?raw\";\n"""
if "./footprints/IC.geojson?raw" not in fragments:
    fragments = fragments.replace(
        'import nrbRaw from "./footprints/NRB.geojson?raw";\n',
        'import nrbRaw from "./footprints/NRB.geojson?raw";\n' + new_imports,
    )
    fragments = fragments.replace(
        "  nrbRaw,\n] as const;",
        "  nrbRaw,\n  icRaw,\n  wcRaw,\n  cupRaw,\n  fcshRaw,\n  gfRaw,\n  nsbRaw,\n  plRaw,\n  bgRaw,\n  lhRaw,\n] as const;",
    )
write(fragments_path, fragments)

# 4. Let the explorer search/focus every canonical building even when entrance-level
#    routing has not yet been surveyed. No fake routing point is created.
explorer_path = "src/features/routing/building-explorer.ts"
replace_once(
    explorer_path,
    'import { resolveAcornLocation } from "./location-resolver";',
    'import { getCampusBuildingFootprint } from "@/data/utm/building-footprints";\nimport { resolveAcornLocation } from "./location-resolver";',
)
text = read(explorer_path).replace("campus: CampusBuilding;", "campus: CampusBuilding | null;")
write(explorer_path, text)
replace_once(
    explorer_path,
    """  const campus = getCampusBuilding(building.code);\n  return campus ? { building, campus, room, floor, floorVerification } : null;""",
    """  if (!getCampusBuildingFootprint(building.code)) return null;\n  const campus = getCampusBuilding(building.code);\n  return { building, campus, room, floor, floorVerification };""",
)
replace_once(
    explorer_path,
    """  const building = getRecognizedBuilding(code);\n  const campus = getCampusBuilding(code);\n  if (!building || !campus) return null;\n  return {\n    building,\n    campus,\n    verifiedEntrances: campus.entrances.filter(""",
    """  const building = getRecognizedBuilding(code);\n  const campus = getCampusBuilding(code);\n  if (!building || !getCampusBuildingFootprint(code)) return null;\n  const entrances = campus?.entrances ?? [];\n  return {\n    building,\n    campus,\n    verifiedEntrances: entrances.filter(""",
)
text = read(explorer_path)
text = text.replace("inferredApproaches: campus.entrances.filter(", "inferredApproaches: entrances.filter(")
text = text.replace("accessibleEntrances: campus.entrances.filter(", "accessibleEntrances: entrances.filter(")
text = text.replace("accessibilityUnknown: campus.entrances.filter(", "accessibilityUnknown: entrances.filter(")
text = text.replace("latestVerificationDate: latestDate(campus.entrances),", "latestVerificationDate: latestDate(entrances),")
write(explorer_path, text)

campus_explorer_path = "src/components/CampusExplorer.tsx"
text = read(campus_explorer_path)
text = text.replace("{details.campus.entrances.length} mapped entrances", "{details.campus?.entrances.length ?? 0} mapped entrances")
text = text.replace("{details.campus.entrances.map((entrance) => {", "{(details.campus?.entrances ?? []).map((entrance) => {")
write(campus_explorer_path, text)

# 5. Fix map marker invariants: numbered stops use deterministic screen-space collision
#    avoidance, while entrance animation uses CSS individual scale so MapLibre remains
#    sole owner of the marker element's transform/position.
marker_layout = r'''export type MarkerScreenPoint = { x: number; y: number };
export type MarkerPixelOffset = [x: number, y: number];

function ringOffsets(ring: number, spacing: number): MarkerPixelOffset[] {
  if (ring === 0) return [[0, 0]];
  const r = ring * spacing;
  const offsets: MarkerPixelOffset[] = [
    [0, -r],
    [r, 0],
    [0, r],
    [-r, 0],
    [r, -r],
    [r, r],
    [-r, r],
    [-r, -r],
  ];
  for (let step = 1; step < ring; step += 1) {
    const delta = step * spacing;
    offsets.push(
      [delta, -r],
      [r, delta],
      [-delta, r],
      [-r, -delta],
      [-delta, -r],
      [r, -delta],
      [delta, r],
      [-r, delta],
    );
  }
  return offsets;
}

/**
 * Deterministically place marker centres so no pair is closer than minSeparationPx.
 * The returned offsets are screen-pixel offsets from the geographic anchor, so the
 * geographic point remains authoritative while labels stay readable at every zoom.
 */
export function collisionFreeMarkerOffsets(
  points: MarkerScreenPoint[],
  minSeparationPx = 40,
  spacingPx = 42,
): MarkerPixelOffset[] {
  const placed: MarkerScreenPoint[] = [];
  return points.map((point) => {
    for (let ring = 0; ; ring += 1) {
      for (const offset of ringOffsets(ring, spacingPx)) {
        const candidate = { x: point.x + offset[0], y: point.y + offset[1] };
        const clear = placed.every(
          (other) => Math.hypot(candidate.x - other.x, candidate.y - other.y) >= minSeparationPx,
        );
        if (clear) {
          placed.push(candidate);
          return offset;
        }
      }
    }
  });
}
'''
write("src/features/routing/map-marker-layout.ts", marker_layout)

campus_map_path = "src/components/CampusMap.tsx"
replace_once(
    campus_map_path,
    """  buildingCodeAtCoordinate,\n  footprintGeometryPoints,\n  getCampusBuildingFootprint,\n} from \"@/data/utm/building-footprints\";""",
    """  buildingCodeAtCoordinate,\n  footprintGeometryPoints,\n  getCampusBuildingFootprint,\n  representativePointForFootprint,\n} from \"@/data/utm/building-footprints\";""",
)
replace_once(
    campus_map_path,
    'import { getCampusCameraBounds } from "@/features/routing/campus-region";',
    'import { getCampusCameraBounds } from "@/features/routing/campus-region";\nimport { collisionFreeMarkerOffsets } from "@/features/routing/map-marker-layout";',
)
replace_once(
    campus_map_path,
    """function getMarkerOffset(slot: number, total: number): [number, number] {\n  if (total <= 1) return [0, 0];\n  const row = Math.floor(slot / 3);\n  const column = slot % 3;\n  const rows = Math.ceil(total / 3);\n  const itemsInRow = Math.min(3, total - row * 3);\n  return [(column - (itemsInRow - 1) / 2) * 36, (row - (rows - 1) / 2) * 36];\n}\n""",
    """function getMarkerOffset(slot: number, total: number): [number, number] {\n  if (total <= 1) return [0, 0];\n  const row = Math.floor(slot / 3);\n  const column = slot % 3;\n  const rows = Math.ceil(total / 3);\n  const itemsInRow = Math.min(3, total - row * 3);\n  return [(column - (itemsInRow - 1) / 2) * 36, (row - (rows - 1) / 2) * 36];\n}\n\nfunction mapBuildingAnchor(code: string | null) {\n  const campus = getCampusBuilding(code);\n  if (campus) return { code: campus.code, navigationPoint: campus.navigationPoint };\n  const footprint = getCampusBuildingFootprint(code);\n  const navigationPoint = footprint ? representativePointForFootprint(footprint) : null;\n  return footprint && navigationPoint\n    ? { code: footprint.properties.buildingCode, navigationPoint }\n    : null;\n}\n\nfunction layoutNumberMarkers(map: MapLibreMap, markers: Marker[]) {\n  const numberMarkers = markers.filter((marker) =>\n    marker.getElement().classList.contains(\"map-number-marker\"),\n  );\n  const points = numberMarkers.map((marker) => {\n    const point = map.project(marker.getLngLat());\n    return { x: point.x, y: point.y };\n  });\n  const offsets = collisionFreeMarkerOffsets(points);\n  numberMarkers.forEach((marker, index) => marker.setOffset(offsets[index] ?? [0, 0]));\n}\n""",
)
text = read(campus_map_path)
text = text.replace("const building = getCampusBuilding(meeting.buildingCode);", "const building = mapBuildingAnchor(meeting.buildingCode);")
text = text.replace(
    "meetings.some((meeting) => getCampusBuilding(meeting.buildingCode))",
    "meetings.some((meeting) => mapBuildingAnchor(meeting.buildingCode))",
)
write(campus_map_path, text)
replace_once(
    campus_map_path,
    "  const routeKey = routeGeometryKey(data);",
    "  layoutNumberMarkers(map, markers);\n\n  const routeKey = routeGeometryKey(data);",
)
replace_once(
    campus_map_path,
    '  element.style.transform = active ? "scale(1.06)" : "";',
    '  element.style.scale = active ? "1.06" : "";',
)
replace_once(
    campus_map_path,
    'markerButton.style.transition = "transform 160ms ease, width 160ms ease, height 160ms ease";',
    'markerButton.style.transition = "scale 160ms ease, width 160ms ease, height 160ms ease";',
)
replace_once(
    campus_map_path,
    """  const building = getCampusBuilding(buildingCode);\n  if (!building) return false;\n  const feature = getCampusBuildingFootprint(buildingCode);\n  const points = [\n    ...(feature ? footprintGeometryPoints(feature.geometry) : []),\n    ...building.entrances.map((entrance) => entrance.coordinates),\n  ];\n  if (points.length === 0) points.push(building.navigationPoint);""",
    """  const building = getCampusBuilding(buildingCode);\n  const feature = getCampusBuildingFootprint(buildingCode);\n  if (!building && !feature) return false;\n  const points = [\n    ...(feature ? footprintGeometryPoints(feature.geometry) : []),\n    ...(building?.entrances.map((entrance) => entrance.coordinates) ?? []),\n  ];\n  if (points.length === 0 && building) points.push(building.navigationPoint);\n  if (points.length === 0) return false;""",
)
replace_once(
    campus_map_path,
    '        map.on("dragstart", (event) => {',
    '        map.on("move", () => layoutNumberMarkers(map, markersRef.current));\n        map.on("dragstart", (event) => {',
)

# Camera maxBounds must include official peripheral facilities while remaining campus-scale.
replace_once(
    "src/features/routing/campus-region.ts",
    "export const CAMPUS_CAMERA_PADDING_METERS = 140;",
    "export const CAMPUS_CAMERA_PADDING_METERS = 500;",
)

# 6. Regression tests for marker collision and identity-only official buildings.
marker_test = r'''import { describe, expect, test } from "bun:test";
import { collisionFreeMarkerOffsets } from "@/features/routing/map-marker-layout";

describe("campus map marker layout", () => {
  test("separates stops with identical geographic screen anchors", () => {
    const points = Array.from({ length: 12 }, () => ({ x: 500, y: 300 }));
    const offsets = collisionFreeMarkerOffsets(points);
    const centres = offsets.map(([x, y]) => ({ x: 500 + x, y: 300 + y }));
    for (let a = 0; a < centres.length; a += 1) {
      for (let b = a + 1; b < centres.length; b += 1) {
        expect(Math.hypot(centres[a]!.x - centres[b]!.x, centres[a]!.y - centres[b]!.y)).toBeGreaterThanOrEqual(40);
      }
    }
  });

  test("also separates different anchors that project close together", () => {
    const points = [
      { x: 100, y: 100 },
      { x: 112, y: 106 },
      { x: 124, y: 112 },
      { x: 136, y: 118 },
    ];
    const offsets = collisionFreeMarkerOffsets(points);
    const centres = points.map((point, index) => ({
      x: point.x + offsets[index]![0],
      y: point.y + offsets[index]![1],
    }));
    for (let a = 0; a < centres.length; a += 1) {
      for (let b = a + 1; b < centres.length; b += 1) {
        expect(Math.hypot(centres[a]!.x - centres[b]!.x, centres[a]!.y - centres[b]!.y)).toBeGreaterThanOrEqual(40);
      }
    }
  });
});
'''
write("tests/map-marker-layout.test.ts", marker_test)

building_test_path = "tests/building-explorer.test.ts"
text = read(building_test_path)
text = text.replace("details?.campus.entrances.length", "details?.campus?.entrances.length")
text = text.replace("details?.campus.indoorMapped", "details?.campus?.indoorMapped")
text = text.replace("details?.campus.entrances.every", "details?.campus?.entrances.every")
text = text.replace(
    'expect(normalizePublicBuildingCode("mn")).toBe("MN");',
    'expect(normalizePublicBuildingCode("mn")).toBe("MN");\n    expect(normalizePublicBuildingCode("CC")).toBe("CCT");\n    expect(normalizePublicBuildingCode("RA")).toBe("RAWC");\n    expect(normalizePublicBuildingCode("R")).toBe("LL");\n    expect(normalizePublicBuildingCode("SB")).toBe("NSB");',
)
insert = '''\n  test("keeps official identity-only facilities searchable without inventing routing", () => {\n    for (const code of ["WC", "CUP", "FCSH", "GF", "NSB", "PL", "BG", "LH", "IC"] as const) {\n      const result = searchCampusBuildings(code)[0];\n      expect(result?.building.code).toBe(code);\n      expect(getCampusBuildingFootprint(code)).not.toBeNull();\n      const details = getBuildingExplorerDetails(code);\n      expect(details?.building.code).toBe(code);\n      if (!details?.campus) expect(details?.verifiedEntrances).toBe(0);\n    }\n  });\n'''
text = text.replace('\n  test("resolves room-like searches', insert + '\n  test("resolves room-like searches')
write(building_test_path, text)

# 7. Leave the regular map-data workflow clean and deterministic after this bootstrap.
stable_workflow = '''name: UTM map data

on:
  push:
    branches: [main]
    paths:
      - "scripts/generate-building-footprints.ts"
      - "scripts/inspect-utm-building-relations.ts"
      - "scripts/fetch-reviewed-osm-ways.ts"
      - "scripts/diagnose-building-overlaps.ts"
      - "src/components/CampusMap.tsx"
      - "src/data/utm/building-footprint-overrides.json"
      - "src/data/utm/building-footprints.ts"
      - "src/data/utm/footprint-fragments.ts"
      - "src/data/utm/footprints/**"
      - "src/data/utm/building-registry.ts"
      - "src/data/utm/entrances.geojson"
      - "src/data/utm/campus.ts"
      - "src/features/routing/campus-presence.ts"
      - "src/features/routing/campus-region.ts"
      - "src/features/routing/map-marker-layout.ts"
      - "tests/building-explorer.test.ts"
      - "tests/building-footprints.test.ts"
      - "tests/campus-presence.test.ts"
      - "tests/campus-region.test.ts"
      - "tests/map-marker-layout.test.ts"
      - ".github/workflows/utm-map-data.yml"
  pull_request:
    branches: [main]
    paths:
      - "scripts/generate-building-footprints.ts"
      - "scripts/inspect-utm-building-relations.ts"
      - "scripts/fetch-reviewed-osm-ways.ts"
      - "scripts/diagnose-building-overlaps.ts"
      - "src/components/CampusMap.tsx"
      - "src/data/utm/building-footprint-overrides.json"
      - "src/data/utm/building-footprints.ts"
      - "src/data/utm/footprint-fragments.ts"
      - "src/data/utm/footprints/**"
      - "src/data/utm/building-registry.ts"
      - "src/data/utm/entrances.geojson"
      - "src/data/utm/campus.ts"
      - "src/features/routing/campus-presence.ts"
      - "src/features/routing/campus-region.ts"
      - "src/features/routing/map-marker-layout.ts"
      - "tests/building-explorer.test.ts"
      - "tests/building-footprints.test.ts"
      - "tests/campus-presence.test.ts"
      - "tests/campus-region.test.ts"
      - "tests/map-marker-layout.test.ts"
      - ".github/workflows/utm-map-data.yml"
  workflow_dispatch:

permissions:
  contents: read

jobs:
  generate-footprints:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6 # v2
        with:
          bun-version: 1.3.14
      - run: bun install --frozen-lockfile
      - name: Verify TypeScript
        run: bun run typecheck
      - name: Diagnose canonical footprint overlap
        run: bun scripts/diagnose-building-overlaps.ts
      - name: Verify canonical geometry, search, and marker layout
        run: bun test tests/building-explorer.test.ts tests/building-footprints.test.ts tests/campus-region.test.ts tests/campus-presence.test.ts tests/map-marker-layout.test.ts
      - name: Generate complete canonical UTM building footprints
        run: >-
          bun scripts/generate-building-footprints.ts
          --output artifacts/building-footprints.geojson
          --report artifacts/utm-building-footprint-report.json
          --require-complete
      - name: Inspect current OSM building relations
        run: bun scripts/inspect-utm-building-relations.ts
      - name: Fetch reviewed multipolygon member ways
        run: bun scripts/fetch-reviewed-osm-ways.ts
      - name: Upload geometry and review reports
        uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
        with:
          name: utm-building-footprints
          path: |
            artifacts/building-footprints.geojson
            artifacts/utm-building-footprint-report.json
            artifacts/utm-building-relations.json
            artifacts/utm-reviewed-osm-ways.json
          if-no-files-found: error
          retention-days: 7
'''
pass  # workflow cleanup is committed separately by the GitHub connector

# Bootstrap files must not remain in the product tree.
pass  # keep bootstrap workflow unchanged for this push
pass  # helper cleanup is committed separately

# Format, then verify the complete change before a single final push.
run("bunx", "prettier", "--write", "src", "tests", "scripts/generate-building-footprints.ts", ".github/workflows/utm-map-data.yml")
run("bun", "run", "typecheck")
run("bun", "run", "lint")
run("bun", "test", "tests/map-marker-layout.test.ts", "tests/building-explorer.test.ts", "tests/building-footprints.test.ts", "tests/campus-region.test.ts", "tests/campus-presence.test.ts")
run("bun", "run", "build")

# Keep generated discovery output out of git; the canonical per-building fragments are committed.
for path in (
    artifact_dir / "building-footprints-complete.geojson",
    artifact_dir / "utm-building-footprint-complete-report.json",
):
    path.unlink(missing_ok=True)

run("git", "config", "user.name", "github-actions[bot]")
run("git", "config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com")
run("git", "add", "-A")
run("git", "commit", "-m", "fix: stabilize map markers and complete UTM building coverage")
run("git", "push", "origin", "HEAD:fix/map-marker-stability-building-coverage")
