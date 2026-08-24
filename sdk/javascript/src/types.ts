/** Contract types mirrored from public/openapi.json and checked by contract tests. */
export type VerificationStatus = "verified" | "inferred" | "unknown";
export type RouteMode = "fastest" | "prefer-indoor" | "step-free";
export type Term = "Fall" | "Winter" | "Summer";
export type Weekday = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday";
export interface Provenance {
  source: string;
  sourceUrl: string;
  lastVerified: string;
  verificationStatus: VerificationStatus;
}
export interface Building {
  code: string;
  name: string;
  category: "academic" | "residence" | "facility";
  aliases: string[];
  routingCoverage: "mapped" | "identity-only";
  entranceCount: number;
  verifiedEntranceCount: number;
  accessibility: "accessible" | "not_accessible" | "unknown";
  indoorRoomNodeCount: number;
  provenance: Provenance[];
}
export type CampusFactStatus =
  "verified" | "stale" | "inferred" | "user-reported" | "unavailable" | "unknown";
export interface CampusPlace {
  id: string;
  name: string;
  kind: "dining" | "study" | "library" | "service" | "recreation" | "amenity" | "facility";
  buildingCode: string;
  floorOrRoom?: string;
  summary: string;
  amenities: readonly string[];
  hoursProvenance: FactProvenance;
  metadataProvenance: FactProvenance;
}
export interface FactProvenance {
  sourceId: string;
  status: CampusFactStatus;
  observedAt: string;
  note?: string;
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
export interface CampusSource {
  id: string;
  name: string;
  url: string;
  retrievedAt: string;
  verificationStatus: VerificationStatus;
}
export interface RootResponse {
  service: string;
  version: "v1";
  dataVersion: string;
  documentation: string;
  openapi: string;
  privacy: string;
}
