export type MiWayLiveFreshness = "fresh" | "stale";

export type MiWayArrivalState = "approaching" | "now";

export type MiWayLiveArrival = {
  tripId: string;
  routeId: string;
  stopId: string;
  arrivalTime: number;
  etaSeconds: number;
  state: MiWayArrivalState;
  hasVehicle: boolean;
};

export type MiWayLiveVehicle = {
  id: string;
  tripId: string;
  routeId: string;
  latitude: number;
  longitude: number;
  bearing: number | null;
  timestamp: number | null;
  arrivalTime: number;
  etaSeconds: number;
  state: MiWayArrivalState;
};

export type MiWayLiveSnapshot = {
  status: MiWayLiveFreshness;
  generatedAt: number;
  sourceTimestamp: number;
  arrivals: MiWayLiveArrival[];
  vehicles: MiWayLiveVehicle[];
};

export type MiWayLiveClientStatus = "idle" | "loading" | "fresh" | "stale" | "unavailable";
