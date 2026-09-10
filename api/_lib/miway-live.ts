import { decodeGtfsRealtimeFeed } from "../../src/server/gtfs-realtime-lite.js";
import type {
  MiWayLiveArrival,
  MiWayLiveSnapshot,
  MiWayLiveVehicle,
} from "../../src/features/transit/miway-live-types.js";
import { jsonResponse, logEvent, safeError } from "./observability.js";

const VEHICLE_POSITIONS_URL = "https://www.miapp.ca/GTFS_RT/Vehicle/VehiclePositions.pb";
const TRIP_UPDATES_URL = "https://www.miapp.ca/GTFS_RT/TripUpdate/TripUpdates.pb";
const UTM_STOP_IDS = new Set(["0910", "0490", "4800"]);
const UPSTREAM_TIMEOUT_MS = 2_500;
const MAX_UPSTREAM_BYTES = 8 * 1024 * 1024;
const MAX_ARRIVAL_SECONDS = 40 * 60;
const MAX_VISIBLE_VEHICLE_SECONDS = 30 * 60;
const NOW_WINDOW_SECONDS = 75;
const FRESH_SECONDS = 90;
const RESPONSE_CACHE = "public, max-age=0, s-maxage=4, stale-while-revalidate=12";

const LIVE_BOUNDS = {
  west: -79.72,
  east: -79.58,
  south: 43.5,
  north: 43.61,
};

type UpcomingTrip = Omit<MiWayLiveArrival, "hasVehicle">;

function inLiveBounds(longitude: number, latitude: number) {
  return (
    longitude >= LIVE_BOUNDS.west &&
    longitude <= LIVE_BOUNDS.east &&
    latitude >= LIVE_BOUNDS.south &&
    latitude <= LIVE_BOUNDS.north
  );
}

async function fetchFeed(url: string) {
  const response = await fetch(url, {
    method: "GET",
    redirect: "follow",
    cache: "no-store",
    headers: {
      accept: "application/protocol-buffer, application/x-protobuf, application/octet-stream",
      "user-agent": "Gapwise/1.0 (+https://gapwise.ca)",
    },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`MiWay feed returned HTTP ${response.status}`);
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_UPSTREAM_BYTES) {
    throw new Error("MiWay feed exceeded the configured size limit");
  }
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_UPSTREAM_BYTES) {
    throw new Error("MiWay feed exceeded the configured size limit");
  }
  return decodeGtfsRealtimeFeed(new Uint8Array(buffer));
}

function eventTime(update: {
  arrival: { time: number | null } | null;
  departure: { time: number | null } | null;
}) {
  return update.arrival?.time ?? update.departure?.time ?? null;
}

function buildUpcomingTrips(
  tripFeed: ReturnType<typeof decodeGtfsRealtimeFeed>,
  now: number,
): UpcomingTrip[] {
  const byTrip = new Map<string, UpcomingTrip>();

  for (const tripUpdate of tripFeed.tripUpdates) {
    const tripId = tripUpdate.trip.tripId;
    const routeId = tripUpdate.trip.routeId;
    if (!tripId || !routeId) continue;

    for (const stopUpdate of tripUpdate.stopTimeUpdates) {
      if (!stopUpdate.stopId || !UTM_STOP_IDS.has(stopUpdate.stopId)) continue;
      const arrivalTime = eventTime(stopUpdate);
      if (arrivalTime === null) continue;
      const etaSeconds = arrivalTime - now;
      if (etaSeconds < -NOW_WINDOW_SECONDS || etaSeconds > MAX_ARRIVAL_SECONDS) continue;

      const candidate: UpcomingTrip = {
        tripId,
        routeId,
        stopId: stopUpdate.stopId,
        arrivalTime,
        etaSeconds,
        state: etaSeconds <= NOW_WINDOW_SECONDS ? "now" : "approaching",
      };
      const existing = byTrip.get(tripId);
      if (!existing || candidate.arrivalTime < existing.arrivalTime) byTrip.set(tripId, candidate);
    }
  }

  return [...byTrip.values()]
    .sort((left, right) => left.arrivalTime - right.arrivalTime)
    .slice(0, 16);
}

