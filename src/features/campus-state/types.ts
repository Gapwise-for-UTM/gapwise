export type CampusFactStatus =
  "verified" | "stale" | "inferred" | "user-reported" | "unavailable" | "unknown";

export type CampusSource = {
  id: string;
  name: string;
  url: string;
  kind: "official" | "open-data" | "community";
  retrievedAt: string;
  refreshAfter?: string;
  attribution?: string;
};

export type Provenance = {
  sourceId: string;
  status: CampusFactStatus;
  observedAt: string;
  expiresAt?: string;
  note?: string;
};

export type WeeklyHours = {
  timezone: "America/Toronto";
  /** ISO weekday (Monday = 1, Sunday = 7). Multiple intervals support split hours. */
  intervals: Partial<Record<1 | 2 | 3 | 4 | 5 | 6 | 7, readonly HoursInterval[]>>;
};

export type HoursInterval = { opens: string; closes: string };

export type CampusPlaceKind =
  "dining" | "study" | "library" | "service" | "recreation" | "amenity" | "facility";

export type CampusPlace = {
  id: string;
  name: string;
  kind: CampusPlaceKind;
  /** References the existing canonical UTM registry; never a parallel building identity. */
  buildingCode: string;
  floorOrRoom?: string;
  summary: string;
  amenities: readonly string[];
  actions?: readonly { label: string; url: string; kind: "booking" | "information" | "report" }[];
  hours?: WeeklyHours;
  hoursProvenance: Provenance;
  metadataProvenance: Provenance;
};

export type CampusEvent = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  buildingCode?: string;
  category: string;
  url: string;
  provenance: Provenance;
};

export type CampusDynamicFact = {
  id: string;
  entityId: string;
  kind: "closure" | "service-disruption" | "facility-issue" | "crowd" | "transit";
  status: CampusFactStatus;
  effectiveFrom: string;
  effectiveUntil?: string;
  provenance: Provenance;
};

export type CampusStateSnapshot = {
  schemaVersion: 1;
  version: string;
  generatedAt: string;
  sources: readonly CampusSource[];
  places: readonly CampusPlace[];
  events: readonly CampusEvent[];
  dynamicFacts: readonly CampusDynamicFact[];
};
