import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { LocateFixed, Maximize2 } from "lucide-react";
import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl";
import mapLibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import { MAP_CONFIG } from "@/config/map";
import { getCampusBuilding, UTM_ROUTING_GRAPH } from "@/data/utm/campus";
import {
  buildingCodeAtCoordinate,
  footprintGeometryPoints,
  getCampusBuildingFootprint,
  representativePointForFootprint,
} from "@/data/utm/building-footprints";
import { getCampusCameraBounds } from "@/features/routing/campus-region";
import { groupedVerticalMarkerOffsets } from "@/features/routing/map-marker-layout";
import {
  resolveMapAnchor,
  type MapAnchorSegment,
  type MapCoordinate,
} from "@/features/routing/map-anchors";
import { isCampusDayAnchorMeeting, type CampusDayAnchor } from "@/features/routing/campus-day";
import { watchCampusLocation, type LiveLocationState } from "@/features/routing/live-location";
import type { TransitionRoute } from "@/features/routing/types";
import { formatTime, type Meeting } from "@/lib/timetable-types";
import type { BuildingEntrance } from "@/data/utm/routing-buildings";

type MapSegment = {
  id: string;
  from: Meeting;
  to: Meeting;
  route: TransitionRoute;
};

type EntranceMarkerRecord = {
  id: string;
  entrance: BuildingEntrance;
  marker: Marker;
  element: HTMLButtonElement;
};

export type MapFocusPadding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

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
  activeEntranceId?: string | null;
  onActiveEntranceChange?: (id: string | null) => void;
  focusPadding?: MapFocusPadding;
  dayAnchor: CampusDayAnchor | null;
  className?: string;
};

type MapData = {
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
  activeEntranceId: string | null | undefined;
  onActiveEntranceChange: ((id: string | null) => void) | undefined;
  focusPadding: MapFocusPadding | undefined;
  dayAnchor: CampusDayAnchor | null;
};

type MapLibreModule = typeof import("maplibre-gl");
type MapStatus = "loading" | "ready" | "error" | "unsupported";
type MapTheme = keyof typeof MAP_CONFIG.styleUrls;
type LocationControlState = LiveLocationState | { status: "disabled"; point: null };
const MAP_LOAD_TIMEOUT_MS = 12_000;
const FIT_BOUNDS_MAX_ZOOM = 17;
const ROUTE_DRAW_DURATION_MS = 900;
const BUILDING_HOVER_DURATION_MS = 200;
const DEFAULT_FOCUS_PADDING: MapFocusPadding = { top: 72, right: 24, bottom: 24, left: 24 };
const BUILDING_HOVER_SOURCE_ID = "gapwise-building-hover";
const BUILDING_HOVER_FILL_LAYER_ID = "gapwise-building-hover-fill";
const BUILDING_HOVER_LINE_LAYER_ID = "gapwise-building-hover-line";
const BUILDING_SELECTED_SOURCE_ID = "gapwise-building-selected";
const BUILDING_SELECTED_FILL_LAYER_ID = "gapwise-building-selected-fill";
const BUILDING_SELECTED_LINE_LAYER_ID = "gapwise-building-selected-line";

function mapAccentColor(theme: MapTheme) {
  return theme === "dark" ? "#60a5fa" : "#146bb8";
}

