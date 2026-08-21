import { describe, expect, test } from "bun:test";
import {
  availableExportTerms,
  createTimetableExportPlan,
  generateTimetablePng,
  timetableExportFilename,
} from "@/lib/timetable-export";
import { meeting } from "./fixtures";

describe("timetable image export", () => {
  const schedules = [
    meeting(),
    meeting({ id: "winter", term: "Winter", weekday: "Tuesday" }),
    meeting({ id: "summer", term: "Summer", weekday: "Wednesday" }),
  ];

  test("offers only terms backed by real schedule data, in academic display order", () => {
    expect(availableExportTerms([schedules[0]!, schedules[2]!])).toEqual(["Fall", "Summer"]);
  });

  test("selects readable layouts for one, two, and three terms", () => {
    expect(createTimetableExportPlan(schedules, "Fall").layout).toBe("single");
    expect(createTimetableExportPlan(schedules.slice(0, 2), "all").layout).toBe("side-by-side");
    const three = createTimetableExportPlan(schedules, "all", 3);
    expect(three.layout).toBe("grid");
    expect(three.pixelRatio).toBeGreaterThanOrEqual(1.5);
    expect(three.width * three.height * three.pixelRatio ** 2).toBeLessThanOrEqual(16_000_001);
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

  test("builds stable, shareable PNG filenames", () => {
    expect(timetableExportFilename("Fall", ["Fall"])).toBe("gapwise-fall-timetable.png");
    expect(timetableExportFilename("all", ["Fall", "Winter", "Summer"])).toBe(
      "gapwise-fall-winter-summer-timetable.png",
    );
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
      generateTimetablePng([schedules[0]!], "Fall", 2, () => brokenImage, {
        createObjectURL: () => "blob:test",
        revokeObjectURL: () => undefined,
      }),
    ).rejects.toThrow("artwork could not be rendered");
  });
});
