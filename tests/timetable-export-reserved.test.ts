import { describe, expect, test } from "bun:test";
import {
  createTimetableExportPlan,
  EXPORT_PALETTES,
  meetingExportStyle,
  renderTimetableExportSvg,
} from "@/lib/timetable-export";
import { ASSESSMENT_WINDOW_NOTE } from "@/lib/timetable-types";
import { meeting } from "./fixtures";

describe("reserved assessment timetable export", () => {
  const reserved = meeting({
    id: "reserved-window",
    courseCode: "CSC111H5",
    activityType: "LEC",
    notes: ASSESSMENT_WINDOW_NOTE,
    buildingCode: null,
    room: null,
    locationUnknown: true,
    locationType: "tba",
    startTime: 810,
    endTime: 930,
    weekday: "Saturday",
  });

  test("uses RES semantics and the reserved amber accent", () => {
    expect(meetingExportStyle(reserved, "dark")).toMatchObject({
      reserved: true,
      dashed: true,
      label: "RES",
      accent: EXPORT_PALETTES.dark.reserved,
    });
  });

  test("renders reserved cards with hatching and explanatory copy", () => {
    const svg = renderTimetableExportSvg(
      [reserved],
      createTimetableExportPlan([reserved], "Fall"),
      "dark",
    );

    expect(svg).toContain('id="reserved-hatch"');
    expect(svg).toContain('fill="url(#reserved-hatch)"');
    expect(svg).toContain('stroke-dasharray="5 4"');
    expect(svg).toContain(">RES</text>");
    expect(svg).toContain("Reserved assessment window");
    expect(svg).toContain("Only active when announced");
    expect(svg).not.toContain(">LEC</text>");
  });
});
