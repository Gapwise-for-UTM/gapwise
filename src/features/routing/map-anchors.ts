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

/**
 * Timetable class markers use their stable canonical building coordinate rather
 * than whichever route entrance happens to be active. Synthetic multi-id stops
 * (for example the campus arrival/departure anchor) may still follow route
 * endpoints so route geometry can meet those dedicated route markers exactly.
 */
export function resolveMapAnchor(
  stopIds: string | readonly string[],
  fallback: MapCoordinate,
  segments: readonly MapAnchorSegment[],
  selectedSegmentId: string | null,
): ResolvedMapAnchor {
  if (typeof stopIds === "string") {
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
