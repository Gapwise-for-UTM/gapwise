import { describe, expect, test } from "bun:test";
import { renderLinearTimetableSvg } from "@/lib/timetable-linear-export";
import { renderLinearTimetableHeatmapSvg } from "@/lib/timetable-linear-heatmap-export";
import type { TimetableHeatmapData } from "@/lib/timetable-heatmap-export";
import { meeting } from "./fixtures";

describe("clean export theme", () => {
  test("renders the dark timetable with neutral surfaces and Gapwise blue", () => {
    const { svg } = renderLinearTimetableSvg([meeting()], "Fall", "dark", 2, "");

    expect(svg).toContain("#111113");
    expect(svg).toContain("#151518");
    expect(svg).toContain("#18181b");
    expect(svg).toContain("#4c8dff");
    expect(svg).not.toContain("#6975df");
    expect(svg).not.toContain("#5965cc");
    expect(svg).not.toContain("#090c13");
    expect(svg).not.toContain('filter="url(#panel-shadow)"');
    expect(svg).not.toContain('filter="url(#event-shadow)"');
  });

  test("renders the dark heatmap with the same neutral canvas and Gapwise blue", () => {
    const data: TimetableHeatmapData = {
      selection: "Fall",
      visits: [{ buildingCode: "MN", count: 2 }],
      routes: [],
      totalStops: 2,
      uniqueBuildings: 1,
      maxVisits: 2,
    };
    const svg = renderLinearTimetableHeatmapSvg(data, "dark");

    expect(svg).toContain("#111113");
    expect(svg).toContain("#1b1b1f");
    expect(svg).toContain("#2a2a2f");
    expect(svg).toContain("#4c8dff");
    expect(svg).not.toContain("#6975df");
    expect(svg).not.toContain("#5965cc");
    expect(svg).not.toContain("#040912");
    expect(svg).not.toContain('filter="url(#building-glow)"');
  });
});
