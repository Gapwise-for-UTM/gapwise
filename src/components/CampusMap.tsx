import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl";
import mapLibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import { MAP_CONFIG } from "@/config/map";
import { getCampusBuilding } from "@/data/utm/campus";
import type { TransitionRoute } from "@/features/routing/types";
import type { Meeting } from "@/lib/timetable-types";

type MapSegment = {
  id: string;
  from: Meeting;
  to: Meeting;
  route: TransitionRoute;
};

type MapData = {
  meetings: Meeting[];
  segments: MapSegment[];
  selectedMeetingId: string | null;
  selectedSegmentId: string | null;
  onSelectMeeting: (id: string) => void;
  onSelectSegment: (id: string) => void;
};

type MapLibreModule = typeof import("maplibre-gl");
type MapStatus = "loading" | "ready" | "error" | "unsupported";
type MapTheme = keyof typeof MAP_CONFIG.styleUrls;
type WalkingRouteResponse = {
  trip?: {
    legs?: Array<{ shape?: string }>;
  };
};

const MAP_LOAD_TIMEOUT_MS = 12_000;
const FIT_BOUNDS_PADDING_PX = 56;
const FIT_BOUNDS_MAX_ZOOM = 17;
const WALKING_ROUTE_REQUEST_INTERVAL_MS = 1_100;
const walkingRouteCache = new Map<string, Promise<[number, number][] | null>>();
let walkingRouteQueue = Promise.resolve();
let nextWalkingRouteRequestAt = 0;

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

function decodePolyline6(encoded: string): [number, number][] {
  const coordinates: [number, number][] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  const readDelta = () => {
    let result = 0;
    let shift = 0;
    let byte = 0;
    do {
      if (index >= encoded.length) throw new Error("Invalid route geometry");
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };

  while (index < encoded.length) {
    latitude += readDelta();
    longitude += readDelta();
    coordinates.push([longitude / 1_000_000, latitude / 1_000_000]);
  }

  return coordinates;
}

function queueWalkingRouteRequest<T>(request: () => Promise<T>): Promise<T> {
  const queued = walkingRouteQueue.then(async () => {
    const waitMs = Math.max(0, nextWalkingRouteRequestAt - Date.now());
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
    nextWalkingRouteRequestAt = Date.now() + WALKING_ROUTE_REQUEST_INTERVAL_MS;
    return request();
  });
  walkingRouteQueue = queued.then(
    () => undefined,
    () => undefined,
  );
  return queued;
}

function getWalkingRoute(
  from: [number, number],
  to: [number, number],
): Promise<[number, number][] | null> {
  const key = `${from.join(",")}>${to.join(",")}`;
  const cached = walkingRouteCache.get(key);
  if (cached) return cached;

  const request = queueWalkingRouteRequest(async () => {
    try {
      const response = await fetch("https://valhalla1.openstreetmap.de/route", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Client-Id": "gapwise-utm.vercel.app",
        },
        body: JSON.stringify({
          locations: [
            { lat: from[1], lon: from[0] },
            { lat: to[1], lon: to[0] },
          ],
          costing: "pedestrian",
          directions_options: { units: "kilometers" },
        }),
      });
      if (!response.ok) return null;
      const payload = (await response.json()) as WalkingRouteResponse;
      const shape = payload.trip?.legs?.[0]?.shape;
      if (!shape) return null;
      const coordinates = decodePolyline6(shape);
      return coordinates.length >= 2 ? coordinates : null;
    } catch {
      return null;
    }
  });

  walkingRouteCache.set(key, request);
  return request;
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

function addRouteLayers(map: MapLibreMap) {
  map.addLayer({
    id: "day-routes-solid",
    type: "line",
    source: "day-routes",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#3568a8", "line-width": 4, "line-opacity": 0.88 },
  });
  map.addLayer({
    id: "day-routes-selected",
    type: "line",
    source: "day-routes",
    filter: ["==", ["get", "selected"], true],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#d85f35", "line-width": 6, "line-opacity": 0.98 },
  });
}

