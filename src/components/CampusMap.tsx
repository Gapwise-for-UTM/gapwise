import { useEffect, useRef, useState } from "react";
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

const MAP_LOAD_TIMEOUT_MS = 12_000;

function supportsWebGl2(): boolean {
  try {
    return Boolean(document.createElement("canvas").getContext("webgl2"));
  } catch {
    return false;
  }
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
    const selectFeature = (event: import("maplibre-gl").MapLayerMouseEvent) => {
      const id = event.features?.[0]?.properties?.["id"];
      if (typeof id === "string") data.onSelectSegment(id);
    };
    map.on("click", "day-routes-solid", selectFeature);
  }
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
  latestData.current = {
    meetings,
    segments,
    selectedMeetingId,
    selectedSegmentId,
    onSelectMeeting,
    onSelectSegment,
  };

  useEffect(() => {
    if (!containerRef.current) return;
    if (!supportsWebGl2()) {
      setStatus("unsupported");
      return;
    }

    let disposed = false;
    let loaded = false;
    let loadTimeout: ReturnType<typeof setTimeout> | undefined;
    setStatus("loading");

    void import("maplibre-gl")
      .then((maplibregl) => {
        if (disposed || !containerRef.current) return;
        maplibregl.setWorkerUrl(mapLibreWorkerUrl);
        const map = new maplibregl.Map({
          container: containerRef.current,
          style: MAP_CONFIG.styleUrl,
          center: MAP_CONFIG.campusCenter,
          zoom: MAP_CONFIG.initialZoom,
          attributionControl: false,
        });
        mapRef.current = map;
        maplibreRef.current = maplibregl;
        map.addControl(
          new maplibregl.AttributionControl({ customAttribution: MAP_CONFIG.attribution }),
        );
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
        map.on("error", () => {
          if (!disposed && !loaded) setStatus("error");
        });
        map.once("load", () => {
          if (disposed) return;
          loaded = true;
          if (loadTimeout) clearTimeout(loadTimeout);
          setStatus("ready");
          syncMapData(map, maplibregl, latestData.current, markersRef.current);
        });
        loadTimeout = setTimeout(() => {
          if (!disposed && !loaded) setStatus("error");
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
    };
  }, [attempt]);

  useEffect(() => {
    const map = mapRef.current;
    const maplibregl = maplibreRef.current;
    if (map && maplibregl && map.isStyleLoaded()) {
      syncMapData(map, maplibregl, latestData.current, markersRef.current);
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
