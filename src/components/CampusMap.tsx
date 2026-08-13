import { useEffect, useRef, useState, type MutableRefObject } from "react";
import type { GeoJSONSource, Map as MapLibreMap, MapGeoJSONFeature, Marker } from "maplibre-gl";
import mapLibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import { MAP_CONFIG } from "@/config/map";
import { CAMPUS_BUILDINGS, getCampusBuilding } from "@/data/utm/campus";
import { UTM_BUILDINGS } from "@/data/utm/building-registry";
import {
  resolveMapAnchor,
  type MapAnchorSegment,
  type MapCoordinate,
} from "@/features/routing/map-anchors";
import { isResidenceMeeting } from "@/features/routing/residence";
import type { TransitionRoute } from "@/features/routing/types";
import type { Meeting } from "@/lib/timetable-types";

type MapSegment = {
  id: string;
  from: Meeting;
  to: Meeting;
  route: TransitionRoute;
};

type MapHome = { buildingCode: string; label: string };

export type CampusMapProps = {
  meetings: Meeting[];
  segments: MapSegment[];
  selectedMeetingId: string | null;
  selectedSegmentId: string | null;
  onSelectMeeting: (id: string) => void;
  onSelectSegment: (id: string) => void;
  hoveredBuildingCode: string | null;
  onHoverBuilding: (code: string | null) => void;
  selectedBuildingCode: string | null;
  onSelectBuilding: (code: string) => void;
  home: MapHome | null;
  className?: string;
};

type MapData = Omit<CampusMapProps, "className">;

type MapLibreModule = typeof import("maplibre-gl");
type MapStatus = "loading" | "ready" | "error" | "unsupported";
type MapTheme = keyof typeof MAP_CONFIG.styleUrls;
const MAP_LOAD_TIMEOUT_MS = 12_000;
const FIT_BOUNDS_PADDING_PX = 56;
const FIT_BOUNDS_MAX_ZOOM = 17;
const ROUTE_DRAW_DURATION_MS = 1_180;
const BUILDING_HOVER_DURATION_MS = 200;
const MAP_BUILDING_HIT_RADIUS_PX = 160;
const BUILDING_HOVER_SOURCE_ID = "gapwise-building-hover";
const BUILDING_HOVER_FILL_LAYER_ID = "gapwise-building-hover-fill";
const BUILDING_HOVER_LINE_LAYER_ID = "gapwise-building-hover-line";
const BUILDING_SELECTED_SOURCE_ID = "gapwise-building-selected";
const BUILDING_SELECTED_FILL_LAYER_ID = "gapwise-building-selected-fill";
const BUILDING_SELECTED_LINE_LAYER_ID = "gapwise-building-selected-line";

const BUILDING_CODE_BY_LABEL = new Map(
  UTM_BUILDINGS.flatMap((building) =>
    [building.code, building.name, ...(building.aliases ?? [])].map(
      (label) => [normalizeBuildingLabel(label), building.code] as const,
    ),
  ),
);