function styleCampusBuildings(map: MapLibreMap, theme: MapTheme) {
  const fillColor = theme === "dark" ? "#365975" : "#dce7f1";
  const outlineColor = theme === "dark" ? "#7895ad" : "#9fb5c9";
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

function syncMapData(
  map: MapLibreMap,
  maplibregl: MapLibreModule,
  data: MapData,
  markers: Marker[],
) {
  for (const marker of markers) marker.remove();
  markers.length = 0;

  data.meetings.forEach((meeting, index) => {
    const building = getCampusBuilding(meeting.buildingCode);
    if (!building) return;
    const markerButton = document.createElement("button");
    markerButton.type = "button";
    markerButton.className = `map-number-marker${meeting.id === data.selectedMeetingId ? " is-selected" : ""}`;
    markerButton.textContent = String(index + 1);
    markerButton.title = `${meeting.courseCode} at ${building.code}`;
    markerButton.setAttribute("aria-label", `Select ${meeting.courseCode}, stop ${index + 1}`);
    markerButton.addEventListener("click", () => data.onSelectMeeting(meeting.id), { once: true });
    markers.push(
      new maplibregl.Marker({ element: markerButton })
        .setLngLat(building.navigationPoint)
        .addTo(map),
    );
  });

  const collection = routeFeatureCollection(data);
  const source = map.getSource("day-routes") as GeoJSONSource | undefined;
  if (source) {
    source.setData(collection);
  } else if (map.isStyleLoaded()) {
    map.addSource("day-routes", { type: "geojson", data: collection });
    addRouteLayers(map);
  }
}

function collectBoundsPoints(data: MapData): [number, number][] {
  const points: [number, number][] = [];
  for (const meeting of data.meetings) {
    const building = getCampusBuilding(meeting.buildingCode);
    if (building) points.push(building.navigationPoint);
  }
  for (const segment of data.segments) {
    for (const coord of segment.route.displayCoordinates) {
      points.push(coord as [number, number]);
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
}: MapData) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const maplibreRef = useRef<MapLibreModule | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const lastFitKeyRef = useRef<string>("");
  const appliedThemeRef = useRef<MapTheme | null>(null);
  const [mapTheme, setMapTheme] = useState<MapTheme>(getDocumentTheme);
  const [walkingRoutes, setWalkingRoutes] = useState<Record<string, [number, number][]>>({});
  const themeRef = useRef<MapTheme>(mapTheme);
  const [status, setStatus] = useState<MapStatus>("loading");
  const [attempt, setAttempt] = useState(0);
  const displaySegments = useMemo(
    () =>
      segments.map((segment) => {
        if (segment.route.displayCoordinates.length >= 2) return segment;
        const walkingRoute = walkingRoutes[segment.id];
        if (!walkingRoute) return segment;
        return {
          ...segment,
          route: { ...segment.route, displayCoordinates: walkingRoute },
        };
      }),
    [segments, walkingRoutes],
  );
  const latestData = useRef<MapData>({
    meetings,
    segments: displaySegments,
    selectedMeetingId,
    selectedSegmentId,
    onSelectMeeting,
    onSelectSegment,
  });
  themeRef.current = mapTheme;
  latestData.current = {
    meetings,
    segments: displaySegments,
    selectedMeetingId,
    selectedSegmentId,
    onSelectMeeting,
    onSelectSegment,
  };

  useEffect(() => {
    let cancelled = false;
    const candidates = segments.filter(
      (segment) =>
        segment.route.status === "approximate" && segment.route.displayCoordinates.length < 2,
    );

    void Promise.all(
      candidates.map(async (segment) => {
        const fromBuilding = getCampusBuilding(segment.from.buildingCode);
        const toBuilding = getCampusBuilding(segment.to.buildingCode);
        if (!fromBuilding || !toBuilding) return;
        const coordinates = await getWalkingRoute(
          fromBuilding.navigationPoint,
          toBuilding.navigationPoint,
        );
        if (!cancelled && coordinates) {
          setWalkingRoutes((current) =>
            current[segment.id] ? current : { ...current, [segment.id]: coordinates },
          );
        }
      }),
    );

    return () => {
      cancelled = true;
    };
  }, [segments]);

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
        map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
        map.on("error", () => {
          if (!disposed && !map.isStyleLoaded()) setStatus("error");
        });
        map.on("style.load", () => {
          if (disposed) return;
          ready = true;
          if (loadTimeout) clearTimeout(loadTimeout);
          styleCampusBuildings(map, themeRef.current);
          syncMapData(map, maplibregl, latestData.current, markersRef.current);
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
      syncMapData(map, maplibregl, latestData.current, markersRef.current);
      maybeFitBounds(map, maplibregl, latestData.current, lastFitKeyRef);
    }
  }, [displaySegments, meetings, onSelectMeeting, onSelectSegment, selectedMeetingId, selectedSegmentId]);

  return (
    <div className="relative h-[25rem] w-full overflow-hidden rounded-xl border border-border bg-muted">
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
