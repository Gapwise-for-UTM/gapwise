import { describe, expect, test } from "bun:test";
import {
  CAMPUS_ACCESS_POINTS,
  campusAccessPointsFor,
  getCampusAccessPoint,
} from "@/data/utm/campus-access-points";

describe("campus access point data", () => {
  test("keeps IDs, coordinates, categories, and provenance valid", () => {
    expect(new Set(CAMPUS_ACCESS_POINTS.map((point) => point.id)).size).toBe(
      CAMPUS_ACCESS_POINTS.length,
    );
    for (const point of CAMPUS_ACCESS_POINTS) {
      expect(["transit", "parking", "pickup"]).toContain(point.kind);
      expect(point.coordinates.every(Number.isFinite)).toBe(true);
      expect(point.sourceLabel.length).toBeGreaterThan(0);
      expect(point.sourceUrl).toStartWith("https://");
      expect(point.routingNodeId?.length ?? 0).toBeGreaterThan(0);
      expect(point.routingSourceUrl).toStartWith("https://www.openstreetmap.org/");
    }
  });

  test("looks up supported points without inventing a pickup fallback", () => {
    expect(campusAccessPointsFor("transit").map((point) => point.id)).toContain(
      "miway-utm-bus-station",
    );
    expect(campusAccessPointsFor("parking").map((point) => point.id)).toEqual([
      "parking-p8",
      "parking-p9",
    ]);
    expect(campusAccessPointsFor("pickup")).toEqual([]);
    expect(getCampusAccessPoint("parking-p8")?.label).toBe("Parking Lot P8");
    expect(getCampusAccessPoint("missing")).toBeNull();
  });
});
