import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const path = resolve(process.cwd(), "src/components/CampusMap.tsx");
let source = await readFile(path, "utf8");

function replaceOnce(before: string, after: string) {
  const index = source.indexOf(before);
  if (index < 0) throw new Error(`CampusMap codemod could not find:\n${before.slice(0, 160)}`);
  if (source.indexOf(before, index + before.length) >= 0) {
    throw new Error(`CampusMap codemod expected one match for:\n${before.slice(0, 160)}`);
  }
  source = `${source.slice(0, index)}${after}${source.slice(index + before.length)}`;
}

function replaceRange(start: string, end: string, replacement: string) {
  const startIndex = source.indexOf(start);
  if (startIndex < 0) throw new Error(`CampusMap codemod could not find start marker: ${start}`);
  const endIndex = source.indexOf(end, startIndex);
  if (endIndex < 0) throw new Error(`CampusMap codemod could not find end marker: ${end}`);
  source = `${source.slice(0, startIndex)}${replacement}${source.slice(endIndex)}`;
}

replaceOnce(
  'import type { GeoJSONSource, Map as MapLibreMap, MapGeoJSONFeature, Marker } from "maplibre-gl";',
  'import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl";',
);
replaceOnce(
  'import { UTM_BUILDINGS } from "@/data/utm/building-registry";\n',
  'import {\n  buildingCodeAtCoordinate,\n  footprintGeometryPoints,\n  getCampusBuildingFootprint,\n} from "@/data/utm/building-footprints";\nimport { getCampusCameraBounds } from "@/features/routing/campus-region";\n',
);
replaceOnce(
  '// Only clicks in empty map space get a small forgiving hit target. Hover never uses proximity.\nconst BUILDING_NEARBY_TAP_RADIUS_PX = 28;\n// Entrance coordinates live on/near real building edges. This tiny geographic tolerance is used\n// only to associate an unnamed rendered polygon with one canonical mapped building.\nconst BUILDING_FEATURE_MATCH_MAX_DISTANCE = 0.00022;\n',
  '',
);
replaceRange('const BUILDING_CODE_BY_LABEL = new Map(', 'function mapAccentColor(theme: MapTheme)', '');
replaceRange(
  'function featureBuildingCode(feature: MapGeoJSONFeature): string | null {',
  'function getMarkerOffset(slot: number, total: number): [number, number] {',
  `function syncBuildingHighlight(\n  map: MapLibreMap,\n  buildingCode: string | null,\n  kind: "hover" | "selected",\n) {\n  const sourceId = kind === "selected" ? BUILDING_SELECTED_SOURCE_ID : BUILDING_HOVER_SOURCE_ID;\n  const fillLayerId =\n    kind === "selected" ? BUILDING_SELECTED_FILL_LAYER_ID : BUILDING_HOVER_FILL_LAYER_ID;\n  const lineLayerId =\n    kind === "selected" ? BUILDING_SELECTED_LINE_LAYER_ID : BUILDING_HOVER_LINE_LAYER_ID;\n  const source = map.getSource(sourceId) as GeoJSONSource | undefined;\n  if (!source) return;\n\n  const feature = buildingCode ? getCampusBuildingFootprint(buildingCode) : null;\n  source.setData(\n    feature ? { type: "FeatureCollection", features: [feature] } : emptyFeatureCollection(),\n  );\n\n  const visible = Boolean(feature);\n  if (map.getLayer(fillLayerId)) {\n    map.setPaintProperty(\n      fillLayerId,\n      "fill-opacity",\n      visible ? (kind === "selected" ? 0.36 : 0.16) : 0,\n    );\n  }\n  if (map.getLayer(lineLayerId)) {\n    map.setPaintProperty(\n      lineLayerId,\n      "line-opacity",\n      visible ? (kind === "selected" ? 1 : 0.7) : 0,\n    );\n  }\n}\n\n`,
);
replaceRange(
  'function geometryPoints(geometry: MapGeoJSONFeature["geometry"]): [number, number][] {',
  'function focusKey(buildingCode: string, padding: MapFocusPadding) {',
  '',
);
replaceOnce(
  '  const feature = findBuildingFeature(map, buildingCode);\n  const points = [\n    ...(feature ? geometryPoints(feature.geometry) : []),\n    ...building.entrances.map((entrance) => entrance.coordinates),\n  ];',
  '  const feature = getCampusBuildingFootprint(buildingCode);\n  const points = [\n    ...(feature ? footprintGeometryPoints(feature.geometry) : []),\n    ...building.entrances.map((entrance) => entrance.coordinates),\n  ];',
);
replaceOnce(
  '    maxZoom: 17.65,\n    duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 650,',
  '    maxZoom: 18,\n    duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 800,',
);
replaceOnce(
  `function showCampusOverview(map: MapLibreMap) {\n  map.easeTo({\n    center: MAP_CONFIG.campusCenter,\n    zoom: MAP_CONFIG.initialZoom,\n    duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 500,\n  });\n}`,
  `function showCampusOverview(map: MapLibreMap) {\n  map.fitBounds(getCampusCameraBounds(UTM_ROUTING_GRAPH), {\n    padding: FIT_BOUNDS_PADDING_PX,\n    maxZoom: MAP_CONFIG.initialZoom,\n    duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 650,\n  });\n}`,
);
replaceOnce(
  `        const initialTheme = themeRef.current;\n        const map = new maplibregl.Map({\n          container: containerRef.current,\n          style: MAP_CONFIG.styleUrls[initialTheme],\n          center: MAP_CONFIG.campusCenter,\n          zoom: MAP_CONFIG.initialZoom,\n          attributionControl: false,\n        });`,
  `        const initialTheme = themeRef.current;\n        const campusCameraBounds = getCampusCameraBounds(UTM_ROUTING_GRAPH);\n        const map = new maplibregl.Map({\n          container: containerRef.current,\n          style: MAP_CONFIG.styleUrls[initialTheme],\n          center: MAP_CONFIG.campusCenter,\n          zoom: MAP_CONFIG.initialZoom,\n          minZoom: 14.5,\n          maxZoom: 20,\n          maxPitch: 70,\n          pitch: 30,\n          bearing: -8,\n          maxBounds: campusCameraBounds,\n          renderWorldCopies: false,\n          attributionControl: false,\n        });`,
);
replaceOnce(
  '        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");',
  '        map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");',
);
replaceRange(
  '        let mapHoveredBuildingCode: string | null = null;\n        map.on("mousemove", (event) => {',
  '        map.on("error", () => {',
  `        let mapHoveredBuildingCode: string | null = null;\n        map.on("mousemove", (event) => {\n          if (!map.isStyleLoaded()) return;\n          const nextCode = buildingCodeAtCoordinate([event.lngLat.lng, event.lngLat.lat]);\n          if (nextCode === mapHoveredBuildingCode) return;\n          mapHoveredBuildingCode = nextCode;\n          map.getCanvas().style.cursor = nextCode ? "pointer" : "";\n          latestData.current.onHoverBuilding(nextCode);\n        });\n        map.getCanvas().addEventListener("mouseleave", () => {\n          mapHoveredBuildingCode = null;\n          map.getCanvas().style.cursor = "";\n          latestData.current.onHoverBuilding(null);\n        });\n        map.on("click", (event) => {\n          if (!map.isStyleLoaded()) return;\n          if (\n            map.getLayer("day-routes-solid") &&\n            map.queryRenderedFeatures(event.point, { layers: ["day-routes-solid"] }).length > 0\n          ) {\n            return;\n          }\n          const code = buildingCodeAtCoordinate([event.lngLat.lng, event.lngLat.lat]);\n          if (code) latestData.current.onSelectBuilding(code);\n        });\n`,
);

if (source.includes("canonicalCodeForFeature") || source.includes("nearestCampusBuildingCode")) {
  throw new Error("CampusMap codemod left a proximity-based building identity helper behind.");
}
if (source.includes("BUILDING_FEATURE_MATCH_MAX_DISTANCE") || source.includes("BUILDING_NEARBY_TAP_RADIUS_PX")) {
  throw new Error("CampusMap codemod left a proximity threshold behind.");
}

await writeFile(path, source, "utf8");
console.log("Applied canonical UTM footprint selection and campus camera constraints to CampusMap.tsx.");
