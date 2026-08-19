export type VerificationStatus = "verified" | "inferred" | "unknown";
export type RouteMode = "fastest" | "prefer-indoor" | "step-free";
export type RouteStatus = "same-building" | "routed" | "approximate" | "unavailable";
export type RouteVerification = "verified" | "mixed" | "inferred" | "unavailable";
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
  status: RouteStatus;
  accuracy: string;
  totalDistanceMeters: number | null;
  indoorDistanceMeters: number | null;
  outdoorDistanceMeters: number | null;
  estimatedSeconds: number | null;
  floorChanges: number | null;
  warnings: string[];
  routeVerification: RouteVerification;
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

export interface BuildingListResponse {
  service: "gapwise-public-campus";
  buildings: Building[];
}

export interface BuildingResponse {
  service: "gapwise-public-campus";
  building: Building;
}

export interface RouteResponse {
  service: "gapwise-public-campus";
  route: RouteResult;
}

export interface GapPlanResponse {
  service: "gapwise-public-campus";
  gapPlan: {
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
  };
}

export interface GapwiseClientOptions {
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
}

export declare class GapwiseClient {
  readonly baseUrl: string;
  readonly fetch: typeof globalThis.fetch;
  constructor(options?: GapwiseClientOptions);
  buildings(): Promise<BuildingListResponse>;
  building(query: string): Promise<BuildingResponse>;
  route(input: RouteRequest): Promise<RouteResponse>;
  planGap(input: GapPlanRequest): Promise<GapPlanResponse>;
}

export declare function createGapwiseClient(options?: GapwiseClientOptions): GapwiseClient;
export declare const gapwise: GapwiseClient;
