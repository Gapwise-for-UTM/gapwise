export type CampusAccessKind = "transit" | "parking" | "pickup";

export type CampusAccessPoint = {
  id: string;
  kind: CampusAccessKind;
  label: string;
  coordinates: [number, number];
  sourceLabel: string;
  sourceUrl: string;
};

/**
 * Small, source-backed set of campus arrival/departure points. These are fixed public map data,
 * never user location data. Pickup/drop-off is intentionally empty until exact layby handoff
 * coordinates are bundled; Gapwise does not substitute a building centroid for a road-side zone.
 */
export const CAMPUS_ACCESS_POINTS: CampusAccessPoint[] = [
  {
    id: "miway-utm-bus-station",
    kind: "transit",
    label: "UTM Bus Station (MiWay)",
    coordinates: [-79.66346, 43.54786],
    sourceLabel: "OpenStreetMap node 898495160",
    sourceUrl: "https://www.openstreetmap.org/node/898495160",
  },
  {
    id: "utm-shuttle-instructional-centre",
    kind: "transit",
    label: "UTM Shuttle — Instructional Centre",
    coordinates: [-79.66396, 43.55184],
    sourceLabel: "UTM Shuttle / OpenStreetMap node 2383651236",
    sourceUrl: "https://www.openstreetmap.org/node/2383651236",
  },
  {
    id: "parking-p8",
    kind: "parking",
    label: "Parking Lot P8",
    coordinates: [-79.65891, 43.54746],
    sourceLabel: "UTM Parking / OpenStreetMap",
    sourceUrl: "https://www.utm.utoronto.ca/parking/",
  },
  {
    id: "parking-p9",
    kind: "parking",
    label: "Parking Lot P9",
    coordinates: [-79.66123, 43.55019],
    sourceLabel: "UTM Parking / OpenStreetMap",
    sourceUrl: "https://www.utm.utoronto.ca/parking/",
  },
];

export function campusAccessPointsFor(kind: CampusAccessKind): CampusAccessPoint[] {
  return CAMPUS_ACCESS_POINTS.filter((point) => point.kind === kind);
}

export function getCampusAccessPoint(id: string | null): CampusAccessPoint | null {
  return CAMPUS_ACCESS_POINTS.find((point) => point.id === id) ?? null;
}
