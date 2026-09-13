import { sanitizeRoutePreferences } from "../src/config/routing.js";
import { findBestRoute } from "../src/features/routing/engine.js";
import type { RoutePreferences } from "../src/features/routing/types.js";
import {
  PUBLIC_CAMPUS_DATA_VERSION,
  resolvePublicBuilding,
  serverRoutingGraph,
} from "../src/server/public-campus/data.js";
import {
  exactObject,
  jsonResponse,
  optionsResponse,
  publicApiError,
  readBoundedJson,
  requireString,
} from "../src/server/public-campus/http.js";

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
      const fromQuery = requireString(body["from"], "from");
      const toQuery = requireString(body["to"], "to");
      let preferencePatch: Partial<RoutePreferences> | null;
      try {
        preferencePatch = optionalPreferences(body["preferences"]);
      } catch {
        return jsonResponse(
          {
            error: "invalid_request",
            message: "preferences contains an invalid route preference.",
          },
          400,
        );
      }

      const fromResolution = resolvePublicBuilding(fromQuery);
      const toResolution = resolvePublicBuilding(toQuery);
      if (fromResolution.status === "ambiguous" || toResolution.status === "ambiguous") {
        return jsonResponse(
          {
            error: "ambiguous_building",
            message: "A building name matched more than one canonical UTM building. Use the canonical building code.",
          },
          409,
        );
      }
      if (fromResolution.status !== "found" || toResolution.status !== "found") {
        return jsonResponse(
          {
            error: "unknown_building",
            message: "Gapwise could not resolve one or both building names to a canonical UTM building.",
          },
          404,
        );
      }

      const from = fromResolution.building;
      const to = toResolution.building;
      const preferences = sanitizeRoutePreferences(preferencePatch);
      if (from.code === to.code) {
        return jsonResponse({
          service: "gapwise-public-campus",
          dataVersion: PUBLIC_CAMPUS_DATA_VERSION,
          from: from.code,
          to: to.code,
          status: "same-building",
          displayCoordinates: [],
        });
      }

      const graph = serverRoutingGraph();
      const nodeIds = new Set(graph.nodes.map((node) => node.id));
      const starts = from.entrances
        .map((entrance) => entrance.routingNodeId)
        .filter((id) => nodeIds.has(id));
      const ends = to.entrances
        .map((entrance) => entrance.routingNodeId)
        .filter((id) => nodeIds.has(id));
      const route = findBestRoute(graph, starts, ends, preferences);

      return jsonResponse({
        service: "gapwise-public-campus",
        dataVersion: PUBLIC_CAMPUS_DATA_VERSION,
        from: from.code,
        to: to.code,
        status: route ? "routed" : "unavailable",
        displayCoordinates: route?.coordinates ?? [],
        totalDistanceMeters: route?.totalDistanceMeters ?? null,
        estimatedSeconds: route?.estimatedSeconds ?? null,
      });
    } catch (error) {
      return publicApiError(error);
    }
  },
};
