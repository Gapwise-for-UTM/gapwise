import { describe, expect, test } from "bun:test";
import { createTimetableExportPlan } from "@/lib/timetable-export";
import { renderTimetablePrintSvg, timetablePrintOrientation } from "@/lib/timetable-print-export";
import { meeting } from "./fixtures";

describe("print timetable page fitting", () => {
  test("chooses the orientation that maximizes usable printed scale", () => {
    expect(timetablePrintOrientation({ width: 1200, height: 1800 })).toBe("portrait");
    expect(timetablePrintOrientation({ width: 1800, height: 900 })).toBe("landscape");
  });

  test("exports print CSS that fits the SVG to one physical page", () => {
    const schedule = [meeting()];
    const plan = createTimetableExportPlan(schedule, "Fall");
    const svg = renderTimetablePrintSvg(schedule, plan, "data:font/woff2;base64,AA==");

    expect(svg).toContain(`@page{size:${timetablePrintOrientation(plan)};margin:0}`);
    expect(svg).toContain(
      "@media print{:root{width:100%!important;height:100%!important;max-width:none!important;max-height:none!important",
    );
    expect(svg).toContain("page-break-inside:avoid");
    expect(svg).toMatch(/viewBox="-\d+ -\d+ \d+ \d+"/);
  });

  test("adds a printer-safe white perimeter around the schedule", () => {
    const schedule = [meeting()];
    const plan = createTimetableExportPlan(schedule, "Fall");
    const svg = renderTimetablePrintSvg(schedule, plan);
    const viewBox = /viewBox="(-\d+) (-\d+) (\d+) (\d+)"/.exec(svg);

    expect(viewBox).not.toBeNull();
    const [, x, y, width, height] = viewBox!;
    expect(Number(x)).toBeLessThan(0);
    expect(Number(y)).toBeLessThan(0);
    expect(Number(width)).toBeGreaterThan(plan.width);
    expect(Number(height)).toBeGreaterThan(plan.height);
  });
});
