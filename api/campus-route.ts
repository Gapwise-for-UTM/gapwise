import { routeBetweenCampusBuildings } from "../src/server/campus-intelligence.js";
import type { RoutePreferences } from "../src/features/routing/types.js";
import {
  exactPublicObject,
  publicErrorResponse,
  publicJsonResponse,
  readPublicJson,
  requiredString,
  PublicApiError,
} from "../src/server/public-json.js";

function parsePreferences(value: unknown): Partial<RoutePreferences> | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new PublicApiError(400, "Invalid preferences.");
  }
  const record = value as Record<string, unknown>;
  const allowed = new Set(["mode", "walkingSpeedMps", "transitionBufferMinutes"]);
  if (Object.keys(record).some((key) => !allowed.has(key))) {
    throw new PublicApiError(400, "Invalid preferences.");
  }
  const preferences: Partial<RoutePreferences> = {};
  if (record.mode !== undefined) {
    if (record.mode !== "fastest" && record.mode !== "prefer-indoor" && record.mode !== "step-free") {
      throw new PublicApiError(400, "Invalid preferences.");
    }
    preferences.mode = record.mode;
  }
  if (record.walkingSpeedMps !== undefined) {
    if (typeof record.walkingSpeedMps !== "number" || !Number.isFinite(record.walkingSpeedMps)) {
      throw new PublicApiError(400, "Invalid preferences.");
    }
    preferences.walkingSpeedMps = record.walkingSpeedMps;
  }
  if (record.transitionBufferMinutes !== undefined) {
    if (
      typeof record.transitionBufferMinutes !== "number" ||
      !Number.isFinite(record.transitionBufferMinutes)
    ) {
      throw new PublicApiError(400, "Invalid preferences.");
    }
    preferences.transitionBufferMinutes = record.transitionBufferMinutes;
  }
  return preferences;
}

export default {
  async fetch(request: Request): Promise<Response> {
    try {
      const body = exactPublicObject(await readPublicJson(request), ["from", "to", "preferences"]);
      const from = requiredString(body, "from");
      const to = requiredString(body, "to");
      const preferences = parsePreferences(body.preferences);
      const route = routeBetweenCampusBuildings(from, to, preferences);
      if (!route) throw new PublicApiError(404, "One or both campus buildings could not be resolved exactly.");
      return publicJsonResponse(
        { schemaVersion: 1, route },
        200,
        "public, max-age=3600, stale-while-revalidate=86400",
      );
    } catch (error) {
      return publicErrorResponse(error);
    }
  },
};