function routeSequenceColor(theme: MapTheme, index: number, total: number) {
  const progress = total <= 1 ? 0 : index / (total - 1);
  const start = theme === "dark" ? [96, 165, 250] : [20, 107, 184];
  const end = theme === "dark" ? [167, 139, 250] : [124, 58, 237];
  const channel = (slot: number) =>
    Math.round(start[slot]! + (end[slot]! - start[slot]!) * progress);
  return `rgb(${channel(0)} ${channel(1)} ${channel(2)})`;
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

function routeFeatureCollection(data: MapData, theme: MapTheme, progress = 1) {
  return {
    type: "FeatureCollection" as const,
    features: data.segments
      .filter((segment) => segment.route.displayCoordinates.length >= 2)
      .map((segment, index, visibleSegments) => ({
        type: "Feature" as const,
        properties: {
          id: segment.id,
          selected: segment.id === data.selectedSegmentId,
          sequenceColor: routeSequenceColor(theme, index, visibleSegments.length),
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
  theme: MapTheme,
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
    source.setData(routeFeatureCollection(latestDataRef.current, theme));
    return;
  }

  source.setData(routeFeatureCollection(latestDataRef.current, theme, 0));
  const startedAt = performance.now();
  const drawFrame = (now: number) => {
    if (map.getSource("day-routes") !== source || routeGeometryKey(latestDataRef.current) !== key) {
      animationFrameRef.current = null;
      return;
    }
    const elapsed = Math.min(1, (now - startedAt) / ROUTE_DRAW_DURATION_MS);
    const eased = 1 - (1 - elapsed) ** 3;
    source.setData(routeFeatureCollection(latestDataRef.current, theme, eased));

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

function dayAnchorStopIds(data: MapData): string[] {
  const ids = new Set<string>();
  for (const segment of data.segments) {
    if (isCampusDayAnchorMeeting(segment.from)) ids.add(segment.from.id);
    if (isCampusDayAnchorMeeting(segment.to)) ids.add(segment.to.id);
  }
  return [...ids];
}

function addRouteLayers(map: MapLibreMap, theme: MapTheme) {
  const casingColor = theme === "dark" ? "#05070a" : "#f8fafc";

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
      "line-color": ["get", "sequenceColor"],
      "line-width": ["case", ["==", ["get", "selected"], true], 4.5, 3],
      "line-opacity": ["case", ["==", ["get", "selected"], true], 1, 0.78],
    },
  });
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

  const feature = buildingCode ? getCampusBuildingFootprint(buildingCode) : null;
  source.setData(
    feature ? { type: "FeatureCollection", features: [feature] } : emptyFeatureCollection(),
  );

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

function mapBuildingAnchor(code: string | null) {
  const campus = getCampusBuilding(code);
  if (campus) return { code: campus.code, navigationPoint: campus.navigationPoint };
  const footprint = getCampusBuildingFootprint(code);
  const navigationPoint = footprint ? representativePointForFootprint(footprint) : null;
  return footprint && navigationPoint
    ? { code: footprint.properties.buildingCode, navigationPoint }
    : null;
}

function createMeetingPopupContent(meeting: Meeting, buildingCode: string) {
  const card = document.createElement("section");
  card.className = "map-meeting-popover";
  card.dataset["activity"] = meeting.activityType;
  card.setAttribute("aria-label", `Timetable details for ${meeting.courseCode}`);

  const headingRow = document.createElement("div");
  headingRow.className = "map-meeting-popover-heading";
  const title = document.createElement("strong");
  title.textContent = meeting.courseCode;
  const activity = document.createElement("span");
  activity.className = "map-meeting-popover-activity";
  activity.textContent = meeting.activityType;
  headingRow.append(title, activity);
  card.append(headingRow);

  if (meeting.courseName) {
    const courseName = document.createElement("p");
    courseName.className = "map-meeting-popover-course";
    courseName.textContent = meeting.courseName;
    card.append(courseName);
  }

  const details = document.createElement("dl");
  details.className = "map-meeting-popover-details";
  const location = meeting.room ? `${buildingCode} ${meeting.room}` : buildingCode;
  const rows: [string, string][] = [
    ["Time", `${formatTime(meeting.startTime)} – ${formatTime(meeting.endTime)}`],
    ["Location", location],
    ["Component", `${meeting.activityType}${meeting.sectionCode ? ` · ${meeting.sectionCode}` : ""}`],
    ["Day", `${meeting.weekday} · ${meeting.term}`],
  ];
  for (const [label, value] of rows) {
    const row = document.createElement("div");
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = label;
    description.textContent = value;
    row.append(term, description);
    details.append(row);
  }
  card.append(details);
  return card;
}

function layoutTimeMarkers(map: MapLibreMap, markers: Marker[]) {
  const timeMarkers = markers.filter((marker) =>
    marker.getElement().classList.contains("map-time-marker"),
  );
  const points = timeMarkers.map((marker, index) => {
    const element = marker.getElement();
    const point = map.project(marker.getLngLat());
    const parsedStartTime = Number(element.dataset["startTime"]);
    return {
      x: point.x,
      y: point.y,
      groupKey: element.dataset["buildingCode"] ?? `marker-${index}`,
      order: Number.isFinite(parsedStartTime) ? parsedStartTime : index,
    };
  });
  const offsets = groupedVerticalMarkerOffsets(points);
  timeMarkers.forEach((marker, index) => marker.setOffset(offsets[index] ?? [0, 0]));
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
  const openMeetingId = markers.find((marker) => marker.getPopup()?.isOpen())?.getElement().dataset[
    "meetingId"
  ] ?? null;
  for (const marker of markers) marker.remove();
  markers.length = 0;

  const routes = anchorSegments(data);

  data.meetings.forEach((meeting) => {
    const building = mapBuildingAnchor(meeting.buildingCode);
    if (!building) return;
    const anchor = resolveMapAnchor(
      meeting.id,
      building.navigationPoint,
      routes,
      data.selectedSegmentId,
    );
    const markerButton = document.createElement("button");
    markerButton.type = "button";
    markerButton.className = `map-time-marker${meeting.id === data.selectedMeetingId ? " is-selected" : ""}`;
    markerButton.dataset["meetingId"] = meeting.id;
    markerButton.dataset["activity"] = meeting.activityType;
    markerButton.dataset["buildingCode"] = building.code;
    markerButton.dataset["startTime"] = String(meeting.startTime);
    markerButton.textContent = formatTime(meeting.startTime);
    const location = meeting.room ? `${building.code} ${meeting.room}` : building.code;
    markerButton.title = `${formatTime(meeting.startTime)} · ${meeting.courseCode} · ${location}`;
    markerButton.setAttribute(
      "aria-label",
      `Show details for ${meeting.courseCode}, ${meeting.activityType}, ${formatTime(meeting.startTime)} to ${formatTime(meeting.endTime)}, ${location}`,
    );
    markerButton.addEventListener("click", (event) => {
      event.stopPropagation();
      data.onSelectMeeting(meeting.id);
    });
    markerButton.addEventListener("mouseenter", () => data.onHoverBuilding(building.code));
    markerButton.addEventListener("mouseleave", () => data.onHoverBuilding(null));

    const popup = new maplibregl.Popup({
      offset: 18,
      closeButton: true,
      closeOnClick: true,
      maxWidth: "18rem",
    }).setDOMContent(createMeetingPopupContent(meeting, building.code));
    const marker = new maplibregl.Marker({ element: markerButton })
      .setLngLat(anchor.coordinate)
      .setPopup(popup)
      .addTo(map);
    if (meeting.id === openMeetingId) marker.togglePopup();
    markers.push(marker);
  });

  if (data.dayAnchor) {
    const anchor = resolveMapAnchor(
      dayAnchorStopIds(data),
      data.dayAnchor.coordinates,
      routes,
      data.selectedSegmentId,
    );
    const anchorMarker = document.createElement("div");
    anchorMarker.className = `map-day-anchor-marker is-${data.dayAnchor.kind}`;
    anchorMarker.dataset["testid"] = "campus-day-anchor-marker";
    const anchorIcon = document.createElement("span");
    anchorIcon.textContent =
      data.dayAnchor.kind === "residence"
        ? "⌂"
        : data.dayAnchor.kind === "transit"
          ? "T"
          : data.dayAnchor.kind === "parking"
            ? "P"
            : "↕";
    anchorIcon.setAttribute("aria-hidden", "true");
    anchorMarker.append(anchorIcon);
    anchorMarker.title = `${data.dayAnchor.label} · campus day anchor`;
    anchorMarker.setAttribute("role", "img");
    anchorMarker.setAttribute("aria-label", `Campus day starts at ${data.dayAnchor.label}`);
    if (data.dayAnchor.buildingCode) {
      anchorMarker.addEventListener("mouseenter", () =>
        data.onHoverBuilding(data.dayAnchor?.buildingCode ?? null),
      );
      anchorMarker.addEventListener("mouseleave", () => data.onHoverBuilding(null));
    }
    markers.push(
      new maplibregl.Marker({ element: anchorMarker }).setLngLat(anchor.coordinate).addTo(map),
    );
  }

  layoutTimeMarkers(map, markers);

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
      data: routeFeatureCollection(data, theme, shouldAnimate ? 0 : 1),
    });
    addRouteLayers(map, theme);
    source = map.getSource("day-routes") as GeoJSONSource;
  }

  if (routeChanged) {
    animateRouteDraw(
      map,
      source,
      routeKey,
      theme,
      lastRouteKeyRef,
      routeAnimationFrameRef,
      latestDataRef,
    );
  } else if (sourceCreated || routeAnimationFrameRef.current === null) {
    source.setData(routeFeatureCollection(data, theme));
  }
}

function syncUserLocationMarker(
  map: MapLibreMap,
  maplibregl: MapLibreModule,
  state: LocationControlState,
  markerRef: MutableRefObject<Marker | null>,
) {
  if (state.status !== "on-campus") {
    markerRef.current?.remove();
    markerRef.current = null;
    return;
  }
  const coordinate: [number, number] = [state.point.longitude, state.point.latitude];
  if (markerRef.current) {
    markerRef.current.setLngLat(coordinate);
    return;
  }
  const element = document.createElement("div");
  element.className = "map-user-location-marker";
  element.dataset["testid"] = "user-location-marker";
  element.setAttribute("role", "img");
  element.setAttribute("aria-label", "Your current on-campus location");
  markerRef.current = new maplibregl.Marker({ element }).setLngLat(coordinate).addTo(map);
}

function locationStatusLabel(status: LocationControlState["status"]) {
  if (status === "requesting") return "Finding you…";
  if (status === "on-campus") return "Your on-campus location is shown";
  if (status === "off-campus") return "You're outside the mapped UTM campus";
  if (status === "permission-denied") return "Location permission is off";
  if (status === "unavailable") return "Location is unavailable";
  return null;
}

function entranceAccessibilityLabel(accessibility: string) {
  if (accessibility === "accessible") return "accessible";
  if (accessibility === "not_accessible") return "not marked accessible";
  return "accessibility unknown";
}

function applyEntranceMarkerActiveState(
  element: HTMLButtonElement,
  entrance: BuildingEntrance,
  active: boolean,
) {
  element.className = `map-entrance-marker${active ? " is-selected" : ""}`;
  element.style.width = active ? "34px" : "30px";
  element.style.height = active ? "34px" : "30px";
  const notAccessible = entrance.accessibility === "not_accessible";
  element.style.border = `${active ? 3 : 2}px ${entrance.kind === "approach" ? "dashed" : "solid"} ${notAccessible ? "var(--color-destructive)" : "var(--color-accent)"}`;
  element.style.scale = active ? "1.06" : "";
}

function syncEntranceMarkers(
  map: MapLibreMap,
  maplibregl: MapLibreModule,
  buildingCode: string | null,
  activeEntranceId: string | null,
  onActiveEntranceChange: ((id: string | null) => void) | undefined,
  markers: EntranceMarkerRecord[],
  theme: MapTheme,
) {
  const building = getCampusBuilding(buildingCode);
  const targetEntrances = building?.entrances ?? [];
  const targetIds = new Set(targetEntrances.map((entrance) => entrance.id));

  for (let index = markers.length - 1; index >= 0; index -= 1) {
    const record = markers[index];
    if (!record || !targetIds.has(record.id)) {
      record?.marker.remove();
      markers.splice(index, 1);
    }
  }

  if (!building) return;

  for (const entrance of targetEntrances) {
    const existingRecord = markers.find((record) => record.id === entrance.id);

    if (existingRecord) {
      const active = entrance.id === activeEntranceId;
      applyEntranceMarkerActiveState(existingRecord.element, entrance, active);
    } else {
      const markerButton = document.createElement("button");
      markerButton.type = "button";
      const active = entrance.id === activeEntranceId;
      const accessible = entrance.accessibility === "accessible";
      const notAccessible = entrance.accessibility === "not_accessible";
      markerButton.textContent = accessible ? "♿" : entrance.kind === "approach" ? "A" : "E";
      markerButton.title = `${entrance.label} · ${entranceAccessibilityLabel(entrance.accessibility)}`;
      markerButton.setAttribute(
        "aria-label",
        `${entrance.label}, ${entrance.kind === "approach" ? "mapped approach" : "mapped entrance"}, ${entranceAccessibilityLabel(entrance.accessibility)}`,
      );
      markerButton.style.borderRadius = "9999px";
      markerButton.style.background = theme === "dark" ? "#0b111a" : "#ffffff";
      markerButton.style.color = notAccessible ? "var(--color-destructive)" : "var(--color-accent)";
      markerButton.style.fontSize = "12px";
      markerButton.style.fontWeight = "800";
      markerButton.style.display = "grid";
      markerButton.style.placeItems = "center";
      markerButton.style.boxShadow = "0 4px 14px rgba(0,0,0,.28)";
      markerButton.style.cursor = "pointer";
      markerButton.style.transition = "scale 160ms ease, width 160ms ease, height 160ms ease";
      applyEntranceMarkerActiveState(markerButton, entrance, active);
      markerButton.addEventListener("mouseenter", () => onActiveEntranceChange?.(entrance.id));
      markerButton.addEventListener("mouseleave", () => onActiveEntranceChange?.(null));
      markerButton.addEventListener("focus", () => onActiveEntranceChange?.(entrance.id));
      markerButton.addEventListener("blur", () => onActiveEntranceChange?.(null));
      markerButton.addEventListener("click", (event) => {
        event.stopPropagation();
        onActiveEntranceChange?.(entrance.id);
      });
      const marker = new maplibregl.Marker({ element: markerButton, anchor: "center" })
        .setLngLat(entrance.coordinates)
        .addTo(map);
      markers.push({ id: entrance.id, entrance, marker, element: markerButton });
    }
  }
}

function updateEntranceMarkersActiveState(
  markers: EntranceMarkerRecord[],
  activeEntranceId: string | null,
) {
  for (const record of markers) {
    applyEntranceMarkerActiveState(record.element, record.entrance, record.id === activeEntranceId);
  }
}

function collectBoundsPoints(data: MapData): [number, number][] {
  const points: [number, number][] = [];
  const routes = anchorSegments(data);
  for (const meeting of data.meetings) {
    const building = mapBuildingAnchor(meeting.buildingCode);
    if (building) {
      points.push(
        resolveMapAnchor(meeting.id, building.navigationPoint, routes, data.selectedSegmentId)
          .coordinate,
      );
    }
  }
  if (data.dayAnchor) {
    points.push(
      resolveMapAnchor(
        dayAnchorStopIds(data),
        data.dayAnchor.coordinates,
        routes,
        data.selectedSegmentId,
      ).coordinate,
    );
  }
  for (const segment of data.segments) {
    for (const coord of segment.route.displayCoordinates) points.push(coord as MapCoordinate);
  }
  return points;
}

function fitPadding(map: MapLibreMap): MapFocusPadding {
  if (map.getContainer().clientWidth < 640) {
    return { top: 148, right: 92, bottom: 64, left: 36 };
  }
  return { top: 96, right: 156, bottom: 64, left: 64 };
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
    padding: fitPadding(map),
    maxZoom: FIT_BOUNDS_MAX_ZOOM,
    duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 520,
  });
  return true;
}

