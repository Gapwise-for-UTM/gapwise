import { describe, expect, test } from "bun:test";
import handler from "../api/v1";

describe("canonical v1 API", () => {
  test("publishes version and privacy metadata", async () => {
    const response = await handler.fetch(
      new Request("https://api.gapwise.ca/api/v1?resource=root"),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      service: "gapwise-public-campus",
      version: "v1",
    });
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("ratelimit-policy")).toContain("q=120");
  });
  test("dispatches canonical building paths to shared campus intelligence", async () => {
    const response = await handler.fetch(
      new Request("https://api.gapwise.ca/api/v1?resource=building&building=MN"),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).building.code).toBe("MN");
  });
  test("uses a consistent nested error envelope", async () => {
    const response = await handler.fetch(
      new Request("https://api.gapwise.ca/api/v1?resource=building&building=NOPE"),
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: "unknown_building", message: expect.any(String) },
    });
  });
  test("supports preflight without invoking private services", async () => {
    const response = await handler.fetch(
      new Request("https://api.gapwise.ca/api/v1?resource=routes", { method: "OPTIONS" }),
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-max-age")).toBe("86400");
  });
});

test("OpenAPI contract has canonical endpoints and resolvable local references", async () => {
  const spec = await Bun.file("public/openapi.json").json();
  expect(spec.openapi).toBe("3.1.0");
  expect(spec.servers[0].url).toBe("https://api.gapwise.ca/v1");
  for (const path of [
    "/",
    "/buildings",
    "/buildings/{building}",
    "/places",
    "/places/{placeId}",
    "/routes",
    "/gaps/plan",
  ])
    expect(spec.paths[path]).toBeDefined();
  const refs: string[] = [];
  JSON.stringify(spec, (key, value) => {
    if (key === "$ref" && typeof value === "string") refs.push(value);
    return value;
  });
  for (const ref of refs) {
    expect(ref.startsWith("#/"), `external ref ${ref}`).toBe(true);
    let node: unknown = spec;
    for (const segment of ref.slice(2).split("/"))
      node = (node as Record<string, unknown>)[segment.replaceAll("~1", "/").replaceAll("~0", "~")];
    expect(node, `unresolved ref ${ref}`).toBeDefined();
  }
});