function normalizeBuildingLabel(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function mapAccentColor(theme: MapTheme) {
  return theme === "dark" ? "#60a5fa" : "#146bb8";
}

function emptyFeatureCollection() {
  return { type: "FeatureCollection" as const, features: [] };
}

function supportsWebGl2(): boolean {
  try {
    return Boolean(document.createElement("canvas").getContext("webgl2"));
  } catch {
    return false;
  }
}

function getDocumentTheme(): MapTheme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function partialRouteCoordinates(coordinates: [number, number][], progress: number) {
  if (progress >= 1 || coordinates.length < 2) return coordinates;
  const distances = coordinates.slice(1).map((coordinate, index) => {
    const previous = coordinates[index]!;
    return Math.hypot(coordinate[0] - previous[0], coordinate[1] - previous[1]);
  });
  const targetDistance = distances.reduce((total, distance) => total + distance, 0) * progress;
  const visible: [number, number][] = [coordinates[0]!];
  let coveredDistance = 0;

  for (let index = 0; index < distances.length; index += 1) {
    const distance = distances[index]!;
    const next = coordinates[index + 1]!;
    if (coveredDistance + distance <= targetDistance) {
      visible.push(next);
      coveredDistance += distance;
      continue;
    }

    const previous = coordinates[index]!;
    const remaining = Math.max(0, targetDistance - coveredDistance);
    const ratio = distance === 0 ? 0 : remaining / distance;
    visible.push([
      previous[0] + (next[0] - previous[0]) * ratio,
      previous[1] + (next[1] - previous[1]) * ratio,
    ]);
    break;
  }

  if (visible.length === 1) visible.push(visible[0]!);
  return visible;
}

function routeFeatureCollection(data: MapData, progress = 1) {
  return {
    type: "FeatureCollection" as const,
    features: data.segments
      .filter((segment) => segment.route.displayCoordinates.length >= 2)
      .map((segment) => ({
        type: "Feature" as const,
        properties: {
          id: segment.id,
          selected: segment.id === data.selectedSegmentId,
        },
        geometry: {
          type: "LineString" as const,
          coordinates: partialRouteCoordinates(segment.route.displayCoordinates, progress),
        },
      })),
  };
}

function routeGeometryKey(data: MapData) {
  return data.segments
    .map((segment) =>
      [
        segment.id,
        ...segment.route.displayCoordinates.map((coordinate) => coordinate.join(",")),
      ].join(":"),
    )
    .join("|");
}

function animateRouteDraw(
  map: MapLibreMap,
  source: GeoJSONSource,
  key: string,
  lastRouteKeyRef: MutableRefObject<string>,
  animationFrameRef: MutableRefObject<number | null>,
  latestDataRef: MutableRefObject<MapData>,
) {
  lastRouteKeyRef.current = key;

  if (animationFrameRef.current !== null) {
    cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
  }
  if (!key || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    source.setData(routeFeatureCollection(latestDataRef.current));
    return;
  }

  source.setData(routeFeatureCollection(latestDataRef.current, 0));
  const startedAt = performance.now();
  const drawFrame = (now: number) => {
    if (map.getSource("day-routes") !== source || routeGeometryKey(latestDataRef.current) !== key) {
      animationFrameRef.current = null;
      return;
    }
    const elapsed = Math.min(1, (now - startedAt) / ROUTE_DRAW_DURATION_MS);
    const eased = 1 - (1 - elapsed) ** 3;
    source.setData(routeFeatureCollection(latestDataRef.current, eased));

    if (elapsed < 1) {
      animationFrameRef.current = requestAnimationFrame(drawFrame);
    } else {
      animationFrameRef.current = null;
    }
  };
  animationFrameRef.current = requestAnimationFrame(drawFrame);
}

function anchorSegments(data: MapData): MapAnchorSegment[] {
  return data.segments.map((segment) => ({
    id: segment.id,
    fromId: segment.from.id,
    toId: segment.to.id,
    coordinates: segment.route.displayCoordinates,
  }));
}

function residenceStopIds(data: MapData): string[] {
  const ids = new Set<string>();
  for (const segment of data.segments) {
    if (isResidenceMeeting(segment.from)) ids.add(segment.from.id);
    if (isResidenceMeeting(segment.to)) ids.add(segment.to.id);
  }
  return [...ids];
}

function addRouteLayers(map: MapLibreMap, theme: MapTheme) {
  const casingColor = theme === "dark" ? "#05070a" : "#f8fafc";
  const routeColor = mapAccentColor(theme);
  const inactiveRouteColor = theme === "dark" ? "#57728d" : "#6d879f";

  map.addLayer({
    id: "day-routes-casing",
    type: "line",
    source: "day-routes",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": casingColor,
      "line-width": ["case", ["==", ["get", "selected"], true], 7, 5],
      "line-opacity": ["case", ["==", ["get", "selected"], true], 0.82, 0.42],
    },
  });
  map.addLayer({
    id: "day-routes-solid",
    type: "line",
    source: "day-routes",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": ["case", ["==", ["get", "selected"], true], routeColor, inactiveRouteColor],
      "line-width": ["case", ["==", ["get", "selected"], true], 4, 2.5],
      "line-opacity": ["case", ["==", ["get", "selected"], true], 1, 0.68],
    },
  });
}

function buildingLayerIds(map: MapLibreMap) {
  return (map.getStyle().layers ?? [])
    .filter(
      (layer) =>
        "source-layer" in layer &&
        layer["source-layer"] === "building" &&
        (layer.type === "fill" || layer.type === "fill-extrusion"),
    )
    .map((layer) => layer.id);
}

