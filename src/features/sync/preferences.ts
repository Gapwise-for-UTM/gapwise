import { DEFAULT_ROUTE_PREFERENCES, sanitizeRoutePreferences } from "@/config/routing";
import { UTM_RESIDENCES } from "@/data/utm/building-registry";
import type { RoutePreferences } from "@/features/routing/types";

export type DayOrigin = "commute" | "residence";

export type UserPreferences = RoutePreferences & {
  avoidStairs: boolean;
  preferIndoor: boolean;
  dayOrigin: DayOrigin;
  residenceBuildingCode: string | null;
};

const LOCAL_PREFERENCES_KEY = "gapwise:user-preferences:v1";
const RESIDENCE_CODES = new Set(UTM_RESIDENCES.map((building) => building.code));

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  ...DEFAULT_ROUTE_PREFERENCES,
  avoidStairs: false,
  preferIndoor: false,
  dayOrigin: "commute",
  residenceBuildingCode: null,
};

export function sanitizeUserPreferences(
  value: Partial<UserPreferences> | null | undefined,
): UserPreferences {
  const route = sanitizeRoutePreferences(value);
  const requestedResidence = value?.residenceBuildingCode?.trim().toUpperCase() ?? null;
  const residenceBuildingCode =
    requestedResidence && RESIDENCE_CODES.has(requestedResidence) ? requestedResidence : null;
  const dayOrigin =
    value?.dayOrigin === "residence" && residenceBuildingCode ? "residence" : "commute";
  return {
    ...route,
    avoidStairs: value?.avoidStairs === true || route.mode === "step-free",
    preferIndoor: value?.preferIndoor === true || route.mode === "prefer-indoor",
    dayOrigin,
    residenceBuildingCode: dayOrigin === "residence" ? residenceBuildingCode : null,
  };
}

export function loadLocalUserPreferences(): UserPreferences {
  if (typeof window === "undefined") return DEFAULT_USER_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(LOCAL_PREFERENCES_KEY);
    return raw
      ? sanitizeUserPreferences(JSON.parse(raw) as Partial<UserPreferences>)
      : DEFAULT_USER_PREFERENCES;
  } catch {
    return DEFAULT_USER_PREFERENCES;
  }
}

export function saveLocalUserPreferences(value: UserPreferences): UserPreferences {
  const preferences = sanitizeUserPreferences(value);
  if (typeof window === "undefined") return preferences;
  try {
    window.localStorage.setItem(LOCAL_PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    /* Private browsing or storage policy can make localStorage unavailable. */
  }
  return preferences;
}
