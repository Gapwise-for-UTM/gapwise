import { useEffect, useRef } from "react";
import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl";
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
          approximate: segment.route.status === "approximate",
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
    filter: ["==", ["get", "approximate"], false],
    paint: { "line-color": "#3568a8", "line-width": 4, "line-opacity": 0.8 },
  });
  map.addLayer({
    id: "day-routes-approximate",
    type: "line",
    source: "day-routes",
    filter: ["==", ["get", "approximate"], true],
    paint: {
      "line-color": "#596575",
      "line-width": 3,
      "line-dasharray": [2, 2],
      "line-opacity": 0.85,
    },
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
    map.on("click", "day-routes-approximate", selectFeature);
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
    let disposed = false;

    void import("maplibre-gl").then((maplibregl) => {
      if (disposed || !containerRef.current) return;
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
      map.once("load", () => {
        if (!disposed) syncMapData(map, maplibregl, latestData.current, markersRef.current);
      });
    });

    return () => {
      disposed = true;
      for (const marker of markersRef.current) marker.remove();
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
      maplibreRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const maplibregl = maplibreRef.current;
    if (map && maplibregl && map.isStyleLoaded()) {
      syncMapData(map, maplibregl, latestData.current, markersRef.current);
    }
  }, [meetings, onSelectMeeting, onSelectSegment, segments, selectedMeetingId, selectedSegmentId]);

  return (
    <div
      ref={containerRef}
      className="h-[25rem] w-full overflow-hidden rounded-xl border border-border bg-muted"
      aria-label="Interactive map of the selected class day"
    />
  );
}
