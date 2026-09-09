const VEHICLE_POSITIONS_URL = "https://www.miapp.ca/GTFS_RT/Vehicle/VehiclePositions.pb";
const TRIP_UPDATES_URL = "https://www.miapp.ca/GTFS_RT/TripUpdate/TripUpdates.pb";
const UPSTREAM_TIMEOUT_MS = 4_500;
const SHARED_CACHE_MS = 4_000;
const MAX_FEED_BYTES = 2_000_000;
const MAX_VEHICLES = 96;
const MAX_DISTANCE_FROM_UTM_KM = 12;
const UTM_CENTER = { lat: 43.5483, lng: -79.6627 };
const UTM_ROUTE_IDS = new Set(["1", "44", "48", "101", "110", "126"]);
const UTM_STOP_IDS = new Set(["0991", "0910", "0490", "4800"]);

type WireValue = number | bigint | Uint8Array;
type WireField = { field: number; wire: number; value: WireValue };
type TripDescriptor = {
  tripId: string | undefined;
  routeId: string | undefined;
  directionId: number | undefined;
};
type StopPrediction = {
  stopId: string | undefined;
  arrival: number | undefined;
  departure: number | undefined;
};
type TripUpdate = {
  trip: TripDescriptor;
  timestamp: number | undefined;
  stops: StopPrediction[];
};
type VehicleDescriptor = { id: string | undefined; label: string | undefined };
type VehiclePosition = {
  trip: TripDescriptor;
  vehicleId: string | undefined;
  label: string | undefined;
  lat: number | undefined;
  lng: number | undefined;
  bearing: number | undefined;
  speed: number | undefined;
  timestamp: number | undefined;
  stopId: string | undefined;
  currentStatus: number | undefined;
};
type ParsedFeed<T> = { timestamp: number | undefined; items: T[] };

export type MiWaySnapshot = {
  status: "live" | "stale" | "unavailable";
  generatedAt: string;
  sourceObservedAt: string | null;
  vehicles: Array<{
    id: string;
    route: string;
    tripId: string | null;
    label: string | null;
    lat: number;
    lng: number;
    bearing: number | null;
    speedMps: number | null;
    observedAt: string | null;
    utmEtaSeconds: number | null;
    atUtm: boolean;
  }>;
};

const EMPTY_TRIP: TripDescriptor = {
  tripId: undefined,
  routeId: undefined,
  directionId: undefined,
};
const MISSING_FIELD: WireField = { field: 0, wire: -1, value: 0 };
let cachedSnapshot: { expiresAt: number; pending: Promise<MiWaySnapshot> } | null = null;

function readVarint(bytes: Uint8Array, offset: number): { value: bigint; offset: number } {
  let value = 0n;
  let shift = 0n;
  while (offset < bytes.length && shift <= 63n) {
    const byte = bytes[offset++]!;
    value |= BigInt(byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) return { value, offset };
    shift += 7n;
  }
  throw new Error("Invalid protobuf varint.");
}

function fields(bytes: Uint8Array): WireField[] {
  const result: WireField[] = [];
  let offset = 0;
  while (offset < bytes.length) {
    const key = readVarint(bytes, offset);
    offset = key.offset;
    const field = Number(key.value >> 3n);
    const wire = Number(key.value & 7n);
    if (field <= 0) throw new Error("Invalid protobuf field.");
    if (wire === 0) {
      const item = readVarint(bytes, offset);
      offset = item.offset;
      result.push({ field, wire, value: item.value });
      continue;
    }
    if (wire === 1) {
      if (offset + 8 > bytes.length) throw new Error("Truncated protobuf fixed64.");
      result.push({ field, wire, value: bytes.slice(offset, offset + 8) });
      offset += 8;
      continue;
    }
    if (wire === 2) {
      const length = readVarint(bytes, offset);
      offset = length.offset;
      const size = Number(length.value);
      if (!Number.isSafeInteger(size) || size < 0 || offset + size > bytes.length) {
        throw new Error("Invalid protobuf length.");
      }
      result.push({ field, wire, value: bytes.slice(offset, offset + size) });
      offset += size;
      continue;
    }
    if (wire === 5) {
      if (offset + 4 > bytes.length) throw new Error("Truncated protobuf fixed32.");
      result.push({ field, wire, value: bytes.slice(offset, offset + 4) });
      offset += 4;
      continue;
    }
    throw new Error(`Unsupported protobuf wire type ${wire}.`);
  }
  return result;
}

const textDecoder = new TextDecoder();

function nested(field: WireField): Uint8Array | null {
  return field.wire === 2 && field.value instanceof Uint8Array ? field.value : null;
}

