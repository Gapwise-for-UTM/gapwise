import { useEffect, useRef, useState, type MutableRefObject } from "react";
import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl";
import mapLibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import { MAP_CONFIG } from "@/config/map";
import { getCampusBuilding } from "@/data/utm/campus";
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

type MapData = {
  meetings: Meeting[];
  segments: MapSegment[];
  selectedMeetingId: string | null;
  selectedSegmentId: string | null;
  onSelectMeeting: (id: string) => void;
  onSelectSegment: (id: string) => void;
  home: MapHome | null;
  className?: string;
};

type MapLibreModule = typeof import("maplibre-gl");
type MapStatus = "loading" | "ready" | "error" | "unsupported";
type MapTheme = keyof typeof MAP_CONFIG.styleUrls;
const MAP_LOAD_TIMEOUT_MS = 12_000;
const FIT_BOUNDS_PADDING_PX = 56;
const FIT_BOUNDS_MAX_ZOOM = 17;

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

function routeFeatureCollection(data: MapData) {
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
          coordinates: segment.route.displayCoordinates,
        },
      })),
  };
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
  const routeColor = theme === "dark" ? "#60a5fa" : "#146bb8";
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
    markerButton.addEventListener("click", () => data.onSelectMeeting(meeting.id), { once: true });
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
      markers.push(
        new maplibregl.Marker({ element: homeMarker }).setLngLat(anchor.coordinate).addTo(map),
      );
    }
  }

  const collection = routeFeatureCollection(data);
  const source = map.getSource("day-routes") as GeoJSONSource | undefined;
  if (source) {
    source.setData(collection);
  } else {
    map.addSource("day-routes", { type: "geojson", data: collection });
    addRouteLayers(map, theme);
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
) {
  const points = collectBoundsPoints(data);
  if (points.length === 0) return;

  const key = points
    .map((point) => point.join(","))
    .sort()
    .join("|");
  if (key === lastFitKeyRef.current) return;
  lastFitKeyRef.current = key;

  const [first, ...rest] = points;
  const bounds = rest.reduce(
    (acc, point) => acc.extend(point),
    new maplibregl.LngLatBounds(first, first),
  );
  map.fitBounds(bounds, {
    padding: FIT_BOUNDS_PADDING_PX,
    maxZoom: FIT_BOUNDS_MAX_ZOOM,
    duration: 500,
  });
}

export function CampusMap({
  meetings,
  segments,
  selectedMeetingId,
  selectedSegmentId,
  onSelectMeeting,
  onSelectSegment,
  home,
  className = "",
}: MapData) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const maplibreRef = useRef<MapLibreModule | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const lastFitKeyRef = useRef<string>("");
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
      home,
    };
  }, [
    home,
    mapTheme,
    meetings,
    onSelectMeeting,
    onSelectSegment,
    selectedMeetingId,
    selectedSegmentId,
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
        map.on("error", () => {
          if (!disposed && !map.isStyleLoaded()) setStatus("error");
        });
        map.on("style.load", () => {
          if (disposed) return;
          ready = true;
          if (loadTimeout) clearTimeout(loadTimeout);
          styleCampusBuildings(map, themeRef.current);
          syncMapData(map, maplibregl, latestData.current, markersRef.current, themeRef.current);
          if (!routeClickBound) {
            map.on("click", "day-routes-solid", (event) => {
              const id = event.features?.[0]?.properties?.["id"];
              if (typeof id === "string") latestData.current.onSelectSegment(id);
            });
            routeClickBound = true;
          }
          maybeFitBounds(map, maplibregl, latestData.current, lastFitKeyRef);
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
      syncMapData(map, maplibregl, latestData.current, markersRef.current, themeRef.current);
      maybeFitBounds(map, maplibregl, latestData.current, lastFitKeyRef);
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

  return (
    <div
      className={`campus-map relative w-full overflow-hidden rounded-xl border border-border bg-muted ${className || "h-[25rem]"}`}
    >
      <div
        ref={containerRef}
        className="h-full w-full"
        role="region"
        aria-label="Interactive map of the selected class day"
      />
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
