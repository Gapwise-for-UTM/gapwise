import { routeBetweenPublicBuildings } from "../src/server/public-campus/service.js";
import {
  exactObject,
  jsonResponse,
  optionsResponse,
  publicApiError,
  readBoundedJson,
  requireString,
} from "../src/server/public-campus/http.js";
import type { RoutePreferences } from "../src/features/routing/types.js";

function optionalPreferences(value: unknown): Partial<RoutePreferences> | null {
  if (value === undefined || value === null) return null;
  const object = exactObject(value);
  const preferences: Partial<RoutePreferences> = {};
  if (object["mode"] !== undefined) {
    if (
      object["mode"] !== "fastest" &&
      object["mode"] !== "prefer-indoor" &&
      object["mode"] !== "step-free"
    ) {
      throw new Error("invalid mode");
    }
    preferences.mode = object["mode"];
  }
  if (object["walkingSpeedMps"] !== undefined) {
    if (
      typeof object["walkingSpeedMps"] !== "number" ||
      !Number.isFinite(object["walkingSpeedMps"])
    ) {
      throw new Error("invalid walkingSpeedMps");
    }
    preferences.walkingSpeedMps = object["walkingSpeedMps"];
  }
  if (object["transitionBufferMinutes"] !== undefined) {
    if (
      typeof object["transitionBufferMinutes"] !== "number" ||
      !Number.isFinite(object["transitionBufferMinutes"])
    ) {
      throw new Error("invalid transitionBufferMinutes");
    }
    preferences.transitionBufferMinutes = object["transitionBufferMinutes"];
  }
  return preferences;
}

export default {
  async fetch(request: Request) {
    if (request.method === "OPTIONS") return optionsResponse();
    if (request.method !== "POST") {
      return jsonResponse({ error: "method_not_allowed", message: "Use POST." }, 405);
    }
    try {
      const body = exactObject(await readBoundedJson(request));
      const from = requireString(body["from"], "from");
      const to = requireString(body["to"], "to");
      let preferences: Partial<RoutePreferences> | null;
      try {
        preferences = optionalPreferences(body["preferences"]);
      } catch {
        return jsonResponse(
          {
            error: "invalid_request",
            message: "preferences contains an invalid route preference.",
          },
          400,
        );
      }
      const result = routeBetweenPublicBuildings({ from, to, preferences });
      if ("error" in result) {
        return jsonResponse(result, result.error === "unknown_building" ? 404 : 409);
      }
      return jsonResponse({ service: "gapwise-public-campus", route: result });
    } catch (error) {
      return publicApiError(error);
    }
  },
};
