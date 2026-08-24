/** Stable public types matching the Gapwise OpenAPI v1 contract. */
export type ApiVersion = "v1";
export type VerificationStatus = "verified" | "inferred" | "unknown";
export type FactStatus =
  "verified" | "stale" | "inferred" | "user-reported" | "unavailable" | "unknown";
export type RouteMode = "fastest" | "prefer-indoor" | "step-free";
export type Term = "Fall" | "Winter" | "Summer";
export type Weekday = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday";
export type BuildingCategory = "academic" | "residence" | "facility";
export type PlaceKind =
  "dining" | "study" | "library" | "service" | "recreation" | "amenity" | "facility";
export type AvailabilityState = "open" | "closed" | "unknown";
export interface Provenance {
  source: string;
  sourceUrl: string;
  lastVerified: string;
  verificationStatus: VerificationStatus;
}
export interface FactProvenance {
  sourceId: string;
  status: FactStatus;
  observedAt: string;
  expiresAt?: string;
  note?: string;
}
export interface Building {
  code: string;
  name: string;
  category: BuildingCategory;
  aliases: string[];
  routingCoverage: "mapped" | "identity-only";
  entranceCount: number;
  verifiedEntranceCount: number;
  accessibility: "accessible" | "not_accessible" | "unknown";
  indoorRoomNodeCount: number;
  provenance: Provenance[];
}
export interface WeeklyHours {
  timezone: "America/Toronto";
  intervals: Partial<
    Record<"1" | "2" | "3" | "4" | "5" | "6" | "7", Array<{ opens: string; closes: string }>>
  >;
}
export interface PlaceAction {
  label: string;
  url: string;
  kind: "booking" | "information" | "report";
}
export interface PlaceAvailability {
  state: AvailabilityState;
  freshness: FactStatus;
  evaluatedAt: string;
  nextTransition: string | null;
}
export interface CampusPlace {
  id: string;
  name: string;
  kind: PlaceKind;
  buildingCode: string;
  floorOrRoom?: string;
  summary: string;
  amenities: readonly string[];
  actions?: readonly PlaceAction[];
  hours?: WeeklyHours;
  hoursProvenance: FactProvenance;
  metadataProvenance: FactProvenance;
  availability: PlaceAvailability;
}
export interface RoutePreferences {
  mode?: RouteMode;
  walkingSpeedMps?: number;
  transitionBufferMinutes?: number;
}
export interface RouteRequest {
  from: string;
  to: string;
  preferences?: RoutePreferences;
}
export interface RouteResult {
  dataVersion: string;
  from: Building;
  to: Building;
  preferences: Required<RoutePreferences>;
  status: "same-building" | "routed" | "approximate" | "unavailable";
  accuracy: string;
  totalDistanceMeters: number | null;
  indoorDistanceMeters: number | null;
  outdoorDistanceMeters: number | null;
  estimatedSeconds: number | null;
  floorChanges: number | null;
  warnings: string[];
  routeVerification: "verified" | "mixed" | "inferred" | "unavailable";
}
export interface GapPreferences {
  setupMinutes?: number;
  packUpMinutes?: number;
  lunchWindowStart?: number;
  lunchWindowEnd?: number;
  mealDurationMinutes?: number;
  willingToLeaveCampus?: boolean;
  oneWayHomeCommuteMinutes?: number | null;
  minimumHomeStayMinutes?: number;
  homeTurnaroundMinutes?: number;
  riskTolerance?: "low" | "medium" | "high";
}
export interface GapPlanRequest {
  from: string;
  to: string;
  term: Term;
  weekday: Weekday;
  startTime: number;
  endTime: number;
  routePreferences?: RoutePreferences;
  gapPreferences?: GapPreferences;
}
export interface GapRecommendation {
  id: string;
  action: string;
  title: string;
  summary: string;
  score: number;
  activityMinutes: number;
  reasons: string[];
  tags: string[];
  timeline: Array<{ kind: string; label: string; minutes: number }>;
}
export interface GapAssessment {
  primary: GapRecommendation;
  alternatives: GapRecommendation[];
  confidence: number;
  confidenceLabel: "high" | "medium" | "low";
  travelMinutes: number | null;
  bufferMinutes: number;
  leaveByMinutes: number;
  arrivalMinutes: number | null;
  fallback: boolean;
  routeStatus: string;
  routeAccuracy: string;
  warnings: string[];
}
export interface GapPlanResult {
  dataVersion: string;
  gap: {
    term: Term;
    weekday: Weekday;
    startTime: number;
    endTime: number;
    durationMinutes: number;
    from: Building;
    to: Building;
  };
  route: RouteResult;
  gapPreferences: Required<GapPreferences>;
  assessment: GapAssessment;
}
export interface Pagination {
  limit: number;
  offset: number;
  count: number;
  total: number;
  nextOffset: number | null;
}
export interface ResponseMeta {
  apiVersion: ApiVersion;
  dataVersion: string;
  generatedAt?: string;
  requestId: string;
  pagination?: Pagination;
  filters?: Record<string, string>;
}
export interface Collection<T> {
  data: T[];
  meta: ResponseMeta & { pagination: Pagination };
}
export interface ApiInfo {
  name: string;
  apiVersion: ApiVersion;
  campusDataVersion: string;
  campusStateVersion: string;
  authentication: "none";
  documentationUrl: string;
  openapiUrl: string;
  capabilities: {
    buildingSearch: boolean;
    placeSearch: boolean;
    placeAvailability: "source-dependent";
    routingModes: RouteMode[];
  };
  privacy: string;
}
export interface BuildingListOptions {
  q?: string;
  category?: BuildingCategory;
  limit?: number;
  offset?: number;
}
export interface PlaceListOptions {
  q?: string;
  kind?: PlaceKind;
  building?: string;
  openNow?: AvailabilityState;
  limit?: number;
  offset?: number;
}
