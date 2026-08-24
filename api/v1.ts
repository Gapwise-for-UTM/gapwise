import gapPlanHandler from "./utm-gap-plan.js";
import routeHandler from "./utm-route.js";
import { evaluateOpenNow } from "../src/features/campus-state/hours.js";
import { CAMPUS_STATE_SNAPSHOT, getCampusPlace } from "../src/features/campus-state/snapshot.js";
import type { CampusPlace, CampusPlaceKind } from "../src/features/campus-state/types.js";
import { PUBLIC_CAMPUS_DATA_VERSION } from "../src/server/public-campus/data.js";
import {
  getPublicBuilding,
  listPublicBuildings,
  type PublicBuildingView,
} from "../src/server/public-campus/service.js";

const API_VERSION = "v1";
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 50;
const BUILDING_CATEGORIES = new Set(["academic", "residence", "facility"]);
const PLACE_KINDS = new Set<CampusPlaceKind>([
  "dining",
  "study",
  "library",
  "service",
  "recreation",
  "amenity",
  "facility",
]);
const OPEN_STATES = new Set(["open", "closed", "unknown"]);

class V1Error extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

type ResponseMeta = {
  apiVersion: typeof API_VERSION;
  dataVersion: string;
  generatedAt?: string;
  requestId: string;
  pagination?: {
    limit: number;
    offset: number;
    count: number;
    total: number;
    nextOffset: number | null;
  };
  filters?: Record<string, string>;
};

function requestId() {
  return crypto.randomUUID();
}

function headers(requestIdValue: string, cacheControl: string, allow?: string) {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    "cache-control": cacheControl,
    "content-type": "application/json; charset=utf-8",
    "x-content-type-options": "nosniff",
    "x-request-id": requestIdValue,
    ...(allow ? { allow } : {}),
  };
}

function respond(data: unknown, meta: ResponseMeta, cacheControl = "no-store") {
  return new Response(JSON.stringify({ data, meta }), {
    status: 200,
    headers: headers(meta.requestId, cacheControl),
  });
}

function fail(error: unknown, id: string) {
  const known =
    error instanceof V1Error
      ? error
      : new V1Error(500, "internal_error", "Gapwise could not complete this request.");
  return new Response(
    JSON.stringify({
      error: {
        code: known.code,
        message: known.message,
        ...(known.details === undefined ? {} : { details: known.details }),
      },
      meta: { apiVersion: API_VERSION, requestId: id },
    }),
    {
      status: known.status,
      headers: headers(
        id,
        "no-store",
        known.status === 405
          ? String((known.details as { allow?: string } | undefined)?.allow ?? "")
          : undefined,
      ),
    },
  );
}

function normalize(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase("en-CA");
}

function singleQuery(url: URL, name: string, maxLength = 120) {
  const values = url.searchParams.getAll(name);
  if (values.length > 1)
    throw new V1Error(400, "invalid_query", `${name} may be supplied only once.`);
  const value = values[0]?.trim();
  if (value && value.length > maxLength)
    throw new V1Error(400, "invalid_query", `${name} is too long.`);
  return value || undefined;
}

function requireKnownQuery(url: URL, allowed: readonly string[]) {
  const names = new Set(["resource", ...allowed]);
  for (const name of url.searchParams.keys()) {
    if (!names.has(name))
      throw new V1Error(400, "invalid_query", `Unknown query parameter: ${name}.`);
  }
}