function styleCampusBuildings(map: MapLibreMap, theme: MapTheme) {
  const fillColor = theme === "dark" ? "#202a35" : "#dde5eb";
  const outlineColor = theme === "dark" ? "#43566a" : "#9fb0bd";
  const layers = map.getStyle().layers ?? [];
  let styledBuildingLayer = false;

  for (const layer of layers) {
    if (!("source-layer" in layer) || layer["source-layer"] !== "building") continue;
    if (layer.type === "fill") {
      map.setLayoutProperty(layer.id, "visibility", "visible");
      map.setPaintProperty(layer.id, "fill-color", fillColor);
      map.setPaintProperty(layer.id, "fill-outline-color", outlineColor);
      map.setPaintProperty(layer.id, "fill-opacity", theme === "dark" ? 0.86 : 0.88);
      styledBuildingLayer = true;
    }
    if (layer.type === "fill-extrusion") {
      map.setLayoutProperty(layer.id, "visibility", "visible");
      map.setPaintProperty(layer.id, "fill-extrusion-color", fillColor);
      map.setPaintProperty(layer.id, "fill-extrusion-opacity", theme === "dark" ? 0.92 : 0.9);
      styledBuildingLayer = true;
    }
  }

  if (!map.getSource("openmaptiles")) return;

  const firstSymbolLayerId = layers.find((layer) => layer.type === "symbol")?.id;

  if (theme === "dark") {
    if (!map.getLayer("gapwise-campus-buildings-3d")) {
      map.addLayer(
        {
          id: "gapwise-campus-buildings-3d",
          type: "fill-extrusion",
          source: "openmaptiles",
          "source-layer": "building",
          minzoom: 13,
          paint: {
            "fill-extrusion-color": fillColor,
            "fill-extrusion-height": ["coalesce", ["get", "render_height"], ["get", "height"], 8],
            "fill-extrusion-base": [
              "coalesce",
              ["get", "render_min_height"],
              ["get", "min_height"],
              0,
            ],
            "fill-extrusion-opacity": 0.92,
            "fill-extrusion-vertical-gradient": true,
          },
        },
        firstSymbolLayerId,
      );
    }
    return;
  }

  if (styledBuildingLayer) return;

  map.addLayer(
    {
      id: "gapwise-campus-buildings",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "building",
      minzoom: 13,
      paint: {
        "fill-color": fillColor,
        "fill-outline-color": outlineColor,
        "fill-opacity": 0.88,
      },
    },
    firstSymbolLayerId,
  );
}

function ensureBuildingHighlightLayers(map: MapLibreMap, theme: MapTheme) {
  const firstSymbolLayerId = (map.getStyle().layers ?? []).find(
    (layer) => layer.type === "symbol",
  )?.id;
  const accentColor = mapAccentColor(theme);

  function ensureLayers({
    sourceId,
    fillLayerId,
    lineLayerId,
    lineWidth,
  }: {
    sourceId: string;
    fillLayerId: string;
    lineLayerId: string;
    lineWidth: number;
  }) {
    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, { type: "geojson", data: emptyFeatureCollection() });
    }
    if (!map.getLayer(fillLayerId)) {
      map.addLayer(
        {
          id: fillLayerId,
          type: "fill",
          source: sourceId,
          paint: {
            "fill-color": accentColor,
            "fill-opacity": 0,
            "fill-opacity-transition": { duration: BUILDING_HOVER_DURATION_MS, delay: 0 },
          },
        },
        firstSymbolLayerId,
      );
    }
    if (!map.getLayer(lineLayerId)) {
      map.addLayer(
        {
          id: lineLayerId,
          type: "line",
          source: sourceId,
          paint: {
            "line-color": accentColor,
            "line-width": lineWidth,
            "line-opacity": 0,
            "line-opacity-transition": { duration: BUILDING_HOVER_DURATION_MS, delay: 0 },
          },
        },
        firstSymbolLayerId,
      );
    }
  }

  ensureLayers({
    sourceId: BUILDING_HOVER_SOURCE_ID,
    fillLayerId: BUILDING_HOVER_FILL_LAYER_ID,
    lineLayerId: BUILDING_HOVER_LINE_LAYER_ID,
    lineWidth: 1.75,
  });
  ensureLayers({
    sourceId: BUILDING_SELECTED_SOURCE_ID,
    fillLayerId: BUILDING_SELECTED_FILL_LAYER_ID,
    lineLayerId: BUILDING_SELECTED_LINE_LAYER_ID,
    lineWidth: 3.25,
  });
}

function featureBuildingCode(feature: MapGeoJSONFeature): string | null {
  const properties = feature.properties ?? {};
  const labels = [
    properties["ref"],
    properties["name"],
    properties["name_en"],
    properties["name:en"],
  ];

  for (const label of labels) {
    if (typeof label !== "string") continue;
    const code = BUILDING_CODE_BY_LABEL.get(normalizeBuildingLabel(label));
    if (code) return code;
  }
  return null;
}

