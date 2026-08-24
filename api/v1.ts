import buildingHandler from "./utm-building.js";
import buildingsHandler from "./utm-buildings.js";
import gapPlanHandler from "./utm-gap-plan.js";
import placeHandler from "./utm-place.js";
import placesHandler from "./utm-places.js";
import routeHandler from "./utm-route.js";
import { jsonResponse, optionsResponse } from "../src/server/public-campus/http.js";
import { PUBLIC_CAMPUS_DATA_VERSION } from "../src/server/public-campus/data.js";

const resources = {
  buildings: { method: "GET", handler: buildingsHandler },
  building: { method: "GET", handler: buildingHandler },
  places: { method: "GET", handler: placesHandler },
  place: { method: "GET", handler: placeHandler },
  routes: { method: "POST", handler: routeHandler },
  "gap-plan": { method: "POST", handler: gapPlanHandler },
} as const;

const RATE_LIMIT = 120;
const RATE_WINDOW_MS = 60_000;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function rateLimit(request: Request) {
  const now = Date.now();
  const client =
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "anonymous";
  const current = rateBuckets.get(client);
  const bucket =
    !current || current.resetAt <= now ? { count: 0, resetAt: now + RATE_WINDOW_MS } : current;
  bucket.count += 1;
  rateBuckets.set(client, bucket);
  if (rateBuckets.size > 10_000) {
    for (const [key, value] of rateBuckets) if (value.resetAt <= now) rateBuckets.delete(key);
  }
  return {
    allowed: bucket.count <= RATE_LIMIT,
    remaining: Math.max(0, RATE_LIMIT - bucket.count),
    reset: Math.ceil(bucket.resetAt / 1000),
  };
}

function error(code: string, message: string, status: number, details?: unknown) {
  return jsonResponse(
    { error: { code, message, ...(details === undefined ? {} : { details }) } },
    status,
  );
}

async function canonicalize(response: Response, limit?: ReturnType<typeof rateLimit>) {
  const headers = new Headers(response.headers);
  headers.set("x-ratelimit-limit", "120");
  headers.set("ratelimit-policy", '"public";q=120;w=60');
  if (limit) {
    headers.set("x-ratelimit-remaining", String(limit.remaining));
    headers.set("x-ratelimit-reset", String(limit.reset));
  }
  if (response.ok || response.status === 204)
    return new Response(response.body, { status: response.status, headers });
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  const legacy = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  if (legacy["error"] && typeof legacy["error"] === "object") {
    return new Response(JSON.stringify(legacy), { status: response.status, headers });
  }
  const code = typeof legacy["error"] === "string" ? legacy["error"] : "internal_error";
  const message =
    typeof legacy["message"] === "string"
      ? legacy["message"]
      : "Gapwise could not complete this request.";
  const details = Object.fromEntries(
    Object.entries(legacy).filter(([key]) => key !== "error" && key !== "message"),
  );
  return new Response(
    JSON.stringify({
      error: { code, message, ...(Object.keys(details).length ? { details } : {}) },
    }),
    {
      status: response.status,
      headers,
    },
  );
}

export default {
  async fetch(request: Request) {
    if (request.method === "OPTIONS") return canonicalize(optionsResponse());
    const limit = rateLimit(request);
    if (!limit.allowed) {
      const response = error(
        "rate_limited",
        "Public API rate limit exceeded. Retry after the current window.",
        429,
      );
      response.headers.set("retry-after", "60");
      return canonicalize(response, limit);
    }
    const url = new URL(request.url);
    const resource = url.searchParams.get("resource") ?? "root";
    if (resource === "root") {
      if (request.method !== "GET")
        return canonicalize(error("method_not_allowed", "Use GET.", 405), limit);
      return canonicalize(
        jsonResponse(
          {
            service: "gapwise-public-campus",
            version: "v1",
            dataVersion: PUBLIC_CAMPUS_DATA_VERSION,
            documentation: "https://docs.gapwise.ca",
            openapi: "https://api.gapwise.ca/openapi.json",
            privacy: "Public campus intelligence only; no student or account data is exposed.",
          },
          200,
          "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
        ),
        limit,
      );
    }
    if (!(resource in resources))
      return canonicalize(error("not_found", "API resource not found.", 404), limit);
    const endpoint = resources[resource as keyof typeof resources];
    if (request.method !== endpoint.method)
      return canonicalize(error("method_not_allowed", `Use ${endpoint.method}.`, 405), limit);

    if (resource === "building") url.searchParams.set("q", url.searchParams.get("building") ?? "");
    if (resource === "place") url.searchParams.set("id", url.searchParams.get("placeId") ?? "");
    const forwarded = new Request(url, request);
    return canonicalize(await endpoint.handler.fetch(forwarded), limit);
  },
};