function nestedField(list: WireField[], id: number): Uint8Array | null {
  return nested(list.find((field) => field.field === id) ?? MISSING_FIELD);
}

function stringField(list: WireField[], id: number): string | undefined {
  const bytes = nestedField(list, id);
  return bytes ? textDecoder.decode(bytes) : undefined;
}

function numberField(list: WireField[], id: number): number | undefined {
  const value = list.find((field) => field.field === id && field.wire === 0);
  return value && typeof value.value === "bigint" ? Number(value.value) : undefined;
}

function floatField(list: WireField[], id: number): number | undefined {
  const value = list.find((field) => field.field === id && field.wire === 5);
  if (!value || !(value.value instanceof Uint8Array)) return undefined;
  return new DataView(value.value.buffer, value.value.byteOffset, 4).getFloat32(0, true);
}

function tripDescriptor(bytes: Uint8Array): TripDescriptor {
  const list = fields(bytes);
  return {
    tripId: stringField(list, 1),
    routeId: stringField(list, 5),
    directionId: numberField(list, 6),
  };
}

function stopEvent(bytes: Uint8Array): number | undefined {
  const value = numberField(fields(bytes), 2);
  return Number.isFinite(value) ? value : undefined;
}

function tripUpdate(bytes: Uint8Array): TripUpdate {
  const list = fields(bytes);
  const tripBytes = nestedField(list, 1);
  const stops = list
    .filter((field) => field.field === 2)
    .map(nested)
    .filter((value): value is Uint8Array => value !== null)
    .map((value): StopPrediction => {
      const stopFields = fields(value);
      const arrivalBytes = nestedField(stopFields, 2);
      const departureBytes = nestedField(stopFields, 3);
      return {
        stopId: stringField(stopFields, 4),
        arrival: arrivalBytes ? stopEvent(arrivalBytes) : undefined,
        departure: departureBytes ? stopEvent(departureBytes) : undefined,
      };
    });
  return {
    trip: tripBytes ? tripDescriptor(tripBytes) : EMPTY_TRIP,
    stops,
    timestamp: numberField(list, 4),
  };
}

function vehicleDescriptor(bytes: Uint8Array): VehicleDescriptor {
  const list = fields(bytes);
  return { id: stringField(list, 1), label: stringField(list, 2) };
}

function vehiclePosition(bytes: Uint8Array): VehiclePosition {
  const list = fields(bytes);
  const tripBytes = nestedField(list, 1);
  const positionBytes = nestedField(list, 2);
  const vehicleBytes = nestedField(list, 8);
  const position = positionBytes ? fields(positionBytes) : [];
  const vehicle: VehicleDescriptor = vehicleBytes
    ? vehicleDescriptor(vehicleBytes)
    : { id: undefined, label: undefined };
  return {
    trip: tripBytes ? tripDescriptor(tripBytes) : EMPTY_TRIP,
    vehicleId: vehicle.id,
    label: vehicle.label,
    lat: floatField(position, 1),
    lng: floatField(position, 2),
    bearing: floatField(position, 3),
    speed: floatField(position, 5),
    timestamp: numberField(list, 5),
    currentStatus: numberField(list, 4),
    stopId: stringField(list, 7),
  };
}

function feedEntities(bytes: Uint8Array): {
  timestamp: number | undefined;
  entities: WireField[][];
} {
  const list = fields(bytes);
  const headerBytes = nestedField(list, 1);
  return {
    timestamp: headerBytes ? numberField(fields(headerBytes), 3) : undefined,
    entities: list
      .filter((field) => field.field === 2)
      .map(nested)
      .filter((value): value is Uint8Array => value !== null)
      .map(fields),
  };
}

function parseVehicleFeed(bytes: Uint8Array): ParsedFeed<VehiclePosition> {
  const feed = feedEntities(bytes);
  return {
    timestamp: feed.timestamp,
    items: feed.entities
      .map((entity) => nestedField(entity, 4))
      .filter((value): value is Uint8Array => value !== null)
      .map(vehiclePosition),
  };
}

function parseTripFeed(bytes: Uint8Array): ParsedFeed<TripUpdate> {
  const feed = feedEntities(bytes);
  return {
    timestamp: feed.timestamp,
    items: feed.entities
      .map((entity) => nestedField(entity, 3))
      .filter((value): value is Uint8Array => value !== null)
      .map(tripUpdate),
  };
}

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const toRad = Math.PI / 180;
  const dLat = (bLat - aLat) * toRad;
  const dLng = (bLng - aLng) * toRad;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(aLat * toRad) * Math.cos(bLat * toRad) * sinLng * sinLng;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

