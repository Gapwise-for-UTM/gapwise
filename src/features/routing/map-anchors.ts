export type MapCoordinate = [number, number];

export type MapAnchorSegment = {
  id: string;
  fromId: string;
  toId: string;
  coordinates: readonly MapCoordinate[];
};

export type ResolvedMapAnchor = {
  coordinate: MapCoordinate;
  source: "selected-route" | "outgoing-route" | "incoming-route" | "fallback";
};

function segmentEndpoint(
  segment: MapAnchorSegment,
  stopIds: ReadonlySet<string>,
): MapCoordinate | null {
  if (stopIds.has(segment.fromId)) return segment.coordinates[0] ?? null;
  if (stopIds.has(segment.toId)) return segment.coordinates.at(-1) ?? null;
  return null;
}

function incomingEndpoint(
  stopId: string,
  segments: readonly MapAnchorSegment[],
): MapCoordinate | null {
  const incoming = segments.find(
    (segment) => segment.toId === stopId && segment.coordinates.length > 0,
  );
  return incoming?.coordinates.at(-1) ?? null;
}

function outgoingEndpoint(
  stopId: string,
  segments: readonly MapAnchorSegment[],
): MapCoordinate | null {
  const outgoing = segments.find(
    (segment) => segment.fromId === stopId && segment.coordinates.length > 0,
  );
  return outgoing?.coordinates[0] ?? null;
}

/**
 * A timetable class time belongs to the entrance the student reaches. When an
 * incoming routed segment exists, anchor the class marker to that segment's
 * destination endpoint. If the class is the first routed stop and has no
 * incoming segment, use its outgoing route's origin endpoint instead.
 *
 * This deliberately keeps a class marker stable when the next transition leaves
 * the same building through a different entrance. Gapwise does not invent a
 * straight indoor connector between those entrances when the indoor path is not
 * mapped; the outgoing route simply begins at its own verified/mapped endpoint.
 *
 * Synthetic multi-id stops (for example a campus arrival/departure anchor) keep
 * the selected-route behavior so a shared commute marker can follow the active
 * route endpoint.
 */
export function resolveMapAnchor(
  stopIds: string | readonly string[],
  fallback: MapCoordinate,
  segments: readonly MapAnchorSegment[],
  selectedSegmentId: string | null,
): ResolvedMapAnchor {
  if (typeof stopIds === "string") {
    const incoming = incomingEndpoint(stopIds, segments);
    if (incoming) return { coordinate: incoming, source: "incoming-route" };

    const outgoing = outgoingEndpoint(stopIds, segments);
    if (outgoing) return { coordinate: outgoing, source: "outgoing-route" };

    return { coordinate: fallback, source: "fallback" };
  }

  const ids = new Set(stopIds);
  const selected = segments.find((segment) => segment.id === selectedSegmentId);
  if (selected) {
    const coordinate = segmentEndpoint(selected, ids);
    if (coordinate) return { coordinate, source: "selected-route" };
  }

  const outgoing = segments.find(
    (segment) => ids.has(segment.fromId) && segment.coordinates.length > 0,
  );
  if (outgoing) return { coordinate: outgoing.coordinates[0]!, source: "outgoing-route" };

  const incoming = segments.find(
    (segment) => ids.has(segment.toId) && segment.coordinates.length > 0,
  );
  if (incoming) return { coordinate: incoming.coordinates.at(-1)!, source: "incoming-route" };

  return { coordinate: fallback, source: "fallback" };
}
