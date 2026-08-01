export type VerificationStatus = "verified" | "inferred" | "unknown";

export type SourceMetadata = {
  source: string;
  sourceUrl: string;
  lastVerified: string;
  verificationStatus: VerificationStatus;
};

export type RoutingNode = {
  id: string;
  kind:
    | "room"
    | "hallway"
    | "building-entrance"
    | "path-intersection"
    | "crosswalk"
    | "stairs"
    | "elevator"
    | "door";
  buildingCode: string | null;
  floor: string | null;
  longitude?: number;
  latitude?: number;
  indoorX?: number;
  indoorY?: number;
  room?: string;
  label?: string;
  metadata?: SourceMetadata;
};

export type RoutingEdge = {
  id: string;
  from: string;
  to: string;
  distanceMeters: number;
  environment: "indoor" | "outdoor" | "covered";
  accessible: boolean;
  stairs: boolean;
  bidirectional: boolean;
  estimatedDelaySeconds?: number;
  metadata?: SourceMetadata;
};

export type RoutePreferences = {
  mode: "fastest" | "prefer-indoor" | "step-free";
  walkingSpeedMps: number;
  transitionBufferMinutes: number;
};

export type RouteResult = {
  nodes: RoutingNode[];
  edges: RoutingEdge[];
  totalDistanceMeters: number;
  indoorDistanceMeters: number;
  outdoorDistanceMeters: number;
  estimatedSeconds: number;
  floorChanges: number;
  warnings: string[];
};

export type RoutingGraph = {
  nodes: RoutingNode[];
  edges: RoutingEdge[];
};

export type RouteAccuracy =
  | "Verified indoor + outdoor route"
  | "Verified outdoor route, indoor estimate"
  | "Approximate building-to-building estimate"
  | "Location unavailable";

export type TransitionRoute = {
  status: "routed" | "approximate" | "same-room" | "unavailable";
  message: string;
  accuracy: RouteAccuracy;
  result: RouteResult | null;
  displayCoordinates: [number, number][];
  warnings: string[];
  approximateDistanceMeters: number | null;
  approximateSeconds: number | null;
};
