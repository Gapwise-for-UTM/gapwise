import { describe, expect, test } from "bun:test";
import { UTM_ROUTING_GRAPH } from "@/data/utm/campus";
import { isPointConfidentlyInsideCampus } from "@/features/routing/campus-presence";

describe("campus presence", () => {
  test("accepts a precise point in the middle of the bundled UTM network", () => {
    expect(
      isPointConfidentlyInsideCampus(
        { longitude: -79.66475, latitude: 43.55105, accuracyMeters: 12 },
        UTM_ROUTING_GRAPH,
      ),
    ).toBe(true);
  });

  test("rejects a clearly off-campus point", () => {
    expect(
      isPointConfidentlyInsideCampus(
        { longitude: -79.7, latitude: 43.57, accuracyMeters: 10 },
        UTM_ROUTING_GRAPH,
      ),
    ).toBe(false);
  });

  test("rejects an otherwise plausible point with poor reported accuracy", () => {
    expect(
      isPointConfidentlyInsideCampus(
        { longitude: -79.66475, latitude: 43.55105, accuracyMeters: 150 },
        UTM_ROUTING_GRAPH,
      ),
    ).toBe(false);
  });
});
