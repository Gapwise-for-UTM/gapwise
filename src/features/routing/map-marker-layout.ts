export type MarkerScreenPoint = { x: number; y: number };
export type MarkerPixelOffset = [x: number, y: number];
export type GroupedMarkerScreenPoint = MarkerScreenPoint & {
  groupKey: string;
  order: number;
};

function ringOffsets(ring: number, spacing: number): MarkerPixelOffset[] {
  if (ring === 0) return [[0, 0]];
  const r = ring * spacing;
  const offsets: MarkerPixelOffset[] = [
    [0, -r],
    [r, 0],
    [0, r],
    [-r, 0],
    [r, -r],
    [r, r],
    [-r, r],
    [-r, -r],
  ];
  for (let step = 1; step < ring; step += 1) {
    const delta = step * spacing;
    offsets.push(
      [delta, -r],
      [r, delta],
      [-delta, r],
      [-r, -delta],
      [-delta, -r],
      [r, -delta],
      [delta, r],
      [-r, delta],
    );
  }
  return offsets;
}

/**
 * Deterministically place marker centres so no pair is closer than minSeparationPx.
 * This remains available for generic point-marker layouts that are not tied to
 * timetable building semantics.
 */
export function collisionFreeMarkerOffsets(
  points: MarkerScreenPoint[],
  minSeparationPx = 76,
  spacingPx = 60,
): MarkerPixelOffset[] {
  const placed: MarkerScreenPoint[] = [];
  return points.map((point) => {
    for (let ring = 0; ; ring += 1) {
      for (const offset of ringOffsets(ring, spacingPx)) {
        const candidate = { x: point.x + offset[0], y: point.y + offset[1] };
        const clear = placed.every(
          (other) => Math.hypot(candidate.x - other.x, candidate.y - other.y) >= minSeparationPx,
        );
        if (clear) {
          placed.push(candidate);
          return offset;
        }
      }
    }
  });
}

/**
 * Stack classes in the same building vertically in chronological order while
 * leaving every building at its authoritative geographic anchor. We deliberately
 * do not move whole building groups to avoid cross-building label collisions:
 * geographic truth is more important than label deconfliction at extreme zoom.
 *
 * With stable building anchors this layout is independent of pan/zoom projection,
 * which also removes the expensive ring-search work formerly performed while the
 * map was moving.
 */
export function groupedVerticalMarkerOffsets(
  points: GroupedMarkerScreenPoint[],
  _minGroupSeparationPx = 92,
  _groupSpacingPx = 72,
  stackSpacingPx = 44,
): MarkerPixelOffset[] {
  const groups = new Map<string, number[]>();
  points.forEach((point, index) => {
    const indices = groups.get(point.groupKey) ?? [];
    indices.push(index);
    groups.set(point.groupKey, indices);
  });

  const offsets: MarkerPixelOffset[] = points.map(() => [0, 0]);

  for (const indices of groups.values()) {
    const orderedIndices = [...indices].sort((a, b) => {
      const orderDifference = points[a]!.order - points[b]!.order;
      return orderDifference === 0 ? a - b : orderDifference;
    });

    orderedIndices.forEach((pointIndex, slot) => {
      const stackOffsetY = (slot - (orderedIndices.length - 1) / 2) * stackSpacingPx;
      offsets[pointIndex] = [0, stackOffsetY];
    });
  }

  return offsets;
}
