import type { RoutingGraph } from "./types";
import {
  CAMPUS_LOCATION_MAX_NETWORK_DISTANCE_METERS,
  isCoordinateInsideCampus,
} from "./campus-region";

export type MapPoint = {
  longitude: number;
  latitude: number;
  accuracyMeters: number;
};

const MAX_ACCURACY_METERS = 75;

export function isPointConfidentlyInsideCampus(point: MapPoint, graph: RoutingGraph): boolean {
  if (
    !Number.isFinite(point.longitude) ||
    !Number.isFinite(point.latitude) ||
    point.longitude < -180 ||
    point.longitude > 180 ||
    point.latitude < -90 ||
    point.latitude > 90 ||
    !Number.isFinite(point.accuracyMeters) ||
    point.accuracyMeters < 0 ||
    point.accuracyMeters > MAX_ACCURACY_METERS
  ) {
    return false;
  }

  return isCoordinateInsideCampus(
    [point.longitude, point.latitude],
    graph,
    CAMPUS_LOCATION_MAX_NETWORK_DISTANCE_METERS,
  );
}
