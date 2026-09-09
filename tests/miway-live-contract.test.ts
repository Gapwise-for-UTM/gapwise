import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

describe("MiWay live map contract", () => {
  test("keeps live transit code opt-in and out of the initial map path", async () => {
    const [map, client, manifest] = await Promise.all([
      readFile("src/components/CampusMap.tsx", "utf8"),
      readFile("src/features/transit/miway-live-client.ts", "utf8"),
      readFile("package.json", "utf8"),
    ]);

    expect(map).toContain('void import("@/features/transit/miway-live-client")');
    expect(map).toContain('void import("maplibre-gl")');
    expect(client).toContain('fetch("/api/miway-live"');
    expect(client).toContain('credentials: "omit"');
    expect(client).toContain('document.addEventListener("visibilitychange"');
    expect(client).toContain('window.addEventListener("offline"');
    expect(manifest).not.toContain("gtfs-realtime-bindings");
    expect(manifest).not.toContain("protobufjs");
  });

  test("keeps MiWay upstream access server-side, bounded, and shared", async () => {
    const api = await readFile("api/miway-live.ts", "utf8");
    expect(api).toContain("VehiclePositions.pb");
    expect(api).toContain("TripUpdates.pb");
    expect(api).toContain("MAX_UPSTREAM_BYTES");
    expect(api).toContain("AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)");
    expect(api).toContain("s-maxage=4");
    expect(api).toContain('new Set(["0910", "0490", "4800"])');
  });
});