function geometryDistanceSquared(geometry: MapGeoJSONFeature["geometry"], point: [number, number]) {
  let nearest = Number.POSITIVE_INFINITY;

  function visit(value: unknown) {
    if (!Array.isArray(value)) return;
    if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
      const x = value[0] - point[0];
      const y = value[1] - point[1];
      nearest = Math.min(nearest, x * x + y * y);
      return;
    }
    for (const child of value) visit(child);
  }

  if ("coordinates" in geometry) visit(geometry.coordinates);
  return nearest;
}

function findBuildingFeature(map: MapLibreMap, buildingCode: string) {
  const building = getCampusBuilding(buildingCode);
  const layers = buildingLayerIds(map);
  if (!building || layers.length === 0) return null;

  const point = map.project(building.navigationPoint);
  const candidates = map
    .queryRenderedFeatures(
      [
        [point.x - 64, point.y - 64],
        [point.x + 64, point.y + 64],
      ],
      { layers },
    )
    .filter(
      (feature) => feature.geometry.type === "Polygon" || feature.geometry.type === "MultiPolygon",
    );
  const namedMatch = candidates.find((feature) => featureBuildingCode(feature) === building.code);
  if (namedMatch) return namedMatch;

  return (
    candidates.reduce<MapGeoJSONFeature | null>((nearest, feature) => {
      if (!nearest) return feature;
      return geometryDistanceSquared(feature.geometry, building.navigationPoint) <
        geometryDistanceSquared(nearest.geometry, building.navigationPoint)
        ? feature
        : nearest;
    }, null) ?? null
  );
}

function syncBuildingHighlight(
  map: MapLibreMap,
  buildingCode: string | null,
  kind: "hover" | "selected",
) {
  const sourceId = kind === "selected" ? BUILDING_SELECTED_SOURCE_ID : BUILDING_HOVER_SOURCE_ID;
  const fillLayerId =
    kind === "selected" ? BUILDING_SELECTED_FILL_LAYER_ID : BUILDING_HOVER_FILL_LAYER_ID;
  const lineLayerId =
    kind === "selected" ? BUILDING_SELECTED_LINE_LAYER_ID : BUILDING_HOVER_LINE_LAYER_ID;
  const source = map.getSource(sourceId) as GeoJSONSource | undefined;
  if (!source) return;

  const feature = buildingCode ? findBuildingFeature(map, buildingCode) : null;
  if (feature) {
    source.setData({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { buildingCode },
          geometry: feature.geometry,
        },
      ],
    });
  }

  const visible = Boolean(feature);
  if (map.getLayer(fillLayerId)) {
    map.setPaintProperty(
      fillLayerId,
      "fill-opacity",
      visible ? (kind === "selected" ? 0.36 : 0.16) : 0,
    );
  }
  if (map.getLayer(lineLayerId)) {
    map.setPaintProperty(
      lineLayerId,
      "line-opacity",
      visible ? (kind === "selected" ? 1 : 0.7) : 0,
    );
  }
}

function nearestCampusBuildingCode(
  map: MapLibreMap,
  point: { x: number; y: number },
  radius = MAP_BUILDING_HIT_RADIUS_PX,
) {
  let nearestCode: string | null = null;
  let nearestDistance = radius ** 2;

  for (const building of CAMPUS_BUILDINGS) {
    const projected = map.project(building.navigationPoint);
    const distance = (projected.x - point.x) ** 2 + (projected.y - point.y) ** 2;
    if (distance >= nearestDistance) continue;
    nearestCode = building.code;
    nearestDistance = distance;
  }

  return nearestCode;
}

function getMarkerOffset(slot: number, total: number): [number, number] {
  if (total <= 1) return [0, 0];
  const row = Math.floor(slot / 3);
  const column = slot % 3;
  const rows = Math.ceil(total / 3);
  const itemsInRow = Math.min(3, total - row * 3);
  return [(column - (itemsInRow - 1) / 2) * 36, (row - (rows - 1) / 2) * 36];
}

