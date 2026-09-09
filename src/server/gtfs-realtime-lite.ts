type TripDescriptor = {
  tripId: string | null;
  routeId: string | null;
};

type StopTimeEvent = {
  time: number | null;
};

export type DecodedStopTimeUpdate = {
  stopId: string | null;
  stopSequence: number | null;
  arrival: StopTimeEvent | null;
  departure: StopTimeEvent | null;
};

export type DecodedTripUpdate = {
  trip: TripDescriptor;
  timestamp: number | null;
  stopTimeUpdates: DecodedStopTimeUpdate[];
};

export type DecodedVehiclePosition = {
  trip: TripDescriptor;
  vehicleId: string | null;
  latitude: number | null;
  longitude: number | null;
  bearing: number | null;
  timestamp: number | null;
  stopId: string | null;
  currentStatus: number | null;
};

export type DecodedGtfsRealtimeFeed = {
  timestamp: number | null;
  tripUpdates: DecodedTripUpdate[];
  vehicles: DecodedVehiclePosition[];
};

const textDecoder = new TextDecoder();

class ProtoReader {
  readonly data: Uint8Array;
  offset: number;
  readonly end: number;

  constructor(data: Uint8Array, offset = 0, end = data.byteLength) {
    this.data = data;
    this.offset = offset;
    this.end = end;
  }

  get done() {
    return this.offset >= this.end;
  }

  readVarint(): bigint {
    let result = 0n;
    let shift = 0n;
    for (let index = 0; index < 10; index += 1) {
      if (this.offset >= this.end) throw new Error("Unexpected end of protobuf varint");
      const byte = this.data[this.offset++]!;
      result |= BigInt(byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) return result;
      shift += 7n;
    }
    throw new Error("Protobuf varint exceeds 10 bytes");
  }

  readUint32() {
    return Number(this.readVarint() & 0xffff_ffffn);
  }

  readUint64Number() {
    const value = this.readVarint();
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Protobuf uint64 exceeds safe range");
    return Number(value);
  }

  readString() {
    const bytes = this.readBytes();
    return textDecoder.decode(bytes);
  }

  readBytes() {
    const length = this.readUint32();
    const next = this.offset + length;
    if (next > this.end) throw new Error("Protobuf length-delimited field exceeds message bounds");
    const value = this.data.subarray(this.offset, next);
    this.offset = next;
    return value;
  }

  readMessage() {
    const length = this.readUint32();
    const next = this.offset + length;
    if (next > this.end) throw new Error("Nested protobuf message exceeds message bounds");
    const reader = new ProtoReader(this.data, this.offset, next);
    this.offset = next;
    return reader;
  }

  readFloat32() {
    if (this.offset + 4 > this.end) throw new Error("Unexpected end of protobuf float");
    const view = new DataView(this.data.buffer, this.data.byteOffset + this.offset, 4);
    const value = view.getFloat32(0, true);
    this.offset += 4;
    return value;
  }

  skip(wireType: number) {
    if (wireType === 0) {
      this.readVarint();
      return;
    }
    if (wireType === 1) {
      this.offset += 8;
    } else if (wireType === 2) {
      const length = this.readUint32();
      this.offset += length;
    } else if (wireType === 5) {
      this.offset += 4;
    } else {
      throw new Error(`Unsupported protobuf wire type ${wireType}`);
    }
    if (this.offset > this.end) throw new Error("Protobuf field exceeds message bounds");
  }
}

function nextField(reader: ProtoReader) {
  const tag = reader.readUint32();
  if (tag === 0) throw new Error("Invalid protobuf field tag 0");
  return { number: tag >>> 3, wireType: tag & 0x07 };
}

function parseTripDescriptor(reader: ProtoReader): TripDescriptor {
  const trip: TripDescriptor = { tripId: null, routeId: null };
  while (!reader.done) {
    const field = nextField(reader);
    if (field.number === 1 && field.wireType === 2) trip.tripId = reader.readString();
    else if (field.number === 5 && field.wireType === 2) trip.routeId = reader.readString();
    else reader.skip(field.wireType);
  }
  return trip;
}

function parseStopTimeEvent(reader: ProtoReader): StopTimeEvent {
  let time: number | null = null;
  while (!reader.done) {
    const field = nextField(reader);
    if (field.number === 2 && field.wireType === 0) time = reader.readUint64Number();
    else reader.skip(field.wireType);
  }
  return { time };
}