function buildSnapshot(
  vehicleFeed: ReturnType<typeof decodeGtfsRealtimeFeed>,
  tripFeed: ReturnType<typeof decodeGtfsRealtimeFeed>,
  now: number,
): MiWayLiveSnapshot {
  const upcoming = buildUpcomingTrips(tripFeed, now);
  const upcomingByTrip = new Map(upcoming.map((arrival) => [arrival.tripId, arrival]));
  const vehicles: MiWayLiveVehicle[] = [];
  const vehicleTripIds = new Set<string>();

  for (const position of vehicleFeed.vehicles) {
    const tripId = position.trip.tripId;
    const arrival = tripId ? upcomingByTrip.get(tripId) : undefined;
    if (
      !tripId ||
      !arrival ||
      arrival.etaSeconds > MAX_VISIBLE_VEHICLE_SECONDS ||
      position.latitude === null ||
      position.longitude === null ||
      !Number.isFinite(position.latitude) ||
      !Number.isFinite(position.longitude) ||
      !inLiveBounds(position.longitude, position.latitude)
    ) {
      continue;
    }

    const routeId = position.trip.routeId || arrival.routeId;
    vehicles.push({
      id: position.vehicleId || tripId,
      tripId,
      routeId,
      latitude: position.latitude,
      longitude: position.longitude,
      bearing:
        position.bearing !== null && Number.isFinite(position.bearing) ? position.bearing : null,
      timestamp: position.timestamp,
      arrivalTime: arrival.arrivalTime,
      etaSeconds: arrival.etaSeconds,
      state: arrival.state,
    });
    vehicleTripIds.add(tripId);
  }

  const arrivals: MiWayLiveArrival[] = upcoming.map((arrival) => ({
    ...arrival,
    hasVehicle: vehicleTripIds.has(arrival.tripId),
  }));

  const fallbackVehicleTimestamp = vehicleFeed.vehicles.reduce<number | null>(
    (latest, vehicle) =>
      vehicle.timestamp !== null && (latest === null || vehicle.timestamp > latest)
        ? vehicle.timestamp
        : latest,
    null,
  );
  const fallbackTripTimestamp = tripFeed.tripUpdates.reduce<number | null>(
    (latest, update) =>
      update.timestamp !== null && (latest === null || update.timestamp > latest)
        ? update.timestamp
        : latest,
    null,
  );
  const vehicleTimestamp = vehicleFeed.timestamp ?? fallbackVehicleTimestamp;
  const tripTimestamp = tripFeed.timestamp ?? fallbackTripTimestamp;
  const timestamps = [vehicleTimestamp, tripTimestamp].filter(
    (value): value is number => value !== null && Number.isFinite(value) && value > 0,
  );
  const sourceTimestamp = timestamps.length > 0 ? Math.min(...timestamps) : now;

  return {
    status: now - sourceTimestamp <= FRESH_SECONDS ? "fresh" : "stale",
    generatedAt: now,
    sourceTimestamp,
    arrivals,
    vehicles: vehicles.slice(0, 16),
  };
}

export async function fetchMiWayLive(request: Request, requestId: string) {
  const started = performance.now();
  try {
    const [vehicleFeed, tripFeed] = await Promise.all([
      fetchFeed(VEHICLE_POSITIONS_URL),
      fetchFeed(TRIP_UPDATES_URL),
    ]);
    const snapshot = buildSnapshot(vehicleFeed, tripFeed, Math.floor(Date.now() / 1000));
    logEvent(snapshot.status === "fresh" ? "info" : "warn", "miway_live_refresh", {
      requestId,
      status: snapshot.status,
      durationMs: Math.round(performance.now() - started),
      arrivals: snapshot.arrivals.length,
      vehicles: snapshot.vehicles.length,
      sourceAgeSeconds: snapshot.generatedAt - snapshot.sourceTimestamp,
    });
    if (request.method === "HEAD") {
      return new Response(null, {
        status: 200,
        headers: {
          "cache-control": RESPONSE_CACHE,
          "x-content-type-options": "nosniff",
          "x-request-id": requestId,
          "referrer-policy": "no-referrer",
        },
      });
    }
    return jsonResponse(requestId, snapshot, 200, RESPONSE_CACHE);
  } catch (error) {
    logEvent("warn", "miway_live_unavailable", {
      requestId,
      durationMs: Math.round(performance.now() - started),
      error: safeError(error),
    });
    return jsonResponse(
      requestId,
      { status: "unavailable", generatedAt: Math.floor(Date.now() / 1000) },
      503,
      "public, max-age=0, s-maxage=5, stale-while-revalidate=10",
    );
  }
}
