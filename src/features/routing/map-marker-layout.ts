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
 * Stack classes vertically only when they belong to the same building and
 * project to effectively the same routed entrance. Distinct entrances in one
 * building remain at their own geographic anchors so an arrival-time marker is
 * not pulled away from the route endpoint merely because another class uses a
 * different door.
 *
 * Exact/same-entrance stacks remain chronological and stable across pan/zoom.
 * Different buildings are never relocated to solve cross-building collisions:
 * geographic truth remains more important than perfect label deconfliction at
 * extreme zoom levels.
 */
export function groupedVerticalMarkerOffsets(
  points: GroupedMarkerScreenPoint[],
  sameAnchorRadiusPx = 8,
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
    const clusters: number[][] = [];

    for (const pointIndex of indices) {
      const point = points[pointIndex]!;
      const cluster = clusters.find((candidate) => {
        const anchor = points[candidate[0]!]!;
        return Math.hypot(point.x - anchor.x, point.y - anchor.y) <= sameAnchorRadiusPx;
      });
      if (cluster) cluster.push(pointIndex);
      else clusters.push([pointIndex]);
    }

    for (const cluster of clusters) {
      const orderedIndices = [...cluster].sort((a, b) => {
        const orderDifference = points[a]!.order - points[b]!.order;
        return orderDifference === 0 ? a - b : orderDifference;
      });

      orderedIndices.forEach((pointIndex, slot) => {
        const stackOffsetY = (slot - (orderedIndices.length - 1) / 2) * stackSpacingPx;
        offsets[pointIndex] = [0, stackOffsetY];
      });
    }
  }

  return offsets;
}
