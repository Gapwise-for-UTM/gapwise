export type MarkerScreenPoint = { x: number; y: number };
export type MarkerPixelOffset = [x: number, y: number];
export type GroupedMarkerScreenPoint = MarkerScreenPoint & {
  groupKey: string;
  order: number;
};

type StackPlacement = MarkerScreenPoint & {
  halfWidth: number;
  halfHeight: number;
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
 * The returned offsets are screen-pixel offsets from the geographic anchor, so the
 * geographic point remains authoritative while labels stay readable at every zoom.
 * Defaults leave enough room for the time pills used by the Day Route map.
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

function stackPlacementsDoNotOverlap(
  candidate: StackPlacement,
  placed: StackPlacement[],
  gapPx: number,
) {
  return placed.every((other) => {
    const horizontalClear =
      Math.abs(candidate.x - other.x) >= candidate.halfWidth + other.halfWidth + gapPx;
    const verticalClear =
      Math.abs(candidate.y - other.y) >= candidate.halfHeight + other.halfHeight + gapPx;
    return horizontalClear || verticalClear;
  });
}

/**
 * Keep every class in the same building on one vertical chronological stack while
 * still separating different building stacks. The group anchor is the average of
 * the projected class anchors, so multiple verified entrance/route points for one
 * building collapse into a single readable timetable stack without changing route
 * geometry itself. Group placement accounts for the full rendered stack rectangle,
 * not only the stack center, so tall same-building schedules cannot overlap nearby
 * building stacks.
 */
export function groupedVerticalMarkerOffsets(
  points: GroupedMarkerScreenPoint[],
  minGroupSeparationPx = 92,
  groupSpacingPx = 72,
  stackSpacingPx = 44,
  markerWidthPx = 64,
  markerHeightPx = 38,
  stackGapPx = 8,
): MarkerPixelOffset[] {
  const groups = new Map<string, number[]>();
  points.forEach((point, index) => {
    const indices = groups.get(point.groupKey) ?? [];
    indices.push(index);
    groups.set(point.groupKey, indices);
  });

  const entries = [...groups.entries()];
  const groupAnchors = entries.map(([, indices]) => {
    const total = indices.reduce(
      (acc, index) => ({
        x: acc.x + points[index]!.x,
        y: acc.y + points[index]!.y,
      }),
      { x: 0, y: 0 },
    );
    return { x: total.x / indices.length, y: total.y / indices.length };
  });
  const placedStacks: StackPlacement[] = [];
  const groupOffsets: MarkerPixelOffset[] = [];

  entries.forEach(([, indices], groupIndex) => {
    const anchor = groupAnchors[groupIndex]!;
    const halfWidth = markerWidthPx / 2;
    const halfHeight = (markerHeightPx + Math.max(0, indices.length - 1) * stackSpacingPx) / 2;

    for (let ring = 0; ; ring += 1) {
      let found = false;
      for (const offset of ringOffsets(ring, groupSpacingPx)) {
        const candidate: StackPlacement = {
          x: anchor.x + offset[0],
          y: anchor.y + offset[1],
          halfWidth,
          halfHeight,
        };
        const centersClear = placedStacks.every(
          (other) =>
            Math.hypot(candidate.x - other.x, candidate.y - other.y) >= minGroupSeparationPx,
        );
        if (centersClear && stackPlacementsDoNotOverlap(candidate, placedStacks, stackGapPx)) {
          placedStacks.push(candidate);
          groupOffsets[groupIndex] = offset;
          found = true;
          break;
        }
      }
      if (found) break;
    }
  });

  const offsets: MarkerPixelOffset[] = points.map(() => [0, 0]);

  entries.forEach(([, indices], groupIndex) => {
    const anchor = groupAnchors[groupIndex]!;
    const groupOffset = groupOffsets[groupIndex] ?? [0, 0];
    const orderedIndices = [...indices].sort((a, b) => {
      const orderDifference = points[a]!.order - points[b]!.order;
      return orderDifference === 0 ? a - b : orderDifference;
    });

    orderedIndices.forEach((pointIndex, slot) => {
      const point = points[pointIndex]!;
      const stackOffsetY = (slot - (orderedIndices.length - 1) / 2) * stackSpacingPx;
      offsets[pointIndex] = [
        anchor.x + groupOffset[0] - point.x,
        anchor.y + groupOffset[1] + stackOffsetY - point.y,
      ];
    });
  });

  return offsets;
}
