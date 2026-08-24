export type PlaceFeasibilityInput = {
  gapMinutes: number;
  travelToMinutes: number | null;
  travelFromMinutes: number | null;
  protectedActivityMinutes: number;
  transitionBufferMinutes: number;
};

export type PlaceFeasibility = {
  status: "fits" | "too-tight" | "unknown";
  usableMinutes: number | null;
  requiredMinutes: number | null;
};

/** Deterministic two-sided feasibility; missing route truth never becomes a positive recommendation. */
export function assessPlaceFeasibility(input: PlaceFeasibilityInput): PlaceFeasibility {
  if (input.travelToMinutes === null || input.travelFromMinutes === null) {
    return { status: "unknown", usableMinutes: null, requiredMinutes: null };
  }
  const requiredMinutes =
    input.travelToMinutes +
    input.travelFromMinutes +
    input.protectedActivityMinutes +
    input.transitionBufferMinutes;
  const usableMinutes = Math.max(
    0,
    input.gapMinutes -
      input.travelToMinutes -
      input.travelFromMinutes -
      input.transitionBufferMinutes,
  );
  return {
    status: requiredMinutes <= input.gapMinutes ? "fits" : "too-tight",
    usableMinutes,
    requiredMinutes,
  };
}
