import { DEFAULT_ROUTE_PREFERENCES, sanitizeRoutePreferences } from "@/config/routing";
import type { RoutePreferences } from "@/features/routing/types";

export type UserPreferences = RoutePreferences & {
  avoidStairs: boolean;
  preferIndoor: boolean;
};

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  ...DEFAULT_ROUTE_PREFERENCES,
  avoidStairs: false,
  preferIndoor: false,
};

export function sanitizeUserPreferences(
  value: Partial<UserPreferences> | null | undefined,
): UserPreferences {
  const route = sanitizeRoutePreferences(value);
  return {
    ...route,
    avoidStairs: value?.avoidStairs === true || route.mode === "step-free",
    preferIndoor: value?.preferIndoor === true || route.mode === "prefer-indoor",
  };
}
