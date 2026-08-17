export type MarkerScreenPoint = { x: number; y: number };
export type MarkerPixelOffset = [x: number, y: number];

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
