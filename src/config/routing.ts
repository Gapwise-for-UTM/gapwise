import type { RoutePreferences } from "@/features/routing/types";

export const ROUTING_DEFAULTS = {
  walkingSpeedMps: 1.35,
  transitionBufferMinutes: 5,
  buildingEntryExitSeconds: 10,
  crosswalkDelaySeconds: 15,
  stairsPerFloorSeconds: 20,
  elevatorWaitSeconds: 45,
  preferIndoorOutdoorMultiplier: 1.75,
} as const;

export const DEFAULT_ROUTE_PREFERENCES: RoutePreferences = {
  mode: "fastest",
  walkingSpeedMps: ROUTING_DEFAULTS.walkingSpeedMps,
  transitionBufferMinutes: ROUTING_DEFAULTS.transitionBufferMinutes,
};

export function sanitizeRoutePreferences(
  value: Partial<RoutePreferences> | null | undefined,
): RoutePreferences {
  const mode = value?.mode;
  return {
    mode:
      mode === "prefer-indoor" || mode === "step-free" || mode === "fastest"
        ? mode
        : DEFAULT_ROUTE_PREFERENCES.mode,
    walkingSpeedMps:
      typeof value?.walkingSpeedMps === "number" &&
      Number.isFinite(value.walkingSpeedMps) &&
      value.walkingSpeedMps >= 0.5 &&
      value.walkingSpeedMps <= 3
        ? value.walkingSpeedMps
        : DEFAULT_ROUTE_PREFERENCES.walkingSpeedMps,
    transitionBufferMinutes:
      typeof value?.transitionBufferMinutes === "number" &&
      Number.isFinite(value.transitionBufferMinutes) &&
      value.transitionBufferMinutes >= 0 &&
      value.transitionBufferMinutes <= 60
        ? Math.round(value.transitionBufferMinutes)
        : DEFAULT_ROUTE_PREFERENCES.transitionBufferMinutes,
  };
}
