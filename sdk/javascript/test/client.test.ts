import { expect, test } from "bun:test";
import { Gapwise, GapwiseApiError } from "../src/index.js";
test("uses canonical paths and unwraps resources", async () => {
  const urls: string[] = [];
  const client = new Gapwise({
    fetch: (async (input) => {
      urls.push(String(input));
      return Response.json({ buildings: [{ code: "MN" }] });
    }) as typeof fetch,
  });
  expect((await client.buildings.list())[0]?.code).toBe("MN");
  expect(urls).toEqual(["https://api.gapwise.ca/v1/buildings"]);
});
test("supports custom base URLs and typed errors", async () => {
  const client = new Gapwise({
    baseUrl: "https://example.test/v1/",
    fetch: (async () =>
      Response.json(
        { error: { code: "not_found", message: "No place" } },
        { status: 404 },
      )) as typeof fetch,
  });
  expect(client.places.get("x")).rejects.toBeInstanceOf(GapwiseApiError);
});
