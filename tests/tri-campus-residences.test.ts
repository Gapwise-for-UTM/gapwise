import { describe, expect, test } from "bun:test";
import {
  campusResidenceBuildings,
  getResidenceBuildingForCampus,
} from "@/data/campuses";

describe("tri-campus residence inventories", () => {
  test("keeps each campus residence list scoped to that campus", () => {
    const utm = campusResidenceBuildings("utm");
    const utsg = campusResidenceBuildings("utsg");
    const utsc = campusResidenceBuildings("utsc");

    expect(utm.some((building) => building.code === "OPH")).toBe(true);
    expect(utsg.some((building) => building.code === "WI")).toBe(true);
    expect(utsg.some((building) => building.code === "TC")).toBe(true);
    expect(utsg.some((building) => building.code === "BA")).toBe(false);
    expect(utsc.some((building) => building.code === "N")).toBe(true);
    expect(utsc.some((building) => building.code === "SW")).toBe(false);
  });

  test("never resolves a residence code across campus boundaries", () => {
    expect(getResidenceBuildingForCampus("utm", "OPH")?.name).toBe("Oscar Peterson Hall");
    expect(getResidenceBuildingForCampus("utsg", "WI")?.name).toBe("Wilson Hall-New College");
    expect(getResidenceBuildingForCampus("utsc", "N")?.name).toBe("Harmony Commons");

    expect(getResidenceBuildingForCampus("utsg", "OPH")).toBeNull();
    expect(getResidenceBuildingForCampus("utm", "WI")).toBeNull();
  });
});
