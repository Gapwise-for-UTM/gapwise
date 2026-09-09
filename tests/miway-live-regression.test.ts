import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

test("keeps live MiWay lean, private, and resilient", async () => {
  const [map, client, server, health] = await Promise.all([
    readFile("src/components/CampusMap.tsx", "utf8"),
    readFile("src/features/transit/miway-live-layer.ts", "utf8"),
    readFile("src/server/miway.ts", "utf8"),
    readFile("api/health.ts", "utf8"),
  ]);

  expect(map).toContain('void import("@/features/transit/miway-live-layer")');
  expect(client).toContain('credentials: "omit"');
  expect(client).not.toContain('cache: "no-store"');
  expect(server).not.toContain("application/x-protobuf");
  expect(server).not.toContain("application/protobuf");
  expect(server).toContain("fetchBytes(TRIP_UPDATES_URL, controller.signal).catch(() => null)");
  expect(health).toContain("s-maxage=4");
});