function syncMapData(
  map: MapLibreMap,
  maplibregl: MapLibreModule,
  data: MapData,
  markers: Marker[],
  theme: MapTheme,
  lastRouteKeyRef: MutableRefObject<string>,
  routeAnimationFrameRef: MutableRefObject<number | null>,
  latestDataRef: MutableRefObject<MapData>,
) {
  for (const marker of markers) marker.remove();
  markers.length = 0;

  const routes = anchorSegments(data);
  const buildingTotals = new Map<string, number>();
  for (const meeting of data.meetings) {
    const building = getCampusBuilding(meeting.buildingCode);
    if (!building) continue;
    buildingTotals.set(building.code, (buildingTotals.get(building.code) ?? 0) + 1);
  }
  const buildingSlots = new Map<string, number>();

  data.meetings.forEach((meeting, index) => {
    const building = getCampusBuilding(meeting.buildingCode);
    if (!building) return;
    const slot = buildingSlots.get(building.code) ?? 0;
    buildingSlots.set(building.code, slot + 1);
    const anchor = resolveMapAnchor(
      meeting.id,
      building.navigationPoint,
      routes,
      data.selectedSegmentId,
    );
    const offset =
      anchor.source === "fallback"
        ? getMarkerOffset(slot, buildingTotals.get(building.code) ?? 1)
        : ([0, 0] as [number, number]);
    const markerButton = document.createElement("button");
    markerButton.type = "button";
    markerButton.className = `map-number-marker${meeting.id === data.selectedMeetingId ? " is-selected" : ""}`;
    markerButton.textContent = String(index + 1);
    markerButton.title = `${meeting.courseCode} at ${building.code}`;
    markerButton.setAttribute("aria-label", `Select ${meeting.courseCode}, stop ${index + 1}`);
    markerButton.addEventListener(
      "click",
      (event) => {
        event.stopPropagation();
        data.onSelectMeeting(meeting.id);
      },
      { once: true },
    );
    markerButton.addEventListener("mouseenter", () => data.onHoverBuilding(building.code));
    markerButton.addEventListener("mouseleave", () => data.onHoverBuilding(null));
    markers.push(
      new maplibregl.Marker({ element: markerButton, offset })
        .setLngLat(anchor.coordinate)
        .addTo(map),
    );
  });

  if (data.home) {
    const homeBuilding = getCampusBuilding(data.home.buildingCode);
    if (homeBuilding) {
      const anchor = resolveMapAnchor(
        residenceStopIds(data),
        homeBuilding.navigationPoint,
        routes,
        data.selectedSegmentId,
      );
      const homeMarker = document.createElement("div");
      homeMarker.className = "map-home-marker";
      const homeIcon = document.createElement("span");
      homeIcon.textContent = "⌂";
      homeIcon.setAttribute("aria-hidden", "true");
      homeMarker.append(homeIcon);
      homeMarker.title = `Home · ${data.home.label}`;
      homeMarker.setAttribute("role", "img");
      homeMarker.setAttribute("aria-label", `Home at ${data.home.label}`);
      homeMarker.addEventListener("mouseenter", () => data.onHoverBuilding(homeBuilding.code));
      homeMarker.addEventListener("mouseleave", () => data.onHoverBuilding(null));
      markers.push(
        new maplibregl.Marker({ element: homeMarker }).setLngLat(anchor.coordinate).addTo(map),
      );
    }
  }

  const routeKey = routeGeometryKey(data);
  const routeChanged = routeKey !== lastRouteKeyRef.current;
  const shouldAnimate =
    routeChanged &&
    Boolean(routeKey) &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let source = map.getSource("day-routes") as GeoJSONSource | undefined;
  const sourceCreated = !source;
  if (!source) {
    map.addSource("day-routes", {
      type: "geojson",
      data: routeFeatureCollection(data, shouldAnimate ? 0 : 1),
    });
    addRouteLayers(map, theme);
    source = map.getSource("day-routes") as GeoJSONSource;
  }

  if (routeChanged) {
    animateRouteDraw(map, source, routeKey, lastRouteKeyRef, routeAnimationFrameRef, latestDataRef);
  } else if (sourceCreated || routeAnimationFrameRef.current === null) {
    source.setData(routeFeatureCollection(data));
  }
}

function collectBoundsPoints(data: MapData): [number, number][] {
  const points: [number, number][] = [];
  const routes = anchorSegments(data);
  for (const meeting of data.meetings) {
    const building = getCampusBuilding(meeting.buildingCode);
    if (building) {
      points.push(
        resolveMapAnchor(meeting.id, building.navigationPoint, routes, data.selectedSegmentId)
          .coordinate,
      );
    }
  }
  if (data.home) {
    const homeBuilding = getCampusBuilding(data.home.buildingCode);
    if (homeBuilding) {
      points.push(
        resolveMapAnchor(
          residenceStopIds(data),
          homeBuilding.navigationPoint,
          routes,
          data.selectedSegmentId,
        ).coordinate,
      );
    }
  }
  for (const segment of data.segments) {
    for (const coord of segment.route.displayCoordinates) {
      points.push(coord as MapCoordinate);
    }
  }
  return points;
}

