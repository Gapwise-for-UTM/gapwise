/* eslint-disable @typescript-eslint/no-explicit-any -- OpenAPI and decoded JSON are intentionally runtime-validated. */
import { describe, expect, test } from "bun:test";
import v1, { fetchV1 } from "../api/v1";
import legacyBuildings from "../api/utm-buildings";

const base = "https://api.gapwise.ca/api/v1";
function request(resource: string, init?: RequestInit, suffix = "") {
  return new Request(`${base}?resource=${resource}${suffix}`, init);
}
async function json(response: Response) {
  return (await response.json()) as Record<string, any>;
}

describe("canonical v1 API", () => {
  test("publishes version, capability, privacy, cache, and request metadata", async () => {
    const response = await v1.fetch(request("root"));
    const body = await json(response);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(response.headers.get("cache-control")).toContain("s-maxage=3600");
    expect(response.headers.get("x-request-id")).toBe(body.meta.requestId);
    expect(body.data).toMatchObject({
      apiVersion: "v1",
      authentication: "none",
      capabilities: { buildingSearch: true, placeSearch: true },
    });
    expect(JSON.stringify(body)).not.toMatch(/timetable|friend|supabase|credential/i);
  });
  test("searches, filters, and paginates buildings deterministically", async () => {
    const response = await v1.fetch(
      request("buildings", undefined, "&q=instructional&category=academic&limit=1&offset=0"),
    );
    const body = await json(response);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].code).toBe("IB");
    expect(body.meta.pagination).toEqual({
      limit: 1,
      offset: 0,
      count: 1,
      total: 1,
      nextOffset: null,
    });
    expect(body.meta.filters).toEqual({ q: "instructional", category: "academic" });
  });
  test("resolves a building and preserves conservative accessibility", async () => {
    const response = await v1.fetch(request("building", undefined, "&building=MN"));
    const body = await json(response);
    expect(response.status).toBe(200);
    expect(body.data.code).toBe("MN");
    expect(["accessible", "not_accessible", "unknown"]).toContain(body.data.accessibility);
  });
  test("discovers places by name, kind, building, and explicit unknown availability", async () => {
    const now = new Date("2026-08-24T15:00:00Z");
    const response = await fetchV1(
      request("places", undefined, "&q=library&kind=library&building=HM&openNow=unknown"),
      now,
    );
    const body = await json(response);
    expect(body.data.map((place: any) => place.id)).toEqual(["utm-library"]);
    expect(body.data[0].availability).toEqual({
      state: "unknown",
      freshness: "unknown",
      evaluatedAt: now.toISOString(),
      nextTransition: null,
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  test("gets a place with provenance without claiming unknown hours are closed", async () => {
    const body = await json(
      await fetchV1(
        request("place", undefined, "&placeId=utm-library"),
        new Date("2026-08-24T15:00:00Z"),
      ),
    );
    expect(body.data.metadataProvenance.status).toBe("verified");
    expect(body.data.hoursProvenance.status).toBe("unknown");
    expect(body.data.availability.state).toBe("unknown");
  });
  test("calculates routes through shared public campus logic", async () => {
    const response = await v1.fetch(
      request("routes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ from: "MN", to: "IB" }),
      }),
    );
    const body = await json(response);
    expect(response.status).toBe(200);
    expect(body.data.from.code).toBe("MN");
    expect(body.data.to.code).toBe("IB");
    expect(body.data).not.toHaveProperty("nodes");
  });
  test("plans a gap using only an explicitly supplied free interval", async () => {
    const response = await v1.fetch(
      request("gap-plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          from: "MN",
          to: "IB",
          term: "Fall",
          weekday: "Wednesday",
          startTime: 660,
          endTime: 780,
        }),
      }),
    );
    const body = await json(response);
    expect(response.status).toBe(200);
    expect(body.data.gap.durationMinutes).toBe(120);
    expect(body.data).not.toHaveProperty("timetable");
  });
  test.each([
    [request("building", undefined, "&building=NOPE"), 404, "building_not_found"],
    [request("place", undefined, "&placeId=Missing"), 400, "invalid_identifier"],
    [request("places", undefined, "&kind=classroom"), 400, "invalid_query"],
    [request("buildings", undefined, "&limit=101"), 400, "invalid_query"],
    [request("buildings", undefined, "&secret=yes"), 400, "invalid_query"],
    [
      request("routes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{",
      }),
      400,
      "invalid_json",
    ],
    [
      request("routes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
      400,
      "invalid_request",
    ],
    [
      request("routes", { method: "POST", body: JSON.stringify({ from: "MN", to: "IB" }) }),
      415,
      "unsupported_media_type",
    ],
    [
      request("routes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ from: "MN", to: "IB", privateState: true }),
      }),
      400,
      "invalid_request",
    ],
  ])("returns a stable envelope for invalid requests", async (input, status, code) => {
    const response = await v1.fetch(input as Request);
    const body = await json(response);
    expect(response.status).toBe(status);
    expect(body).toMatchObject({
      error: { code, message: expect.any(String) },
      meta: { apiVersion: "v1", requestId: expect.any(String) },
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  test("returns Allow for wrong methods", async () => {
    const response = await v1.fetch(request("buildings", { method: "POST" }));
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET");
    expect((await json(response)).error.code).toBe("method_not_allowed");
  });
  test("supports cacheable CORS preflight", async () => {
    const response = await v1.fetch(request("routes", { method: "OPTIONS" }));
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("access-control-max-age")).toBe("86400");
  });
  test("keeps legacy response shapes backwards compatible", async () => {
    const response = await legacyBuildings.fetch(
      new Request("https://gapwise.ca/api/utm-buildings"),
    );
    const body = await json(response);
    expect(body.service).toBe("gapwise-public-campus");
    expect(Array.isArray(body.buildings)).toBe(true);
    expect(body).not.toHaveProperty("data");
  });
});

test("OpenAPI contract is internally resolvable with unique operations", async () => {
  const spec = await Bun.file("public/openapi.json").json();
  expect(spec.openapi).toBe("3.1.0");
  expect(spec.servers[0].url).toBe("https://api.gapwise.ca/v1");
  const operationIds: string[] = [];
  for (const [path, item] of Object.entries<any>(spec.paths))
    for (const [method, operation] of Object.entries<any>(item)) {
      if (["get", "post", "put", "patch", "delete"].includes(method)) {
        operationIds.push(operation.operationId);
        if (path.startsWith("/api/")) expect(operation.deprecated).toBe(true);
      }
    }
  expect(new Set(operationIds).size).toBe(operationIds.length);
  const refs: string[] = [];
  JSON.stringify(spec, (key, value) => {
    if (key === "$ref" && typeof value === "string") refs.push(value);
    return value;
  });
  for (const ref of refs) {
    expect(ref.startsWith("#/"), `external ref ${ref}`).toBe(true);
    let node: any = spec;
    for (const segment of ref.slice(2).split("/"))
      node = node[segment.replaceAll("~1", "/").replaceAll("~0", "~")];
    expect(node, `unresolved ref ${ref}`).toBeDefined();
  }
});

test("documents honest serverless abuse protection instead of a process-local counter", async () => {
  const source = await Bun.file("api/v1.ts").text();
  const spec = await Bun.file("public/openapi.json").text();
  expect(source).not.toContain("rateBuckets");
  expect(source).not.toContain("x-forwarded-for");
  expect(spec).toContain("does not claim a globally exact application counter");
});
