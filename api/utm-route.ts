import { sanitizeRoutePreferences } from "../src/config/routing.js";
import { findBestRoute } from "../src/features/routing/engine.js";
import type { RoutePreferences } from "../src/features/routing/types.js";
import { resolvePublicBuilding, serverRoutingGraph } from "../src/server/public-campus/data.js";
import { routeBetweenPublicBuildings } from "../src/server/public-campus/service.js";
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

function mappedCoordinates(
  fromQuery: string,
  toQuery: string,
  preferences: Partial<RoutePreferences> | null,
) {
  const fromResolution = resolvePublicBuilding(fromQuery);
  const toResolution = resolvePublicBuilding(toQuery);
  if (fromResolution.status !== "found" || toResolution.status !== "found") return [];
  if (fromResolution.building.code === toResolution.building.code) return [];

  const graph = serverRoutingGraph();
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const routableEntrances = (building: typeof fromResolution.building) =>
    building.entrances.filter((entrance) => nodeIds.has(entrance.routingNodeId));
  const starts = routableEntrances(fromResolution.building);
  const ends = routableEntrances(toResolution.building);
  const preferredStart = starts.find((entrance) => entrance.preferredForRouting);
  const preferredEnd = ends.find((entrance) => entrance.preferredForRouting);
  const routePreferences = sanitizeRoutePreferences(preferences);
  const preferredRoute = findBestRoute(
    graph,
    (preferredStart ? [preferredStart] : starts).map((entrance) => entrance.routingNodeId),
    (preferredEnd ? [preferredEnd] : ends).map((entrance) => entrance.routingNodeId),
    routePreferences,
  );
  if (preferredRoute) return preferredRoute.coordinates;
  if (!preferredStart && !preferredEnd) return [];
  return (
    findBestRoute(
      graph,
      starts.map((entrance) => entrance.routingNodeId),
      ends.map((entrance) => entrance.routingNodeId),
      routePreferences,
    )?.coordinates ?? []
  );
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
      const includeGeometry = body["includeGeometry"] === true;
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
      return jsonResponse({
        service: "gapwise-public-campus",
        route: result,
        ...(includeGeometry
          ? { displayCoordinates: mappedCoordinates(from, to, preferences) }
          : {}),
      });
    } catch (error) {
      return publicApiError(error);
    }
  },
};