async function validateCanonicalBody(
  request: Request,
  allowed: readonly string[],
  nested?: Record<string, readonly string[]>,
) {
  const mediaType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (mediaType !== "application/json")
    throw new V1Error(415, "unsupported_media_type", "Content-Type must be application/json.");
  const text = await request.clone().text();
  if (new TextEncoder().encode(text).byteLength > 16_384)
    throw new V1Error(413, "request_too_large", "Request body is too large.");
  let body: unknown;
  try {
    body = JSON.parse(text) as unknown;
  } catch {
    throw new V1Error(400, "invalid_json", "Request body must be valid JSON.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new V1Error(400, "invalid_request", "Request body must be a JSON object.");
  const value = body as Record<string, unknown>;
  const allowedKeys = new Set(allowed);
  const unknown = Object.keys(value).filter((key) => !allowedKeys.has(key));
  if (unknown.length)
    throw new V1Error(400, "invalid_request", "Request body contains unknown fields.", {
      fields: unknown.sort(),
    });
  for (const [name, keys] of Object.entries(nested ?? {})) {
    const candidate = value[name];
    if (candidate === undefined || candidate === null) continue;
    if (typeof candidate !== "object" || Array.isArray(candidate))
      throw new V1Error(400, "invalid_request", `${name} must be a JSON object.`);
    const known = new Set(keys);
    const extra = Object.keys(candidate).filter((key) => !known.has(key));
    if (extra.length)
      throw new V1Error(400, "invalid_request", `${name} contains unknown fields.`, {
        fields: extra.sort(),
      });
  }
}

function pagination(url: URL) {
  const rawLimit = singleQuery(url, "limit", 3);
  const rawOffset = singleQuery(url, "offset", 9);
  const limit = rawLimit === undefined ? DEFAULT_PAGE_SIZE : Number(rawLimit);
  const offset = rawOffset === undefined ? 0 : Number(rawOffset);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE)
    throw new V1Error(400, "invalid_query", `limit must be an integer from 1 to ${MAX_PAGE_SIZE}.`);
  if (!Number.isInteger(offset) || offset < 0)
    throw new V1Error(400, "invalid_query", "offset must be a non-negative integer.");
  return { limit, offset };
}

function collectionMeta(
  id: string,
  dataVersion: string,
  total: number,
  count: number,
  page: { limit: number; offset: number },
  filters: Record<string, string>,
  generatedAt?: string,
): ResponseMeta {
  return {
    apiVersion: API_VERSION,
    dataVersion,
    ...(generatedAt ? { generatedAt } : {}),
    requestId: id,
    pagination: {
      ...page,
      count,
      total,
      nextOffset: page.offset + count < total ? page.offset + count : null,
    },
    ...(Object.keys(filters).length ? { filters } : {}),
  };
}

function listBuildings(url: URL, id: string) {
  requireKnownQuery(url, ["q", "category", "limit", "offset"]);
  const q = singleQuery(url, "q");
  const category = singleQuery(url, "category");
  if (category && !BUILDING_CATEGORIES.has(category))
    throw new V1Error(400, "invalid_query", "category must be academic, residence, or facility.");
  const page = pagination(url);
  const needle = q ? normalize(q) : undefined;
  const all = listPublicBuildings().filter((building) => {
    if (category && building.category !== category) return false;
    return (
      !needle ||
      [building.code, building.name, ...building.aliases].some((value) =>
        normalize(value).includes(needle),
      )
    );
  });
  const data = all.slice(page.offset, page.offset + page.limit);
  const filters = { ...(q ? { q } : {}), ...(category ? { category } : {}) };
  return respond(
    data,
    collectionMeta(id, PUBLIC_CAMPUS_DATA_VERSION, all.length, data.length, page, filters),
    "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
  );
}

function publicPlace(place: CampusPlace, now: Date) {
  const availability = evaluateOpenNow(place.hours, place.hoursProvenance, now);
  return {
    ...place,
    availability: {
      state: availability.state,
      freshness: availability.freshness,
      evaluatedAt: now.toISOString(),
      nextTransition: availability.nextTransition?.toISOString() ?? null,
    },
  };
}

function listPlaces(url: URL, id: string, now: Date) {
  requireKnownQuery(url, ["q", "kind", "building", "openNow", "limit", "offset"]);
  const q = singleQuery(url, "q");
  const kind = singleQuery(url, "kind");
  const building = singleQuery(url, "building")?.toUpperCase();
  const openNow = singleQuery(url, "openNow");
  if (kind && !PLACE_KINDS.has(kind as CampusPlaceKind))
    throw new V1Error(400, "invalid_query", `kind must be one of: ${[...PLACE_KINDS].join(", ")}.`);
  if (building && !/^[A-Z0-9]{1,12}$/.test(building))
    throw new V1Error(400, "invalid_query", "building must be a canonical building code.");
  if (openNow && !OPEN_STATES.has(openNow))
    throw new V1Error(400, "invalid_query", "openNow must be open, closed, or unknown.");
  const page = pagination(url);
  const needle = q ? normalize(q) : undefined;
  const all = CAMPUS_STATE_SNAPSHOT.places
    .map((place) => publicPlace(place, now))
    .filter((place) => {
      if (kind && place.kind !== kind) return false;
      if (building && place.buildingCode !== building) return false;
      if (openNow && place.availability.state !== openNow) return false;
      return (
        !needle ||
        normalize(place.name).includes(needle) ||
        place.amenities.some((amenity) => normalize(amenity).includes(needle))
      );
    });
  const data = all.slice(page.offset, page.offset + page.limit);
  const filters = {
    ...(q ? { q } : {}),
    ...(kind ? { kind } : {}),
    ...(building ? { building } : {}),
    ...(openNow ? { openNow } : {}),
  };
  return respond(
    data,
    collectionMeta(
      id,
      CAMPUS_STATE_SNAPSHOT.version,
      all.length,
      data.length,
      page,
      filters,
      CAMPUS_STATE_SNAPSHOT.generatedAt,
    ),
    "no-store",
  );
}

async function adaptLegacy(
  request: Request,
  handler: { fetch(request: Request): Promise<Response> },
  key: string,
  id: string,
) {
  const response = await handler.fetch(request);
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new V1Error(
      502,
      "invalid_upstream_response",
      "The campus service returned an invalid response.",
    );
  }
  const value = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  if (!response.ok)
    throw new V1Error(
      response.status,
      typeof value["error"] === "string" ? value["error"] : "internal_error",
      typeof value["message"] === "string"
        ? value["message"]
        : "Gapwise could not complete this request.",
      value["candidates"] === undefined ? undefined : { candidates: value["candidates"] },
    );
  return respond(value[key], {
    apiVersion: API_VERSION,
    dataVersion:
      typeof (value[key] as Record<string, unknown> | undefined)?.["dataVersion"] === "string"
        ? String((value[key] as Record<string, unknown>)["dataVersion"])
        : PUBLIC_CAMPUS_DATA_VERSION,
    requestId: id,
  });
}

