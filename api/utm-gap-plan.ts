import { planPublicGap } from "../src/server/public-campus/service.js";
import {
  exactObject,
  jsonResponse,
  optionsResponse,
  publicApiError,
  readBoundedJson,
  requireString,
} from "../src/server/public-campus/http.js";
import type { GapPreferences } from "../src/features/gaps/types.js";
import type { RoutePreferences } from "../src/features/routing/types.js";
import type { Term, Weekday } from "../src/lib/timetable-types.js";

const TERMS = new Set<Term>(["Fall", "Winter", "Summer"]);
const WEEKDAYS = new Set<Weekday>(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);

function requireMinute(value: unknown, name: string) {
  if (!Number.isInteger(value) || typeof value !== "number" || value < 0 || value > 1440) {
    throw new Error(`invalid ${name}`);
  }
  return value;
}

function optionalRoutePreferences(value: unknown): Partial<RoutePreferences> | null {
  if (value === undefined || value === null) return null;
  const object = exactObject(value);
  const allowed = new Set(["mode", "walkingSpeedMps", "transitionBufferMinutes"]);
  if (Object.keys(object).some((key) => !allowed.has(key))) throw new Error("invalid route preferences");
  const preferences: Partial<RoutePreferences> = {};
  if (object["mode"] !== undefined) {
    if (
      object["mode"] !== "fastest" &&
      object["mode"] !== "prefer-indoor" &&
      object["mode"] !== "step-free"
    ) {
      throw new Error("invalid route mode");
    }
    preferences.mode = object["mode"];
  }
  if (object["walkingSpeedMps"] !== undefined) {
    if (
      typeof object["walkingSpeedMps"] !== "number" ||
      !Number.isFinite(object["walkingSpeedMps"])
    ) {
      throw new Error("invalid walking speed");
    }
    preferences.walkingSpeedMps = object["walkingSpeedMps"];
  }
  if (object["transitionBufferMinutes"] !== undefined) {
    if (
      typeof object["transitionBufferMinutes"] !== "number" ||
      !Number.isFinite(object["transitionBufferMinutes"])
    ) {
      throw new Error("invalid transition buffer");
    }
    preferences.transitionBufferMinutes = object["transitionBufferMinutes"];
  }
  return preferences;
}

function optionalGapPreferences(value: unknown): Partial<GapPreferences> | null {
  if (value === undefined || value === null) return null;
  const object = exactObject(value);
  const allowed = new Set([
    "setupMinutes",
    "packUpMinutes",
    "lunchWindowStart",
    "lunchWindowEnd",
    "mealDurationMinutes",
    "willingToLeaveCampus",
    "oneWayHomeCommuteMinutes",
    "minimumHomeStayMinutes",
    "homeTurnaroundMinutes",
    "riskTolerance",
  ]);
  if (Object.keys(object).some((key) => !allowed.has(key))) throw new Error("invalid gap preferences");
  const numeric = [
    "setupMinutes",
    "packUpMinutes",
    "lunchWindowStart",
    "lunchWindowEnd",
    "mealDurationMinutes",
    "minimumHomeStayMinutes",
    "homeTurnaroundMinutes",
  ] as const;
  for (const key of numeric) {
    if (object[key] !== undefined && (typeof object[key] !== "number" || !Number.isFinite(object[key]))) {
      throw new Error(`invalid ${key}`);
    }
  }
  if (
    object["oneWayHomeCommuteMinutes"] !== undefined &&
    object["oneWayHomeCommuteMinutes"] !== null &&
    (typeof object["oneWayHomeCommuteMinutes"] !== "number" ||
      !Number.isFinite(object["oneWayHomeCommuteMinutes"]))
  ) {
    throw new Error("invalid oneWayHomeCommuteMinutes");
  }
  if (
    object["willingToLeaveCampus"] !== undefined &&
    typeof object["willingToLeaveCampus"] !== "boolean"
  ) {
    throw new Error("invalid willingToLeaveCampus");
  }
  if (
    object["riskTolerance"] !== undefined &&
    object["riskTolerance"] !== "low" &&
    object["riskTolerance"] !== "medium" &&
    object["riskTolerance"] !== "high"
  ) {
    throw new Error("invalid riskTolerance");
  }
  return object as Partial<GapPreferences>;
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
      const term = body["term"];
      const weekday = body["weekday"];
      if (typeof term !== "string" || !TERMS.has(term as Term)) throw new Error("invalid term");
      if (typeof weekday !== "string" || !WEEKDAYS.has(weekday as Weekday)) {
        throw new Error("invalid weekday");
      }
      const startTime = requireMinute(body["startTime"], "startTime");
      const endTime = requireMinute(body["endTime"], "endTime");
      if (endTime <= startTime) throw new Error("invalid gap window");

      let routePreferences: Partial<RoutePreferences> | null;
      let gapPreferences: Partial<GapPreferences> | null;
      try {
        routePreferences = optionalRoutePreferences(body["routePreferences"]);
        gapPreferences = optionalGapPreferences(body["gapPreferences"]);
      } catch {
        return jsonResponse(
          { error: "invalid_request", message: "Gap or route preferences are malformed." },
          400,
        );
      }

      const result = planPublicGap({
        from,
        to,
        term: term as Term,
        weekday: weekday as Weekday,
        startTime,
        endTime,
        routePreferences,
        gapPreferences,
      });
      if ("error" in result) {
        return jsonResponse(result, result.error === "unknown_building" ? 404 : 409);
      }
      return jsonResponse({ service: "gapwise-public-campus", gapPlan: result });
    } catch (error) {
      return publicApiError(error);
    }
  },
};