function focusKey(buildingCode: string, padding: MapFocusPadding) {
  return `${buildingCode}|${padding.top}|${padding.right}|${padding.bottom}|${padding.left}`;
}

function focusBuilding(
  map: MapLibreMap,
  maplibregl: MapLibreModule,
  buildingCode: string,
  padding: MapFocusPadding,
) {
  const building = getCampusBuilding(buildingCode);
  const feature = getCampusBuildingFootprint(buildingCode);
  if (!building && !feature) return false;
  const points = [
    ...(feature ? footprintGeometryPoints(feature.geometry) : []),
    ...(building?.entrances.map((entrance) => entrance.coordinates) ?? []),
  ];
  if (points.length === 0 && building) points.push(building.navigationPoint);
  if (points.length === 0) return false;
  const [first, ...rest] = points;
  const bounds = rest.reduce(
    (acc, point) => acc.extend(point),
    new maplibregl.LngLatBounds(first, first),
  );
  map.fitBounds(bounds, {
    padding,
    maxZoom: 18,
    duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 620,
  });
  return true;
}

function showCampusOverview(map: MapLibreMap) {
  map.fitBounds(getCampusCameraBounds(UTM_ROUTING_GRAPH), {
    padding: fitPadding(map),
    maxZoom: MAP_CONFIG.initialZoom,
    duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 520,
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
  activeEntranceId = null,
  onActiveEntranceChange,
  focusPadding = DEFAULT_FOCUS_PADDING,
  dayAnchor,
  className = "",
}: CampusMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const maplibreRef = useRef<MapLibreModule | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const userLocationMarkerRef = useRef<Marker | null>(null);
  const entranceMarkersRef = useRef<EntranceMarkerRecord[]>([]);
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
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [liveLocation, setLiveLocation] = useState<LocationControlState>({
    status: "disabled",
    point: null,
  });
  const liveLocationRef = useRef<LocationControlState>(liveLocation);
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
    activeEntranceId,
    onActiveEntranceChange,
    focusPadding,
    dayAnchor,
  });

  useEffect(() => {
    liveLocationRef.current = liveLocation;
  }, [liveLocation]);

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
      activeEntranceId,
      onActiveEntranceChange,
      focusPadding,
      dayAnchor,
    };
  }, [
    activeEntranceId,
    focusPadding,
    dayAnchor,
    mapTheme,
    meetings,
    hoveredBuildingCode,
    onHoverBuilding,
    onActiveEntranceChange,
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
    if (!locationEnabled) {
      setLiveLocation({ status: "disabled", point: null });
      return;
    }
    if (!("geolocation" in navigator)) {
      setLiveLocation({ status: "unavailable", point: null });
      return;
    }
    return watchCampusLocation({
      geolocation: navigator.geolocation,
      graph: UTM_ROUTING_GRAPH,
      onChange: setLiveLocation,
    });
  }, [locationEnabled]);

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
        const campusCameraBounds = getCampusCameraBounds(UTM_ROUTING_GRAPH);
        const map = new maplibregl.Map({
          container: containerRef.current,
          style: MAP_CONFIG.styleUrls[initialTheme],
          center: MAP_CONFIG.campusCenter,
          zoom: MAP_CONFIG.initialZoom,
          minZoom: 14.5,
          maxZoom: 20,
          maxPitch: 55,
          pitch: 24,
          bearing: 0,
          maxBounds: campusCameraBounds,
          renderWorldCopies: false,
          attributionControl: false,
        });
        map.dragRotate.disable();
        map.touchZoomRotate.disableRotation();
        appliedThemeRef.current = initialTheme;
        mapRef.current = map;
        maplibreRef.current = maplibregl;
        map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
        const collapseAttribution = () => {
          const attribution =
            containerRef.current?.querySelector<HTMLElement>(".maplibregl-ctrl-attrib");
          attribution?.classList.remove("maplibregl-compact-show");
          attribution?.removeAttribute("open");
        };
        collapseAttribution();
        map.on("styledata", collapseAttribution);
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
        map.on("move", () => layoutTimeMarkers(map, markersRef.current));
        map.on("dragstart", (event) => {
          if (event.originalEvent) userHasMovedRef.current = true;
        });
        map.on("zoomstart", (event) => {
          if (event.originalEvent) userHasMovedRef.current = true;
        });
        let mapHoveredBuildingCode: string | null = null;
        map.on("mousemove", (event) => {
          const nextCode = buildingCodeAtCoordinate([event.lngLat.lng, event.lngLat.lat]);
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
          if (
            map.getLayer("day-routes-solid") &&
            map.queryRenderedFeatures(event.point, { layers: ["day-routes-solid"] }).length > 0
          ) {
            return;
          }
          const code = buildingCodeAtCoordinate([event.lngLat.lng, event.lngLat.lat]);
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
          syncUserLocationMarker(map, maplibregl, liveLocationRef.current, userLocationMarkerRef);
          syncBuildingHighlight(
            map,
            latestData.current.hoveredBuildingCode === latestData.current.selectedBuildingCode
              ? null
              : latestData.current.hoveredBuildingCode,
            "hover",
          );
          syncBuildingHighlight(map, latestData.current.selectedBuildingCode, "selected");
          for (const record of entranceMarkersRef.current) record.marker.remove();
          entranceMarkersRef.current.length = 0;
          syncEntranceMarkers(
            map,
            maplibregl,
            latestData.current.selectedBuildingCode,
            latestData.current.activeEntranceId ?? null,
            latestData.current.onActiveEntranceChange,
            entranceMarkersRef.current,
            themeRef.current,
          );
          if (!routeClickBound) {
            map.on("click", "day-routes-solid", (event) => {
              const id = event.features?.[0]?.properties?.["id"];
              if (typeof id === "string") latestData.current.onSelectSegment(id);
            });
            routeClickBound = true;
          }
          const selectedBuilding = latestData.current.selectedBuildingCode;
          const selectedPadding = latestData.current.focusPadding ?? DEFAULT_FOCUS_PADDING;
          const selectedFocusKey = selectedBuilding
            ? focusKey(selectedBuilding, selectedPadding)
            : null;
          if (
            selectedBuilding &&
            selectedFocusKey !== lastFocusedBuildingRef.current &&
            focusBuilding(map, maplibregl, selectedBuilding, selectedPadding)
          ) {
            lastFocusedBuildingRef.current = selectedFocusKey;
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
      }
      routeAnimationFrameRef.current = null;
      for (const marker of markersRef.current) marker.remove();
      markersRef.current = [];
      userLocationMarkerRef.current?.remove();
      userLocationMarkerRef.current = null;
      for (const record of entranceMarkersRef.current) record.marker.remove();
      entranceMarkersRef.current = [];
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
    if (map && maplibregl && status === "ready") {
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
    dayAnchor,
    meetings,
    onSelectMeeting,
    onSelectSegment,
    selectedMeetingId,
    selectedSegmentId,
    segments,
    status,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (map) {
      syncBuildingHighlight(
        map,
        hoveredBuildingCode === selectedBuildingCode ? null : hoveredBuildingCode,
        "hover",
      );
    }
  }, [hoveredBuildingCode, selectedBuildingCode]);

  useEffect(() => {
    const map = mapRef.current;
    const maplibregl = maplibreRef.current;
    if (!selectedBuildingCode) {
      for (const record of entranceMarkersRef.current) record.marker.remove();
      entranceMarkersRef.current.length = 0;
      lastFocusedBuildingRef.current = null;
      if (map) syncBuildingHighlight(map, null, "selected");
      return;
    }
    if (!map || !maplibregl) return;
    syncBuildingHighlight(map, selectedBuildingCode, "selected");
    syncEntranceMarkers(
      map,
      maplibregl,
      selectedBuildingCode,
      latestData.current.activeEntranceId ?? null,
      onActiveEntranceChange,
      entranceMarkersRef.current,
      themeRef.current,
    );
    const nextFocusKey = focusKey(selectedBuildingCode, focusPadding);
    if (
      nextFocusKey !== lastFocusedBuildingRef.current &&
      focusBuilding(map, maplibregl, selectedBuildingCode, focusPadding)
    ) {
      lastFocusedBuildingRef.current = nextFocusKey;
      userHasMovedRef.current = true;
    }
  }, [focusPadding, onActiveEntranceChange, selectedBuildingCode]);

  useEffect(() => {
    updateEntranceMarkersActiveState(entranceMarkersRef.current, activeEntranceId);
  }, [activeEntranceId]);

  useEffect(() => {
    const map = mapRef.current;
    const maplibregl = maplibreRef.current;
    if (map && maplibregl && status === "ready") {
      syncUserLocationMarker(map, maplibregl, liveLocation, userLocationMarkerRef);
    } else if (liveLocation.status !== "on-campus") {
      userLocationMarkerRef.current?.remove();
      userLocationMarkerRef.current = null;
    }
  }, [liveLocation, status]);

  const hasRouteContent =
    meetings.some((meeting) => mapBuildingAnchor(meeting.buildingCode)) ||
    segments.some((segment) => segment.route.displayCoordinates.length > 0) ||
    Boolean(dayAnchor);

  function resetCamera() {
    const map = mapRef.current;
    const maplibregl = maplibreRef.current;
    if (!map || !maplibregl) return;
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
        <div className="campus-map-actions absolute right-3 top-[5.35rem] z-10 flex max-w-[min(13rem,calc(100%-1.5rem))] flex-col items-end gap-2">
          <button
            type="button"
            onClick={resetCamera}
            className="button-secondary inline-flex min-h-10 min-w-10 items-center justify-center gap-2 rounded-lg px-2.5 text-xs font-semibold shadow-lg md:px-3"
            aria-label={hasRouteContent ? "Fit the active day route" : "Return to campus overview"}
            title={hasRouteContent ? "Fit route" : "Campus overview"}
          >
            <Maximize2 className="h-4 w-4" aria-hidden="true" />
            <span className="hidden md:inline">
              {hasRouteContent ? "Fit route" : "Campus overview"}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setLocationEnabled((enabled) => !enabled)}
            aria-label={locationEnabled ? "Hide my location" : "Show my location"}
            aria-pressed={locationEnabled}
            className="button-secondary inline-flex min-h-10 min-w-10 items-center justify-center gap-2 rounded-lg px-2.5 text-xs font-semibold shadow-lg md:px-3"
            title={locationEnabled ? "Hide my location" : "Show my location"}
          >
            <LocateFixed className="h-4 w-4" aria-hidden="true" />
            <span className="hidden md:inline">
              {locationEnabled ? "Hide my location" : "Show my location"}
            </span>
          </button>
          {locationStatusLabel(liveLocation.status) ? (
            <p
              className="max-w-[11rem] rounded-md border border-border bg-popover/95 px-2.5 py-1.5 text-right text-[0.68rem] leading-4 text-popover-foreground shadow-md backdrop-blur"
              role="status"
              aria-live="polite"
            >
              {locationStatusLabel(liveLocation.status)}
            </p>
          ) : null}
        </div>
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
              This browser does not support WebGL 2. Use the route sequence and written directions
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
