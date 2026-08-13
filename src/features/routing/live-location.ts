import type { RoutingGraph } from "./types";
import { isPointConfidentlyInsideCampus, type MapPoint } from "./campus-presence";

export type LiveLocationState =
  | { status: "requesting" | "off-campus" | "permission-denied" | "unavailable"; point: null }
  | { status: "on-campus"; point: MapPoint };

type GeolocationWatcher = Pick<Geolocation, "watchPosition" | "clearWatch">;

export function watchCampusLocation({
  geolocation,
  graph,
  onChange,
}: {
  geolocation: GeolocationWatcher;
  graph: RoutingGraph;
  onChange: (state: LiveLocationState) => void;
}): () => void {
  let active = true;
  let watchId: number | null = null;
  onChange({ status: "requesting", point: null });
  try {
    watchId = geolocation.watchPosition(
      (position) => {
        if (!active) return;
        const point: MapPoint = {
          longitude: position.coords.longitude,
          latitude: position.coords.latitude,
          accuracyMeters: position.coords.accuracy,
        };
        onChange(
          isPointConfidentlyInsideCampus(point, graph)
            ? { status: "on-campus", point }
            : { status: "off-campus", point: null },
        );
      },
      (error) => {
        if (!active) return;
        onChange({
          status: error.code === 1 ? "permission-denied" : "unavailable",
          point: null,
        });
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 },
    );
  } catch {
    onChange({ status: "unavailable", point: null });
  }

  return () => {
    active = false;
    if (watchId !== null) geolocation.clearWatch(watchId);
  };
}
