import { describe, expect, test } from "bun:test";
import { CAMPUS_BUILDING_FOOTPRINTS } from "../src/data/utm/building-footprints";
import { serverCampusBuildingFootprints } from "../src/server/public-campus/footprints";

describe("server public campus footprints", () => {
  test("matches the canonical web map geometry exactly", () => {
    expect(serverCampusBuildingFootprints()).toEqual(CAMPUS_BUILDING_FOOTPRINTS.features);
  });
});
