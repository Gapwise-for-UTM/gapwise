import { describe, expect, test } from "bun:test";
import {
  availableExportTerms,
  createTimetableExportPlan,
  escapeExportText,
  exportMinutePosition,
  EXPORT_PALETTES,
  generateTimetablePng,
  meetingExportStyle,
  renderTimetableExportSvg,
  resolveExportTheme,
  timetableExportTitle,
  timetableExportFilename,
} from "@/lib/timetable-export";
import { meeting } from "./fixtures";

describe("timetable image export", () => {
  const schedules = [
    meeting(),
    meeting({ id: "winter", term: "Winter", weekday: "Tuesday" }),
    meeting({ id: "summer", term: "Summer", weekday: "Wednesday" }),
  ];

  test("discovers only real terms, including Summer conditionally", () => {
    expect(availableExportTerms(schedules.slice(0, 2))).toEqual(["Fall", "Winter"]);
    expect(availableExportTerms([schedules[0]!, schedules[2]!])).toEqual(["Fall", "Summer"]);
  });

  test("uses deliberate single and two-term layouts with a bounded retina budget", () => {
    expect(createTimetableExportPlan(schedules, "Fall").layout).toBe("single");
    expect(createTimetableExportPlan(schedules.slice(0, 2), "all").layout).toBe("side-by-side");
    for (const selection of ["Fall", "all"] as const) {
      const plan = createTimetableExportPlan(schedules, selection, 3);
      expect(plan.pixelRatio).toBeGreaterThanOrEqual(1.5);
      expect(plan.width * plan.height * plan.pixelRatio ** 2).toBeLessThanOrEqual(16_000_001);
    }
  });

  test("keeps every panel inside deterministic content bounds regardless of device density", () => {
    const lowDensity = createTimetableExportPlan(schedules.slice(0, 2), "all", 1);
    const highDensity = createTimetableExportPlan(schedules.slice(0, 2), "all", 3);
    expect([lowDensity.width, lowDensity.height, lowDensity.startHour, lowDensity.endHour]).toEqual(
      [highDensity.width, highDensity.height, highDensity.startHour, highDensity.endHour],
    );
    for (const panel of highDensity.panels) {
      expect(panel.x).toBeGreaterThanOrEqual(0);
      expect(panel.y).toBeGreaterThanOrEqual(0);
      expect(panel.x + panel.width).toBeLessThanOrEqual(highDensity.width);
      expect(panel.y + panel.height).toBeLessThanOrEqual(highDensity.height);
    }
  });

  test("uses one shared comparison range for Fall and Winter without cropping events", () => {
    const meetings = [
      meeting({ startTime: 420, endTime: 480 }),
      meeting({ id: "late", term: "Winter", startTime: 1140, endTime: 1260 }),
    ];
    const plan = createTimetableExportPlan(meetings, "all");
    expect(plan.startHour * 60).toBeLessThanOrEqual(420);
    expect(plan.endHour * 60).toBeGreaterThanOrEqual(1260);
    expect(plan.panels[0]!.height).toBe(plan.panels[1]!.height);
  });

  test("centers the third sparse term in a balanced composition", () => {
    const plan = createTimetableExportPlan(schedules, "all", 3);
    expect(plan.layout).toBe("balanced-grid");
    expect(plan.panels[2]!.x).toBe(Math.round((plan.width - plan.termWidth) / 2));
    expect(plan.panels[2]!.y).toBeGreaterThan(plan.panels[0]!.y);
  });

  test("stacks dense multi-term schedules rather than shrinking their cards", () => {
    const dense = schedules.slice(0, 2).flatMap((base, termIndex) =>
      Array.from({ length: 18 }, (_, index) =>
        meeting({
          ...base,
          id: `${termIndex}-${index}`,
          weekday: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"][
            index % 5
          ] as typeof base.weekday,
          startTime: 480 + (index % 6) * 90,
          endTime: 540 + (index % 6) * 90,
        }),
      ),
    );
    expect(createTimetableExportPlan(dense, "all").layout).toBe("stacked");
  });

  test("provides distinct semantic light and dark palettes", () => {
    expect(EXPORT_PALETTES.light.pageBackground).not.toBe(EXPORT_PALETTES.dark.pageBackground);
    expect(EXPORT_PALETTES.light.eventSurface).toBe("#ffffff");
    expect(EXPORT_PALETTES.dark.eventSurface).not.toBe("#000000");
    expect(EXPORT_PALETTES.dark.foreground).not.toBe(EXPORT_PALETTES.dark.mutedForeground);
    expect(EXPORT_PALETTES.light.lec).not.toBe(EXPORT_PALETTES.light.tut);
    expect(EXPORT_PALETTES.dark.tut).not.toBe(EXPORT_PALETTES.dark.pra);
  });

  test("resolves Match Gapwise without modifying explicit appearance", () => {
    expect(resolveExportTheme("match", "dark")).toBe("dark");
    expect(resolveExportTheme("match", "light")).toBe("light");
    expect(resolveExportTheme("light", "dark")).toBe("light");
    expect(resolveExportTheme("dark", "light")).toBe("dark");
  });

  test("uses opaque activity surfaces and preserves custom colors", () => {
    const lec = meetingExportStyle(meeting({ activityType: "LEC" }), "light");
    const tut = meetingExportStyle(meeting({ activityType: "TUT" }), "light");
    const custom = meetingExportStyle(meeting({ color: "#ef4444" }), "dark");
    expect(lec.accent).toBe(EXPORT_PALETTES.light.lec);
    expect(tut.accent).toBe(EXPORT_PALETTES.light.tut);
    expect(custom.accent).not.toBe(EXPORT_PALETTES.dark.lec);
    expect(custom.accent).toMatch(/^#[0-9a-f]{6}$/);
    expect(lec.base).toMatch(/^#[0-9a-f]{6}$/);
    expect(lec.base).not.toContain("rgba");
  });

  test("gives STUDY and personal blocks intentional semantics", () => {
    const study = meetingExportStyle(meeting({ sectionCode: "STUDY" }), "dark");
    const personal = meetingExportStyle(
      meeting({ sectionCode: "PERSONAL", color: "#22c55e" }),
      "light",
    );
    expect(study).toMatchObject({
      dashed: true,
      label: "STUDY",
      accent: EXPORT_PALETTES.dark.accent,
    });
    expect(personal).toMatchObject({ dashed: false, label: "PERSONAL", accent: "#22c55e" });
  });

  test("renders opaque cards above the grid and embeds supplied Geist typography", () => {
    const plan = createTimetableExportPlan([schedules[0]!], "Fall");
    const svg = renderTimetableExportSvg(
      [schedules[0]!],
      plan,
      "dark",
      "data:font/woff2;base64,AA==",
    );
    expect(svg).toContain("font-family:ExportGeist");
    expect(svg).toContain("data:font/woff2;base64,AA==");
    expect(svg).toContain(`fill="${meetingExportStyle(schedules[0]!, "dark").base}"`);
    expect(svg).not.toMatch(/fill-opacity=.*event/);
  });

  test("escapes untrusted timetable text before SVG rendering", () => {
    expect(escapeExportText(`<script>&"'</script>`)).toBe(
      "&lt;script&gt;&amp;&quot;&apos;&lt;/script&gt;",
    );
    const hostile = meeting({ courseCode: "<bad>", courseName: "A & B" });
    const svg = renderTimetableExportSvg([hostile], createTimetableExportPlan([hostile], "Fall"));
    expect(svg).toContain("&lt;bad&gt;");
    expect(svg).not.toContain("<bad>");
  });

  test("builds exact neutral titles and unbranded filenames", () => {
    expect(timetableExportTitle(["Fall"])).toBe("Fall timetable");
    expect(timetableExportTitle(["Winter"])).toBe("Winter timetable");
    expect(timetableExportTitle(["Summer"])).toBe("Summer timetable");
    expect(timetableExportTitle(["Fall", "Winter"])).toBe("Fall/Winter timetable");
    expect(timetableExportFilename("Fall", ["Fall"])).toBe("fall-timetable.png");
    expect(timetableExportFilename("all", ["Fall", "Winter", "Summer"])).toBe(
      "fall-winter-summer-timetable.png",
    );
  });

  test("keeps minute geometry proportional without duration distortion", () => {
    const hourHeight = 54;
    expect(
      exportMinutePosition(660, 8, hourHeight) - exportMinutePosition(540, 8, hourHeight),
    ).toBe(hourHeight * 2);
    expect(
      exportMinutePosition(570, 8, hourHeight) - exportMinutePosition(540, 8, hourHeight),
    ).toBe(hourHeight / 2);
  });

  test("emits only the period heading and no product branding", () => {
    const meetings = schedules.slice(0, 2);
    const svg = renderTimetableExportSvg(meetings, createTimetableExportPlan(meetings, "all"));
    expect(svg).toContain(">Fall/Winter timetable</text>");
    for (const forbidden of [
      "GAPWISE",
      "Gapwise",
      "gapwise.ca",
      "Generated with",
      "Academic schedule",
    ]) {
      expect(svg).not.toContain(forbidden);
    }
  });

  test("surfaces rasterization failures without hiding the cause", async () => {
    const brokenImage = {
      set src(_value: string) {
        this.onerror?.(new Event("error"));
      },
      onload: null,
      onerror: null,
    } as unknown as HTMLImageElement;
    await expect(
      generateTimetablePng(
        [schedules[0]!],
        "Fall",
        "light",
        2,
        () => brokenImage,
        { createObjectURL: () => "blob:test", revokeObjectURL: () => undefined },
        "data:font/woff2;base64,AA==",
      ),
    ).rejects.toThrow("artwork could not be rendered");
  });
});
