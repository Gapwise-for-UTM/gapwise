import { describe, expect, test } from "bun:test";
import {
  Gapwise,
  GapwiseApiError,
  GapwiseResponseError,
  GapwiseTimeoutError,
} from "../src/index.js";
const meta = { apiVersion: "v1", dataVersion: "test", requestId: "req-1" };
function mock(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  return (async (input, init) => handler(String(input), init)) as typeof fetch;
}

describe("Gapwise JavaScript SDK", () => {
  test("uses canonical URLs and unwraps every public method", async () => {
    const requests: Array<{ url: string; method: string; body?: string }> = [];
    const client = new Gapwise({
      fetch: mock((url, init) => {
        requests.push({
          url,
          method: init?.method ?? "GET",
          ...(typeof init?.body === "string" ? { body: init.body } : {}),
        });
        const data = url.endsWith("/v1")
          ? { apiVersion: "v1" }
          : url.includes("/buildings/MN")
            ? { code: "MN" }
            : url.includes("/places/utm-library")
              ? { id: "utm-library" }
              : url.endsWith("/routes")
                ? { status: "routed" }
                : { assessment: { confidence: 1 } };
        return Response.json({ data, meta });
      }),
    });
    expect((await client.info()).apiVersion).toBe("v1");
    expect((await client.buildings.get("MN")).code).toBe("MN");
    expect((await client.places.get("utm-library")).id).toBe("utm-library");
    expect((await client.routes.calculate({ from: "MN", to: "IB" })).status).toBe("routed");
    await client.gaps.plan({
      from: "MN",
      to: "IB",
      term: "Fall",
      weekday: "Monday",
      startTime: 600,
      endTime: 720,
    });
    expect(requests.map((item) => [item.url, item.method])).toEqual([
      ["https://api.gapwise.ca/v1", "GET"],
      ["https://api.gapwise.ca/v1/buildings/MN", "GET"],
      ["https://api.gapwise.ca/v1/places/utm-library", "GET"],
      ["https://api.gapwise.ca/v1/routes", "POST"],
      ["https://api.gapwise.ca/v1/gaps/plan", "POST"],
    ]);
    expect(JSON.parse(requests[3]!.body!)).toEqual({ from: "MN", to: "IB" });
  });
  test("constructs discovery filters and retains pagination metadata", async () => {
    const urls: string[] = [];
    const client = new Gapwise({
      baseUrl: "https://example.test/v1////",
      fetch: mock((url) => {
        urls.push(url);
        return Response.json({
          data: [{ code: "IB" }],
          meta: { ...meta, pagination: { limit: 1, offset: 2, count: 1, total: 4, nextOffset: 3 } },
        });
      }),
    });
    const buildings = await client.buildings.list({
      q: "instructional",
      category: "academic",
      limit: 1,
      offset: 2,
    });
    expect(buildings.data[0]?.code).toBe("IB");
    expect(buildings.meta.pagination.nextOffset).toBe(3);
    expect(urls[0]).toBe(
      "https://example.test/v1/buildings?q=instructional&category=academic&limit=1&offset=2",
    );
    await client.places.list({ q: "study", kind: "library", building: "HM", openNow: "unknown" });
    expect(urls[1]).toContain("q=study&kind=library&building=HM&openNow=unknown");
  });
  test("normalizes HeadersInit forms and supports caller cancellation", async () => {
    const controller = new AbortController();
    let received: RequestInit | undefined;
    const client = new Gapwise({
      headers: new Headers([
        ["x-client", "example"],
        ["accept", "application/vnd.gapwise+json"],
      ]),
      fetch: mock(async (_url, init) => {
        received = init;
        await new Promise((_resolve, reject) =>
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason)),
        );
        return Response.json({});
      }),
    });
    const pending = client.info({ signal: controller.signal });
    controller.abort(new Error("cancelled"));
    await expect(pending).rejects.toThrow("cancelled");
    const headers = new Headers(received?.headers);
    expect(headers.get("x-client")).toBe("example");
    expect(headers.get("accept")).toBe("application/vnd.gapwise+json");
  });
  test("accepts tuple-array headers and lets request headers override client headers", async () => {
    let received: Headers | undefined;
    const client = new Gapwise({
      headers: [["content-type", "text/plain"]],
      fetch: mock((_url, init) => {
        received = new Headers(init?.headers);
        return Response.json({ data: { status: "routed" }, meta });
      }),
    });
    await client.routes.calculate({ from: "MN", to: "IB" });
    expect(received?.get("content-type")).toBe("application/json");
    expect(received?.get("accept")).toBe("application/json");
  });
  test("throws a distinct timeout error", async () => {
    const client = new Gapwise({
      timeoutMs: 5,
      fetch: mock(async (_url, init) => {
        await new Promise((_resolve, reject) =>
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          ),
        );
        return Response.json({});
      }),
    });
    await expect(client.info()).rejects.toBeInstanceOf(GapwiseTimeoutError);
  });
  test("exposes structured API errors for narrowing", async () => {
    const client = new Gapwise({
      fetch: mock(() =>
        Response.json(
          {
            error: { code: "place_not_found", message: "Missing", details: { id: "x" } },
            meta: { apiVersion: "v1", requestId: "req-x" },
          },
          { status: 404 },
        ),
      ),
    });
    try {
      await client.places.get("x");
      throw new Error("expected rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(GapwiseApiError);
      if (error instanceof GapwiseApiError) {
        expect(error.code).toBe("place_not_found");
        expect(error.status).toBe(404);
        expect(error.requestId).toBe("req-x");
      }
    }
  });
  test("handles malformed success and error responses", async () => {
    const malformed = new Gapwise({ fetch: mock(() => new Response("not json", { status: 200 })) });
    await expect(malformed.info()).rejects.toBeInstanceOf(GapwiseResponseError);
    const server = new Gapwise({ fetch: mock(() => new Response("broken", { status: 502 })) });
    await expect(server.info()).rejects.toMatchObject({
      name: "GapwiseApiError",
      code: "http_error",
      status: 502,
    });
  });
  test("validates identifiers and timeout configuration locally", async () => {
    const client = new Gapwise({ fetch: mock(() => Response.json({})) });
    expect(() => client.buildings.get(" ")).toThrow(TypeError);
    expect(() => new Gapwise({ timeoutMs: 0 })).toThrow(TypeError);
  });
});
