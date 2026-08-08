import { useEffect, useRef, useState, type MutableRefObject } from "react";
import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl";
import mapLibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import { MAP_CONFIG } from "@/config/map";
import { getCampusBuilding } from "@/data/utm/campus";
import type { TransitionRoute } from "@/features/routing/types";
import type { Meeting } from "@/lib/timetable-types";

type MapSegment = {
  id: string;
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
      .filter(
        (segment) =>
          segment.route.status === "routed" && segment.route.displayCoordinates.length >= 2,
      )
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
    paint: { "line-color": "#3568a8", "line-width": 4, "line-opacity": 0.8 },
  });
  map.addLayer({
    id: "day-routes-selected",
    type: "line",
    source: "day-routes",
    filter: ["==", ["get", "selected"], true],
    paint: { "line-color": "#d85f35", "line-width": 6, "line-opacity": 0.95 },
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
            "fill-extrusion-height": [
              "coalesce",
              ["get", "render_height"],
              ["get", "height"],
              8,
            ],
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
    if (segment.route.status === "routed") {
      for (const coord of segment.route.displayCoordinates) {
        points.push(coord as [number, number]);
      }
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
  });
  themeRef.current = mapTheme;
  latestData.current = {
    meetings,
    segments,
    selectedMeetingId,
    selectedSegmentId,
    onSelectMeeting,
    onSelectSegment,
  };

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
          new maplibregl.AttributionControl({ customAttribution: MAP_CONFIG.attribution }),
        );
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
  }, [meetings, onSelectMeeting, onSelectSegment, segments, selectedMeetingId, selectedSegmentId]);

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