function parseStopTimeUpdate(reader: ProtoReader): DecodedStopTimeUpdate {
  const update: DecodedStopTimeUpdate = {
    stopId: null,
    stopSequence: null,
    arrival: null,
    departure: null,
  };
  while (!reader.done) {
    const field = nextField(reader);
    if (field.number === 1 && field.wireType === 0) update.stopSequence = reader.readUint32();
    else if (field.number === 2 && field.wireType === 2)
      update.arrival = parseStopTimeEvent(reader.readMessage());
    else if (field.number === 3 && field.wireType === 2)
      update.departure = parseStopTimeEvent(reader.readMessage());
    else if (field.number === 4 && field.wireType === 2) update.stopId = reader.readString();
    else reader.skip(field.wireType);
  }
  return update;
}

function parseTripUpdate(reader: ProtoReader): DecodedTripUpdate {
  const update: DecodedTripUpdate = {
    trip: { tripId: null, routeId: null },
    timestamp: null,
    stopTimeUpdates: [],
  };
  while (!reader.done) {
    const field = nextField(reader);
    if (field.number === 1 && field.wireType === 2)
      update.trip = parseTripDescriptor(reader.readMessage());
    else if (field.number === 2 && field.wireType === 2)
      update.stopTimeUpdates.push(parseStopTimeUpdate(reader.readMessage()));
    else if (field.number === 4 && field.wireType === 0) update.timestamp = reader.readUint64Number();
    else reader.skip(field.wireType);
  }
  return update;
}

function parsePosition(reader: ProtoReader) {
  let latitude: number | null = null;
  let longitude: number | null = null;
  let bearing: number | null = null;
  while (!reader.done) {
    const field = nextField(reader);
    if (field.number === 1 && field.wireType === 5) latitude = reader.readFloat32();
    else if (field.number === 2 && field.wireType === 5) longitude = reader.readFloat32();
    else if (field.number === 3 && field.wireType === 5) bearing = reader.readFloat32();
    else reader.skip(field.wireType);
  }
  return { latitude, longitude, bearing };
}

function parseVehicleDescriptor(reader: ProtoReader) {
  let id: string | null = null;
  while (!reader.done) {
    const field = nextField(reader);
    if (field.number === 1 && field.wireType === 2) id = reader.readString();
    else reader.skip(field.wireType);
  }
  return id;
}

function parseVehiclePosition(reader: ProtoReader): DecodedVehiclePosition {
  const vehicle: DecodedVehiclePosition = {
    trip: { tripId: null, routeId: null },
    vehicleId: null,
    latitude: null,
    longitude: null,
    bearing: null,
    timestamp: null,
    stopId: null,
    currentStatus: null,
  };
  while (!reader.done) {
    const field = nextField(reader);
    if (field.number === 1 && field.wireType === 2)
      vehicle.trip = parseTripDescriptor(reader.readMessage());
    else if (field.number === 2 && field.wireType === 2)
      Object.assign(vehicle, parsePosition(reader.readMessage()));
    else if (field.number === 4 && field.wireType === 0) vehicle.currentStatus = reader.readUint32();
    else if (field.number === 5 && field.wireType === 0) vehicle.timestamp = reader.readUint64Number();
    else if (field.number === 7 && field.wireType === 2) vehicle.stopId = reader.readString();
    else if (field.number === 8 && field.wireType === 2)
      vehicle.vehicleId = parseVehicleDescriptor(reader.readMessage());
    else reader.skip(field.wireType);
  }
  return vehicle;
}

function parseHeader(reader: ProtoReader) {
  let timestamp: number | null = null;
  while (!reader.done) {
    const field = nextField(reader);
    if (field.number === 3 && field.wireType === 0) timestamp = reader.readUint64Number();
    else reader.skip(field.wireType);
  }
  return timestamp;
}

function parseEntity(
  reader: ProtoReader,
  tripUpdates: DecodedTripUpdate[],
  vehicles: DecodedVehiclePosition[],
) {
  while (!reader.done) {
    const field = nextField(reader);
    if (field.number === 3 && field.wireType === 2)
      tripUpdates.push(parseTripUpdate(reader.readMessage()));
    else if (field.number === 4 && field.wireType === 2)
      vehicles.push(parseVehiclePosition(reader.readMessage()));
    else reader.skip(field.wireType);
  }
}

export function decodeGtfsRealtimeFeed(bytes: Uint8Array): DecodedGtfsRealtimeFeed {
  const reader = new ProtoReader(bytes);
  const tripUpdates: DecodedTripUpdate[] = [];
  const vehicles: DecodedVehiclePosition[] = [];
  let timestamp: number | null = null;

  while (!reader.done) {
    const field = nextField(reader);
    if (field.number === 1 && field.wireType === 2) timestamp = parseHeader(reader.readMessage());
    else if (field.number === 2 && field.wireType === 2)
      parseEntity(reader.readMessage(), tripUpdates, vehicles);
    else reader.skip(field.wireType);
  }

  return { timestamp, tripUpdates, vehicles };
}