export async function fetchV1(request: Request, now = new Date()) {
  const id = requestId();
  try {
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers: headers(id, "public, max-age=86400") });
    const url = new URL(request.url);
    const resource = url.searchParams.get("resource") ?? "root";
    const requiredMethod = resource === "routes" || resource === "gap-plan" ? "POST" : "GET";
    if (request.method !== requiredMethod)
      throw new V1Error(405, "method_not_allowed", `Use ${requiredMethod}.`, {
        allow: requiredMethod,
      });
    if (resource === "root") {
      requireKnownQuery(url, []);
      return respond(
        {
          name: "Gapwise Public Campus API",
          apiVersion: API_VERSION,
          campusDataVersion: PUBLIC_CAMPUS_DATA_VERSION,
          campusStateVersion: CAMPUS_STATE_SNAPSHOT.version,
          authentication: "none",
          documentationUrl: "https://docs.gapwise.ca",
          openapiUrl: "https://api.gapwise.ca/openapi.json",
          capabilities: {
            buildingSearch: true,
            placeSearch: true,
            placeAvailability: "source-dependent",
            routingModes: ["fastest", "prefer-indoor", "step-free"],
          },
          privacy: "Public campus intelligence only; no student or account data is exposed.",
        },
        {
          apiVersion: API_VERSION,
          dataVersion: PUBLIC_CAMPUS_DATA_VERSION,
          generatedAt: CAMPUS_STATE_SNAPSHOT.generatedAt,
          requestId: id,
        },
        "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
      );
    }
    if (resource === "buildings") return listBuildings(url, id);
    if (resource === "building") {
      requireKnownQuery(url, ["building"]);
      const value = url.searchParams.get("building")?.trim() ?? "";
      if (!value || value.length > 240)
        throw new V1Error(
          400,
          "invalid_identifier",
          "A building code, exact name, or alias is required.",
        );
      const result = getPublicBuilding(value);
      if (result.status === "not_found")
        throw new V1Error(404, "building_not_found", "Campus building not found.");
      if (result.status === "ambiguous")
        throw new V1Error(
          409,
          "ambiguous_building",
          "The building identifier is ambiguous; use a canonical code.",
          { candidates: result.candidates.map((item: PublicBuildingView) => item.code) },
        );
      return respond(
        result.building,
        { apiVersion: API_VERSION, dataVersion: PUBLIC_CAMPUS_DATA_VERSION, requestId: id },
        "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
      );
    }
    if (resource === "places") return listPlaces(url, id, now);
    if (resource === "place") {
      requireKnownQuery(url, ["placeId"]);
      const value = url.searchParams.get("placeId")?.trim() ?? "";
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value))
        throw new V1Error(400, "invalid_identifier", "A canonical place id is required.");
      const place = getCampusPlace(value);
      if (!place) throw new V1Error(404, "place_not_found", "Campus place not found.");
      return respond(
        publicPlace(place, now),
        {
          apiVersion: API_VERSION,
          dataVersion: CAMPUS_STATE_SNAPSHOT.version,
          generatedAt: CAMPUS_STATE_SNAPSHOT.generatedAt,
          requestId: id,
        },
        "no-store",
      );
    }
    if (resource === "routes") {
      requireKnownQuery(url, []);
      await validateCanonicalBody(request, ["from", "to", "preferences"], {
        preferences: ["mode", "walkingSpeedMps", "transitionBufferMinutes"],
      });
      return await adaptLegacy(request, routeHandler, "route", id);
    }
    if (resource === "gap-plan") {
      requireKnownQuery(url, []);
      await validateCanonicalBody(
        request,
        [
          "from",
          "to",
          "term",
          "weekday",
          "startTime",
          "endTime",
          "routePreferences",
          "gapPreferences",
        ],
        {
          routePreferences: ["mode", "walkingSpeedMps", "transitionBufferMinutes"],
          gapPreferences: [
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
          ],
        },
      );
      return await adaptLegacy(request, gapPlanHandler, "gapPlan", id);
    }
    throw new V1Error(404, "not_found", "API resource not found.");
  } catch (error) {
    return fail(error, id);
  }
}

export default { fetch: fetchV1 };