async function fetchBytes(url: string, signal: AbortSignal): Promise<Uint8Array> {
  const response = await fetch(url, {
    signal,
    headers: {
      Accept: "application/x-protobuf, application/protobuf, application/octet-stream",
      "User-Agent": "Gapwise/1.0 (+https://gapwise.ca)",
    },
  });
  if (!response.ok) throw new Error(`MiWay realtime feed returned ${response.status}.`);
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > MAX_FEED_BYTES) throw new Error("MiWay realtime feed exceeded the size limit.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_FEED_BYTES) {
    throw new Error("MiWay realtime feed exceeded the size limit.");
  }
  return bytes;
}

async function buildSnapshot(): Promise<MiWaySnapshot> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const [vehicleBytes, tripBytes] = await Promise.all([
      fetchBytes(VEHICLE_POSITIONS_URL, controller.signal),
      fetchBytes(TRIP_UPDATES_URL, controller.signal),
    ]);
    const vehicleFeed = parseVehicleFeed(vehicleBytes);
    const tripFeed = parseTripFeed(tripBytes);
    const updatesByTrip = new Map(
      tripFeed.items
        .filter((update) => update.trip.tripId)
        .map((update) => [update.trip.tripId!, update] as const),
    );
    const nowSeconds = Math.floor(Date.now() / 1000);
    const sourceTimestamp =
      Math.max(vehicleFeed.timestamp ?? 0, tripFeed.timestamp ?? 0) || undefined;
    const sourceAge = sourceTimestamp ? nowSeconds - sourceTimestamp : Infinity;
    const vehicles = vehicleFeed.items
      .map((vehicle) => ({
        vehicle,
        update: vehicle.trip.tripId ? updatesByTrip.get(vehicle.trip.tripId) : undefined,
      }))
      .map(({ vehicle, update }) => ({
        vehicle,
        update,
        routeId: vehicle.trip.routeId ?? update?.trip.routeId,
      }))
      .filter(
        ({ vehicle, routeId }) =>
          Boolean(
            routeId &&
              UTM_ROUTE_IDS.has(routeId) &&
              Number.isFinite(vehicle.lat) &&
              Number.isFinite(vehicle.lng) &&
              distanceKm(vehicle.lat!, vehicle.lng!, UTM_CENTER.lat, UTM_CENTER.lng) <=
                MAX_DISTANCE_FROM_UTM_KM,
          ),
      )
      .map(({ vehicle, update, routeId }) => {
        const utmStop = update?.stops.find(
          (stop) =>
            stop.stopId &&
            UTM_STOP_IDS.has(stop.stopId) &&
            (stop.arrival ?? stop.departure ?? 0) >= nowSeconds - 90,
        );
        const etaAt = utmStop?.arrival ?? utmStop?.departure;
        const eta = etaAt && etaAt >= nowSeconds - 90 ? Math.max(0, etaAt - nowSeconds) : null;
        const atUtm =
          (vehicle.stopId ? UTM_STOP_IDS.has(vehicle.stopId) : false) ||
          distanceKm(vehicle.lat!, vehicle.lng!, UTM_CENTER.lat, UTM_CENTER.lng) < 0.22;
        return {
          id:
            vehicle.vehicleId ??
            `${vehicle.trip.tripId ?? routeId}-${vehicle.label ?? "vehicle"}`,
          route: routeId!,
          tripId: vehicle.trip.tripId ?? null,
          label: vehicle.label ?? null,
          lat: vehicle.lat!,
          lng: vehicle.lng!,
          bearing: Number.isFinite(vehicle.bearing) ? vehicle.bearing! : null,
          speedMps: Number.isFinite(vehicle.speed) ? vehicle.speed! : null,
          observedAt: vehicle.timestamp
            ? new Date(vehicle.timestamp * 1000).toISOString()
            : null,
          utmEtaSeconds: eta,
          atUtm,
        };
      })
      .sort(
        (a, b) =>
          (a.utmEtaSeconds ?? Number.MAX_SAFE_INTEGER) -
          (b.utmEtaSeconds ?? Number.MAX_SAFE_INTEGER),
      )
      .slice(0, MAX_VEHICLES);
    return {
      status: sourceAge <= 45 ? "live" : sourceAge <= 120 ? "stale" : "unavailable",
      generatedAt: new Date().toISOString(),
      sourceObservedAt: sourceTimestamp ? new Date(sourceTimestamp * 1000).toISOString() : null,
      vehicles,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function getMiWaySnapshot(): Promise<MiWaySnapshot> {
  const now = Date.now();
  if (cachedSnapshot && cachedSnapshot.expiresAt > now) return cachedSnapshot.pending;
  const pending = buildSnapshot().catch((error) => {
    cachedSnapshot = null;
    throw error;
  });
  cachedSnapshot = { expiresAt: now + SHARED_CACHE_MS, pending };
  return pending;
}