function maybeFitBounds(
  map: MapLibreMap,
  maplibregl: MapLibreModule,
  data: MapData,
  lastFitKeyRef: MutableRefObject<string>,
  allowAutomaticFit = true,
) {
  if (!allowAutomaticFit) return false;
  const points = collectBoundsPoints(data);
  if (points.length === 0) return false;

  const key = points
    .map((point) => point.join(","))
    .sort()
    .join("|");
  if (key === lastFitKeyRef.current) return false;
  lastFitKeyRef.current = key;

  const [first, ...rest] = points;
  const bounds = rest.reduce(
    (acc, point) => acc.extend(point),
    new maplibregl.LngLatBounds(first, first),
  );
  map.fitBounds(bounds, {
    padding: FIT_BOUNDS_PADDING_PX,
    maxZoom: FIT_BOUNDS_MAX_ZOOM,
    duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 500,
  });
  return true;
}

function focusBuilding(map: MapLibreMap, buildingCode: string) {
  const building = getCampusBuilding(buildingCode);
  if (!building) return false;
  map.easeTo({
    center: building.navigationPoint,
    zoom: Math.max(map.getZoom(), 17.15),
    duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 550,
  });
  return true;
}

function showCampusOverview(map: MapLibreMap) {
  map.easeTo({
    center: MAP_CONFIG.campusCenter,
    zoom: MAP_CONFIG.initialZoom,
    duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 500,
  });
}

