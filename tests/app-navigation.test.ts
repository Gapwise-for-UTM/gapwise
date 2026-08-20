import { describe, expect, test } from "bun:test";
import { destinationFromPath } from "@/features/navigation/use-app-navigation";

describe("app destination selection", () => {
  test("normalizes product paths and trailing slashes", () => {
    expect(destinationFromPath("/today/")).toBe("today");
    expect(destinationFromPath("/timetable")).toBe("timetable");
    expect(destinationFromPath("/gaps///")).toBe("gaps");
    expect(destinationFromPath("/route")).toBe("route");
  });

  test("keeps landing and unknown paths at the home destination", () => {
    expect(destinationFromPath("/")).toBe("home");
    expect(destinationFromPath("/unknown")).toBe("home");
  });
});
