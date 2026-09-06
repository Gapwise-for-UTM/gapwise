import { describe, expect, test } from "bun:test";
import { createTimetableExportPlan } from "@/lib/timetable-export";
import {
  generateTimetablePrintSvg,
  meetingPrintStyle,
  PRINT_EXPORT_PALETTE,
  renderTimetablePrintSvg,
  timetablePrintFilename,
} from "@/lib/timetable-print-export";
import { ASSESSMENT_WINDOW_NOTE } from "@/lib/timetable-types";
import { meeting } from "./fixtures";

function isGrayscaleHex(value: string) {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value);
  if (!match) return false;
  return match[1] === match[2] && match[2] === match[3];
}

describe("print-ready timetable export", () => {
  test("uses only printer-safe grayscale colors with true white paper and black type", () => {
    expect(PRINT_EXPORT_PALETTE.pageBackground).toBe("#ffffff");
    expect(PRINT_EXPORT_PALETTE.foreground).toBe("#000000");
    for (const value of Object.values(PRINT_EXPORT_PALETTE)) {
      expect(isGrayscaleHex(value)).toBe(true);
    }
  });

  test("ignores custom course colors and keeps event meaning explicit in monochrome", () => {
    const custom = meetingPrintStyle(
      meeting({ activityType: "PRA", color: "#ef4444", sectionCode: "PRA0101" }),
    );
    const study = meetingPrintStyle(meeting({ sectionCode: "STUDY", color: "#22c55e" }));
    const personal = meetingPrintStyle(meeting({ sectionCode: "PERSONAL", color: "#3b82f6" }));

    expect(custom.label).toBe("PRA");
    expect(custom.base).toBe(PRINT_EXPORT_PALETTE.practiceEventSurface);
    expect(custom.base).not.toBe("#ef4444");
    expect(study).toMatchObject({ dashed: true, label: "STUDY", reserved: false });
    expect(personal.label).toBe("PERSONAL");
    expect(personal.strokeWidth).toBeGreaterThan(custom.strokeWidth);
  });

  test("renders reserved assessment windows as printer-safe RES placeholders", () => {
    const reserved = meeting({
      notes: ASSESSMENT_WINDOW_NOTE,
      locationUnknown: true,
      locationType: "tba",
      buildingCode: null,
      room: null,
      startTime: 780,
      endTime: 900,
    });
    const style = meetingPrintStyle(reserved);
    expect(style).toMatchObject({
      reserved: true,
      dashed: true,
      label: "RES",
      border: PRINT_EXPORT_PALETTE.strongBorder,
    });

    const svg = renderTimetablePrintSvg([reserved], createTimetableExportPlan([reserved], "Fall"));
    expect(svg).toContain('id="print-reserved-hatch"');
    expect(svg).toContain('fill="url(#print-reserved-hatch)"');
    expect(svg).toContain('stroke-dasharray="5 4"');
    expect(svg).toContain(">RES</text>");
    expect(svg).toContain(">Reserved assessment window</text>");
    expect(svg).toContain(">Only active when announced</text>");
    expect(svg).not.toContain(">LEC</text>");
  });

  test("renders a self-contained vector with embedded typography and no screen effects", () => {
    const schedule = [meeting({ color: "#ef4444" })];
    const svg = renderTimetablePrintSvg(
      schedule,
      createTimetableExportPlan(schedule, "Fall"),
      "data:font/woff2;base64,AA==",
    );

    expect(svg).toContain('shape-rendering="geometricPrecision"');
    expect(svg).toContain('text-rendering="geometricPrecision"');
    expect(svg).toContain("font-family:PrintGeist");
    expect(svg).toContain("data:font/woff2;base64,AA==");
    expect(svg).toContain(`fill="${PRINT_EXPORT_PALETTE.pageBackground}"`);
    expect(svg).toContain(`fill="${PRINT_EXPORT_PALETTE.foreground}"`);
    for (const forbidden of [
      "radialGradient",
      "linearGradient",
      "feDropShadow",
      "filter=",
      "#ef4444",
      "#2866c7",
      "#78a9f2",
    ]) {
      expect(svg).not.toContain(forbidden);
    }
  });

  test("preserves conditional weekend columns in the print composition", () => {
    const schedule = [
      meeting({ weekday: "Saturday" }),
      meeting({ id: "sunday", weekday: "Sunday", startTime: 720, endTime: 780 }),
    ];
    const svg = renderTimetablePrintSvg(schedule, createTimetableExportPlan(schedule, "Fall"));
    expect(svg).toContain(">SAT</text>");
    expect(svg).toContain(">SUN</text>");
  });

  test("uses a distinct print filename and produces an SVG blob without rasterization", async () => {
    const schedule = [meeting()];
    expect(timetablePrintFilename("Fall", ["Fall"])).toBe("fall-timetable-print.svg");
    expect(timetablePrintFilename("all", ["Fall", "Winter"])).toBe(
      "fall-winter-timetable-print.svg",
    );

    const result = await generateTimetablePrintSvg(schedule, "Fall", "data:font/woff2;base64,AA==");
    expect(result.filename).toBe("fall-timetable-print.svg");
    expect(result.blob.type).toBe("image/svg+xml;charset=utf-8");
    expect(await result.blob.text()).toContain("<svg");
  });
});
