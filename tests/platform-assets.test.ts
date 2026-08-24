import { describe, expect, test } from "bun:test";
import { createGapwiseClient } from "../public/sdk/gapwise-utm.js";

type DatasetBuilding = {
  code: string;
  provenance: Array<{ source: string; sourceUrl: string; verificationStatus: string }>;
  [key: string]: unknown;
};

describe("Gapwise Platform static assets", () => {
  test("publishes the bounded public API contract", async () => {
    const spec = (await Bun.file("public/openapi.json").json()) as {
      openapi: string;
      paths: Record<string, unknown>;
    };

    expect(spec.openapi).toBe("3.1.0");
    expect(Object.keys(spec.paths)).toEqual(
      expect.arrayContaining([
        "/",
        "/buildings",
        "/buildings/{building}",
        "/gaps/plan",
        "/places",
        "/places/{placeId}",
        "/routes",
        "/api/utm-building",
        "/api/utm-buildings",
        "/api/utm-gap-plan",
        "/api/utm-place",
        "/api/utm-places",
        "/api/utm-route",
      ]),
    );
  });

  test("publishes a 30-building provenance-preserving public snapshot", async () => {
    const dataset = (await Bun.file("public/data/utm-campus-v1.json").json()) as {
      schemaVersion: number;
      buildingCount: number;
      buildings: DatasetBuilding[];
      licenseNotice: string;
    };

    expect(dataset.schemaVersion).toBe(1);
    expect(dataset.buildingCount).toBe(30);
    expect(dataset.buildings).toHaveLength(30);
    expect(new Set(dataset.buildings.map((building) => building.code)).size).toBe(30);
    expect(dataset.buildings.every((building) => building.provenance.length > 0)).toBe(true);
    expect(dataset.buildings.some((building) => building.code === "MN")).toBe(true);
    expect(dataset.licenseNotice).toContain("OpenStreetMap");

    for (const building of dataset.buildings) {
      expect(building).not.toHaveProperty("userId");
      expect(building).not.toHaveProperty("email");
      expect(building).not.toHaveProperty("meetings");
      expect(building).not.toHaveProperty("liveLocation");
    }
  });

  test("keeps the public browser client dependency-free and bounded to public campus endpoints", async () => {
    const sdk = await Bun.file("public/sdk/gapwise-utm.js").text();

    expect(sdk).not.toMatch(/^\s*import\s/m);
    expect(sdk).toContain("/api/utm-buildings");
    expect(sdk).toContain("/api/utm-building?q=");
    expect(sdk).toContain("/api/utm-route");
    expect(sdk).toContain("/api/utm-gap-plan");
    expect(sdk).toContain("/api/utm-places");
    expect(sdk).toContain("/api/utm-place?id=");
    expect(sdk).toContain("export const gapwise");
  });

  test("serves TypeScript declarations as text rather than MPEG transport stream", async () => {
    const config = (await Bun.file("vercel.json").json()) as {
      headers?: Array<{
        source?: string;
        headers?: Array<{ key?: string; value?: string }>;
      }>;
    };
    const declarationRule = config.headers?.find((rule) => rule.source === "/sdk/gapwise-utm.d.ts");
    const contentType = declarationRule?.headers?.find(
      (header) => header.key?.toLowerCase() === "content-type",
    );

    expect(contentType?.value).toBe("text/plain; charset=utf-8");
  });

  test("executes the documented route and gap-plan SDK calls", async () => {
    const requests: Array<{ url: string; method: string; body: string | null }> = [];
    const mockFetch: typeof globalThis.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method ?? "GET";
      const body = typeof init?.body === "string" ? init.body : null;
      requests.push({ url, method, body });

      const payload = url.endsWith("/api/utm-route")
        ? { service: "gapwise-public-campus", route: { status: "routed", estimatedSeconds: 180 } }
        : {
            service: "gapwise-public-campus",
            gapPlan: { assessment: { primary: { id: "study" } } },
          };
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const client = createGapwiseClient({ baseUrl: "https://example.test/", fetch: mockFetch });

    const route = await client.route({ from: "MN", to: "IB" });
    expect(route.route.status).toBe("routed");

    const plan = await client.planGap({
      from: "MN",
      to: "IB",
      term: "Fall",
      weekday: "Wednesday",
      startTime: 660,
      endTime: 780,
    });
    expect(plan.gapPlan.assessment.primary.id).toBe("study");

    expect(requests.map(({ url, method }) => [url, method])).toEqual([
      ["https://example.test/api/utm-route", "POST"],
      ["https://example.test/api/utm-gap-plan", "POST"],
    ]);
    expect(JSON.parse(requests[0]?.body ?? "null")).toEqual({ from: "MN", to: "IB" });
  });
});
