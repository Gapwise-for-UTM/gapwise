import { describe, expect, test } from "bun:test";
import { decodeGtfsRealtimeFeed } from "@/server/gtfs-realtime-lite";

function concat(...chunks: Uint8Array[]) {
  const result = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.byteLength, 0));
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

function varint(value: number | bigint) {
  let remaining = BigInt(value);
  const bytes: number[] = [];
  do {
    let byte = Number(remaining & 0x7fn);
    remaining >>= 7n;
    if (remaining > 0n) byte |= 0x80;
    bytes.push(byte);
  } while (remaining > 0n);
  return new Uint8Array(bytes);
}

function tag(field: number, wireType: number) {
  return varint((field << 3) | wireType);
}

function uintField(field: number, value: number) {
  return concat(tag(field, 0), varint(value));
}

function messageField(field: number, message: Uint8Array) {
  return concat(tag(field, 2), varint(message.byteLength), message);
}

function stringField(field: number, value: string) {
  return messageField(field, new TextEncoder().encode(value));
}

function floatField(field: number, value: number) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setFloat32(0, value, true);
  return concat(tag(field, 5), bytes);
}

function tripDescriptor() {
  return concat(stringField(1, "trip-110"), stringField(5, "110"));
}

function tripUpdate() {
  const event = uintField(2, 1_700_000_060);
  const stop = concat(
    uintField(1, 12),
    messageField(2, event),
    stringField(4, "0910"),
  );
  return concat(
    messageField(1, tripDescriptor()),
    messageField(2, stop),
    uintField(4, 1_700_000_000),
  );
}

function vehiclePosition() {
  const position = concat(
    floatField(1, 43.5483),
    floatField(2, -79.6635),
    floatField(3, 215),
  );
  const descriptor = stringField(1, "bus-123");
  return concat(
    messageField(1, tripDescriptor()),
    messageField(2, position),
    uintField(5, 1_700_000_000),
    messageField(8, descriptor),
  );
}

describe("GTFS realtime lite decoder", () => {
  test("decodes the trip, UTM stop update, and vehicle fields Gapwise uses", () => {
    const header = concat(stringField(1, "2.0"), uintField(3, 1_700_000_000));
    const tripEntity = concat(stringField(1, "trip"), messageField(3, tripUpdate()));
    const vehicleEntity = concat(stringField(1, "vehicle"), messageField(4, vehiclePosition()));
    const feed = concat(
      messageField(1, header),
      messageField(2, tripEntity),
      messageField(2, vehicleEntity),
    );

    const decoded = decodeGtfsRealtimeFeed(feed);
    expect(decoded.timestamp).toBe(1_700_000_000);
    expect(decoded.tripUpdates).toHaveLength(1);
    expect(decoded.tripUpdates[0]?.trip).toEqual({ tripId: "trip-110", routeId: "110" });
    expect(decoded.tripUpdates[0]?.stopTimeUpdates[0]).toEqual({
      stopId: "0910",
      stopSequence: 12,
      arrival: { time: 1_700_000_060 },
      departure: null,
    });
    expect(decoded.vehicles).toHaveLength(1);
    expect(decoded.vehicles[0]?.vehicleId).toBe("bus-123");
    expect(decoded.vehicles[0]?.trip.routeId).toBe("110");
    expect(decoded.vehicles[0]?.latitude).toBeCloseTo(43.5483, 4);
    expect(decoded.vehicles[0]?.longitude).toBeCloseTo(-79.6635, 4);
    expect(decoded.vehicles[0]?.bearing).toBeCloseTo(215, 1);
  });
});
