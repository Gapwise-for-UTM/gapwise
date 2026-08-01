import { useEffect, useRef } from "react";
import { MAP_CONFIG } from "@/config/map";
import { getCampusBuilding } from "@/data/utm/campus";
import type { Meeting } from "@/lib/timetable-types";
import type { TransitionRoute } from "@/features/routing/types";

type MapSegment = {
  id: string;
  route: TransitionRoute;
};

export function CampusMap({
  meetings,
  segments,
  selectedMeetingId,
  selectedSegmentId,
  onSelectMeeting,
  onSelectSegment,
}: {
  meetings: Meeting[];
  segments: MapSegment[];
  selectedMeetingId: string | null;
  selectedSegmentId: string | null;
  onSelectMeeting: (id: string) => void;
  onSelectSegment: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let disposed = false;
    let mapInstance: import("maplibre-gl").Map | null = null;

    void import("maplibre-gl").then((maplibregl) => {
      if (disposed || !containerRef.current) return;
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: MAP_CONFIG.styleUrl,
        center: MAP_CONFIG.campusCenter,
        zoom: MAP_CONFIG.initialZoom,
        attributionControl: false,
      });
      mapInstance = map;
      map.addControl(
        new maplibregl.AttributionControl({ customAttribution: MAP_CONFIG.attribution }),
      );
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

      meetings.forEach((meeting, index) => {
        const building = getCampusBuilding(meeting.buildingCode);
        if (!building) return;
        const markerButton = document.createElement("button");
        markerButton.type = "button";
        markerButton.className = `map-number-marker${meeting.id === selectedMeetingId ? " is-selected" : ""}`;
        markerButton.textContent = String(index + 1);
        markerButton.title = `${meeting.courseCode} at ${building.code}`;
        markerButton.setAttribute("aria-label", `Select ${meeting.courseCode}, stop ${index + 1}`);
        markerButton.addEventListener("click", () => onSelectMeeting(meeting.id));
        new maplibregl.Marker({ element: markerButton })
          .setLngLat(building.navigationPoint)
          .addTo(map);
      });

      map.on("load", () => {
        const features = segments
          .filter((segment) => segment.route.displayCoordinates.length >= 2)
          .map((segment) => ({
            type: "Feature" as const,
            properties: {
              id: segment.id,
              selected: segment.id === selectedSegmentId,
              approximate: segment.route.status === "approximate",
            },
            geometry: {
              type: "LineString" as const,
              coordinates: segment.route.displayCoordinates,
            },
          }));
        map.addSource("day-routes", {
          type: "geojson",
          data: { type: "FeatureCollection", features },
        });
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
        const selectFeature = (event: import("maplibre-gl").MapLayerMouseEvent) => {
          const feature = event.features?.[0];
          const id = feature?.properties?.["id"];
          if (typeof id === "string") onSelectSegment(id);
        };
        map.on("click", "day-routes-solid", selectFeature);
        map.on("click", "day-routes-approximate", selectFeature);
      });
    });

    return () => {
      disposed = true;
      mapInstance?.remove();
    };
  }, [meetings, onSelectMeeting, onSelectSegment, segments, selectedMeetingId, selectedSegmentId]);

  return (
    <div
      ref={containerRef}
      className="h-[25rem] w-full overflow-hidden rounded-xl border border-border bg-muted"
      aria-label="Interactive map of the selected class day"
    />
  );
}
