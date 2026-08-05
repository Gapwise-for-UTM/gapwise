import type { GapPreferences, RiskTolerance } from "./types";

const STORAGE_KEY = "gapwise-gap-preferences-v2";

export const DEFAULT_GAP_PREFERENCES: GapPreferences = {
  setupMinutes: 4,
  packUpMinutes: 3,
  lunchWindowStart: 11 * 60 + 30,
  lunchWindowEnd: 14 * 60 + 30,
  mealDurationMinutes: 30,
  willingToLeaveCampus: false,
  oneWayHomeCommuteMinutes: null,
  minimumHomeStayMinutes: 90,
  homeTurnaroundMinutes: 10,
  riskTolerance: "low",
};

function boundedNumber(value: unknown, fallback: number, minimum: number, maximum: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

function nullableBoundedNumber(
  value: unknown,
  fallback: number | null,
  minimum: number,
  maximum: number,
) {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

function riskTolerance(value: unknown): RiskTolerance {
  return value === "medium" || value === "high" ? value : "low";
}

export function sanitizeGapPreferences(value: Partial<GapPreferences> | null | undefined) {
  const lunchWindowStart = boundedNumber(
    value?.lunchWindowStart,
    DEFAULT_GAP_PREFERENCES.lunchWindowStart,
    0,
    23 * 60 + 59,
  );
  const lunchWindowEnd = boundedNumber(
    value?.lunchWindowEnd,
    DEFAULT_GAP_PREFERENCES.lunchWindowEnd,
    lunchWindowStart + 15,
    24 * 60,
  );

  return {
    setupMinutes: boundedNumber(value?.setupMinutes, DEFAULT_GAP_PREFERENCES.setupMinutes, 0, 20),
    packUpMinutes: boundedNumber(
      value?.packUpMinutes,
      DEFAULT_GAP_PREFERENCES.packUpMinutes,
      0,
      20,
    ),
    lunchWindowStart,
    lunchWindowEnd,
    mealDurationMinutes: boundedNumber(
      value?.mealDurationMinutes,
      DEFAULT_GAP_PREFERENCES.mealDurationMinutes,
      15,
      90,
    ),
    willingToLeaveCampus: value?.willingToLeaveCampus === true,
    oneWayHomeCommuteMinutes: nullableBoundedNumber(
      value?.oneWayHomeCommuteMinutes,
      DEFAULT_GAP_PREFERENCES.oneWayHomeCommuteMinutes,
      5,
      180,
    ),
    minimumHomeStayMinutes: boundedNumber(
      value?.minimumHomeStayMinutes,
      DEFAULT_GAP_PREFERENCES.minimumHomeStayMinutes,
      30,
      360,
    ),
    homeTurnaroundMinutes: boundedNumber(
      value?.homeTurnaroundMinutes,
      DEFAULT_GAP_PREFERENCES.homeTurnaroundMinutes,
      0,
      30,
    ),
    riskTolerance: riskTolerance(value?.riskTolerance),
  } satisfies GapPreferences;
}

export function loadGapPreferences(): GapPreferences {
  if (typeof window === "undefined") return DEFAULT_GAP_PREFERENCES;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_GAP_PREFERENCES;
    return sanitizeGapPreferences(JSON.parse(stored) as Partial<GapPreferences>);
  } catch {
    return DEFAULT_GAP_PREFERENCES;
  }
}

export function saveGapPreferences(value: GapPreferences) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeGapPreferences(value)));
  } catch {
    // Recommendation settings are optional; storage failures should never break the planner.
  }
}