export function CampusMap({
  meetings,
  segments,
  selectedMeetingId,
  selectedSegmentId,
  onSelectMeeting,
  onSelectSegment,
  hoveredBuildingCode,
  onHoverBuilding,
  selectedBuildingCode,
  onSelectBuilding,
  home,
  className = "",
}: CampusMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const maplibreRef = useRef<MapLibreModule | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const lastFitKeyRef = useRef<string>("");
  const userHasMovedRef = useRef(false);
  const lastFocusedBuildingRef = useRef<string | null>(null);
  const lastRouteKeyRef = useRef<string>("");
  const routeAnimationFrameRef = useRef<number | null>(null);
  const appliedThemeRef = useRef<MapTheme | null>(null);
  const [mapTheme, setMapTheme] = useState<MapTheme>(getDocumentTheme);
  const themeRef = useRef<MapTheme>(mapTheme);
  const [status, setStatus] = useState<MapStatus>("loading");
  const [attempt, setAttempt] = useState(0);
  const latestData = useRef<MapData>({
    meetings,
    segments,
    selectedMeetingId,
    selectedSegmentId,
    onSelectMeeting,
    onSelectSegment,
    hoveredBuildingCode,
    onHoverBuilding,
    selectedBuildingCode,
    onSelectBuilding,
    home,
  });

  useEffect(() => {
    themeRef.current = mapTheme;
    latestData.current = {
      meetings,
      segments,
      selectedMeetingId,
      selectedSegmentId,
      onSelectMeeting,
      onSelectSegment,
      hoveredBuildingCode,
      onHoverBuilding,
      selectedBuildingCode,
      onSelectBuilding,
      home,
    };
  }, [
    home,
    mapTheme,
    meetings,
    hoveredBuildingCode,
    onHoverBuilding,
    onSelectMeeting,
    onSelectSegment,
    onSelectBuilding,
    selectedMeetingId,
    selectedSegmentId,
    selectedBuildingCode,
    segments,
  ]);

  useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => setMapTheme(root.classList.contains("dark") ? "dark" : "light");
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    if (!supportsWebGl2()) {
      setStatus("unsupported");
      return;
    }

    let disposed = false;
    let ready = false;
    let routeClickBound = false;
    let loadTimeout: ReturnType<typeof setTimeout> | undefined;
    setStatus("loading");
    lastFitKeyRef.current = "";
    lastRouteKeyRef.current = "";
    userHasMovedRef.current = false;
    lastFocusedBuildingRef.current = null;

    void import("maplibre-gl")
      .then((maplibregl) => {
        if (disposed || !containerRef.current) return;
        maplibregl.setWorkerUrl(mapLibreWorkerUrl);
        const initialTheme = themeRef.current;
        const map = new maplibregl.Map({
          container: containerRef.current,
          style: MAP_CONFIG.styleUrls[initialTheme],
          center: MAP_CONFIG.campusCenter,
          zoom: MAP_CONFIG.initialZoom,
          attributionControl: false,
        });
        appliedThemeRef.current = initialTheme;
        mapRef.current = map;
        maplibreRef.current = maplibregl;
        map.addControl(
          new maplibregl.AttributionControl({
            compact: true,
          }),
          "bottom-right",
        );
        const collapseAttribution = () => {
          const attribution =
            containerRef.current?.querySelector<HTMLElement>(".maplibregl-ctrl-attrib");
          attribution?.classList.remove("maplibregl-compact-show");
          attribution?.removeAttribute("open");
        };
        collapseAttribution();
        map.on("styledata", collapseAttribution);
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
        map.on("dragstart", (event) => {
          if (event.originalEvent) userHasMovedRef.current = true;
        });
        map.on("zoomstart", (event) => {
          if (event.originalEvent) userHasMovedRef.current = true;
        });
        let mapHoveredBuildingCode: string | null = null;
        map.on("mousemove", (event) => {
          if (!map.isStyleLoaded()) return;
          const layers = buildingLayerIds(map);
          const buildingFeatures =
            layers.length > 0
              ? map
                  .queryRenderedFeatures(event.point, { layers })
                  .filter(
                    (feature) =>
                      feature.geometry.type === "Polygon" ||
                      feature.geometry.type === "MultiPolygon",
                  )
              : [];
          const nextCode =
            buildingFeatures.map(featureBuildingCode).find((code) => code !== null) ??
            (buildingFeatures.length > 0 ? nearestCampusBuildingCode(map, event.point) : null);
          if (nextCode === mapHoveredBuildingCode) return;
          mapHoveredBuildingCode = nextCode;
          map.getCanvas().style.cursor = nextCode ? "pointer" : "";
          latestData.current.onHoverBuilding(nextCode);
        });
        map.getCanvas().addEventListener("mouseleave", () => {
          mapHoveredBuildingCode = null;
          map.getCanvas().style.cursor = "";
          latestData.current.onHoverBuilding(null);
        });
        map.on("click", (event) => {
          if (!map.isStyleLoaded()) return;
          if (
            map.getLayer("day-routes-solid") &&
            map.queryRenderedFeatures(event.point, { layers: ["day-routes-solid"] }).length > 0
          ) {
            return;
          }
          const layers = buildingLayerIds(map);
          const features =
            layers.length > 0
              ? map
                  .queryRenderedFeatures(event.point, { layers })
                  .filter(
                    (feature) =>
                      feature.geometry.type === "Polygon" ||
                      feature.geometry.type === "MultiPolygon",
                  )
              : [];
          const code =
            features.map(featureBuildingCode).find((candidate) => candidate !== null) ??
            nearestCampusBuildingCode(map, event.point, features.length > 0 ? 160 : 28);
          if (code) latestData.current.onSelectBuilding(code);
        });
        map.on("error", () => {
          if (!disposed && !map.isStyleLoaded()) setStatus("error");
        });
        map.on("style.load", () => {
          if (disposed) return;
          ready = true;
          if (loadTimeout) clearTimeout(loadTimeout);
          styleCampusBuildings(map, themeRef.current);
          ensureBuildingHighlightLayers(map, themeRef.current);
          syncMapData(
            map,
            maplibregl,
            latestData.current,
            markersRef.current,
            themeRef.current,
            lastRouteKeyRef,
            routeAnimationFrameRef,
            latestData,
          );
          syncBuildingHighlight(map, latestData.current.hoveredBuildingCode, "hover");
          syncBuildingHighlight(map, latestData.current.selectedBuildingCode, "selected");
          if (!routeClickBound) {
            map.on("click", "day-routes-solid", (event) => {
              const id = event.features?.[0]?.properties?.["id"];
              if (typeof id === "string") latestData.current.onSelectSegment(id);
            });
            routeClickBound = true;
          }
          const selectedBuilding = latestData.current.selectedBuildingCode;
          if (
            selectedBuilding &&
            selectedBuilding !== lastFocusedBuildingRef.current &&
            focusBuilding(map, selectedBuilding)
          ) {
            lastFocusedBuildingRef.current = selectedBuilding;
            userHasMovedRef.current = true;
          } else {
            maybeFitBounds(
              map,
              maplibregl,
              latestData.current,
              lastFitKeyRef,
              !userHasMovedRef.current,
            );
          }
          setStatus("ready");
        });
        loadTimeout = setTimeout(() => {
          if (!disposed && !ready) setStatus("error");
        }, MAP_LOAD_TIMEOUT_MS);
      })
      .catch(() => {
        if (!disposed) setStatus("error");
      });

    return () => {
      disposed = true;
      if (loadTimeout) clearTimeout(loadTimeout);
      if (routeAnimationFrameRef.current !== null) {
        cancelAnimationFrame(routeAnimationFrameRef.current);
        routeAnimationFrameRef.current = null;
      }
      for (const marker of markersRef.current) marker.remove();
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
      maplibreRef.current = null;
      appliedThemeRef.current = null;
    };
  }, [attempt]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || appliedThemeRef.current === mapTheme) return;
    appliedThemeRef.current = mapTheme;
    setStatus("loading");
    map.setStyle(MAP_CONFIG.styleUrls[mapTheme]);
  }, [mapTheme]);

  useEffect(() => {
    const map = mapRef.current;
    const maplibregl = maplibreRef.current;
    if (map && maplibregl && map.isStyleLoaded()) {
      syncMapData(
        map,
        maplibregl,
        latestData.current,
        markersRef.current,
        themeRef.current,
        lastRouteKeyRef,
        routeAnimationFrameRef,
        latestData,
      );
      maybeFitBounds(map, maplibregl, latestData.current, lastFitKeyRef, !userHasMovedRef.current);
    }
  }, [
    home,
    meetings,
    onSelectMeeting,
    onSelectSegment,
    selectedMeetingId,
    selectedSegmentId,
    segments,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (map?.isStyleLoaded()) syncBuildingHighlight(map, hoveredBuildingCode, "hover");
  }, [hoveredBuildingCode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    syncBuildingHighlight(map, selectedBuildingCode, "selected");
    if (
      selectedBuildingCode &&
      selectedBuildingCode !== lastFocusedBuildingRef.current &&
      focusBuilding(map, selectedBuildingCode)
    ) {
      lastFocusedBuildingRef.current = selectedBuildingCode;
      userHasMovedRef.current = true;
    }
    if (!selectedBuildingCode) lastFocusedBuildingRef.current = null;
  }, [selectedBuildingCode]);

  const hasRouteContent =
    meetings.some((meeting) => getCampusBuilding(meeting.buildingCode)) ||
    segments.some((segment) => segment.route.displayCoordinates.length > 0) ||
    Boolean(home && getCampusBuilding(home.buildingCode));

  function resetCamera() {
    const map = mapRef.current;
    const maplibregl = maplibreRef.current;
    if (!map || !maplibregl || !map.isStyleLoaded()) return;
    userHasMovedRef.current = false;
    lastFitKeyRef.current = "";
    if (!maybeFitBounds(map, maplibregl, latestData.current, lastFitKeyRef)) {
      showCampusOverview(map);
    }
  }

  return (
    <div
      className={`campus-map relative w-full overflow-hidden rounded-xl border border-border bg-muted ${className || "h-[25rem]"}`}
    >
      <div
        ref={containerRef}
        className="h-full w-full"
        role="region"
        aria-label="Interactive map of the University of Toronto Mississauga campus"
      />
      {status === "ready" ? (
        <button
          type="button"
          onClick={resetCamera}
          className="button-secondary absolute right-3 top-[5.75rem] z-10 min-h-10 rounded-lg px-3 text-xs font-semibold shadow-lg"
          aria-label={hasRouteContent ? "Fit the active day route" : "Return to campus overview"}
        >
          {hasRouteContent ? "Fit route" : "Campus overview"}
        </button>
      ) : null}
      {status === "loading" ? (
        <div
          className="pointer-events-none absolute inset-0 grid place-items-center bg-muted/90 px-6 text-center text-sm text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          Loading the campus map…
        </div>
      ) : null}
      {status === "unsupported" ? (
        <div className="absolute inset-0 grid place-items-center bg-muted px-6 text-center">
          <div>
            <p className="font-semibold">Interactive map unavailable</p>
            <p className="mt-2 text-sm text-muted-foreground">
              This browser does not support WebGL 2. Use the route timeline and written directions
              on this page instead.
            </p>
          </div>
        </div>
      ) : null}
      {status === "error" ? (
        <div
          className="absolute inset-0 grid place-items-center bg-muted px-6 text-center"
          role="alert"
        >
          <div>
            <p className="font-semibold">The campus map could not load</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Route details remain available on this page. Check your connection or try the map
              again.
            </p>
            <button
              type="button"
              onClick={() => setAttempt((value) => value + 1)}
              className="mt-4 rounded-md border border-input bg-card px-3 py-2 text-sm font-semibold hover:bg-secondary"
            >
              Retry map
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
