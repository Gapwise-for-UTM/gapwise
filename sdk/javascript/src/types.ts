/** API version exposed by the Gapwise Public Campus API. */
export type ApiVersion = "v1";

/** Confidence assigned to source-backed campus facts. */
export type VerificationStatus = "verified" | "inferred" | "unknown";

/** Freshness and evidence state for a public campus fact. */
export type FactStatus =
  "verified" | "stale" | "inferred" | "user-reported" | "unavailable" | "unknown";

/** Routing strategy used when calculating a campus route. */
export type RouteMode = "fastest" | "prefer-indoor" | "step-free";

/** Academic term understood by Gapwise gap planning. */
export type Term = "Fall" | "Winter" | "Summer";

/** Weekday accepted by the public gap-planning API. */
export type Weekday =
  "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";

/** High-level category assigned to a canonical campus building. */
export type BuildingCategory = "academic" | "residence" | "facility";

/** Public category assigned to a discoverable campus place. */
export type PlaceKind =
  "dining" | "study" | "library" | "service" | "recreation" | "amenity" | "facility";

/** Evaluated availability state for a campus place. */
export type AvailabilityState = "open" | "closed" | "unknown";

/** Source and verification metadata attached to canonical campus data. */
export interface Provenance {
  source: string;
  sourceUrl: string;
  lastVerified: string;
  verificationStatus: VerificationStatus;
}

/** Evidence metadata for a fact that can become stale independently. */
export interface FactProvenance {
  sourceId: string;
  status: FactStatus;
  observedAt: string;
  expiresAt?: string;
  note?: string;
}

/** Canonical public representation of a UTM campus building. */
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

/** Weekly operating intervals expressed in the Toronto timezone. */
export interface WeeklyHours {
  timezone: "America/Toronto";
  intervals: Partial<
    Record<"1" | "2" | "3" | "4" | "5" | "6" | "7", Array<{ opens: string; closes: string }>>
  >;
}

/** User-facing action associated with a campus place. */
export interface PlaceAction {
  label: string;
  url: string;
  kind: "booking" | "information" | "report";
}

/** Current evaluated availability and freshness for a campus place. */
export interface PlaceAvailability {
  state: AvailabilityState;
  freshness: FactStatus;
  evaluatedAt: string;
  nextTransition: string | null;
}

/** Canonical public representation of a discoverable campus place. */
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

/** Optional preferences that influence route calculation. */
export interface RoutePreferences {
  mode?: RouteMode;
  walkingSpeedMps?: number;
  transitionBufferMinutes?: number;
}

/** Input for calculating a route between two campus locations. */
export interface RouteRequest {
  from: string;
  to: string;
  preferences?: RoutePreferences;
}

/** Public route result returned by the Gapwise routing engine. */
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

/** Optional student preferences used by deterministic gap planning. */
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

/** Input for planning one explicitly supplied free interval. */
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

/** One ranked activity recommendation produced by gap planning. */
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

/** Deterministic assessment of how an available interval can be used. */
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

/** Complete result of planning an explicitly supplied campus gap. */
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

/** Pagination metadata returned by list endpoints. */
export interface Pagination {
  limit: number;
  offset: number;
  count: number;
  total: number;
  nextOffset: number | null;
}

/** Metadata included with every successful public API response. */
export interface ResponseMeta {
  apiVersion: ApiVersion;
  dataVersion: string;
  generatedAt?: string;
  requestId: string;
  pagination?: Pagination;
  filters?: Record<string, string>;
}

/** Paginated collection returned by a list operation. */
export interface Collection<T> {
  data: T[];
  meta: ResponseMeta & { pagination: Pagination };
}

/** API discovery metadata returned by {@link Gapwise.info}. */
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

/** Optional filters and pagination controls for listing buildings. */
export interface BuildingListOptions {
  q?: string;
  category?: BuildingCategory;
  limit?: number;
  offset?: number;
}

/** Optional filters and pagination controls for listing campus places. */
export interface PlaceListOptions {
  q?: string;
  kind?: PlaceKind;
  building?: string;
  openNow?: AvailabilityState;
  limit?: number;
  offset?: number;
}
