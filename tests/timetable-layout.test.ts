import { describe, expect, test } from "bun:test";
import { buildTimetableScale, isCompactMeetingCard } from "@/lib/timetable-layout";
import { meeting } from "./fixtures";

describe("timetable card layout", () => {
  test("uses compact content for one-hour and overlapping cards", () => {
    expect(isCompactMeetingCard(meeting(), 1)).toBe(true);
    expect(isCompactMeetingCard(meeting({ endTime: 660 }), 1)).toBe(false);
    expect(isCompactMeetingCard(meeting({ endTime: 660 }), 2)).toBe(true);
  });

  test("compresses only consecutive globally empty hours without shrinking classes", () => {
    const hours = Array.from({ length: 14 }, (_, index) => index + 8);
    const meetings = [
      meeting({ startTime: 540, endTime: 660 }),
      meeting({ id: "evening", startTime: 1140, endTime: 1260 }),
    ];
    const scale = buildTimetableScale(hours, meetings, true, 60, 20);

    expect(scale.compactableHours.has(8)).toBe(false);
    expect(scale.compactableHours.has(12)).toBe(true);
    expect(scale.hourHeights.get(12)).toBe(20);
    expect(scale.minuteToTop(660) - scale.minuteToTop(540)).toBe(120);
    expect(scale.minuteToTop(1140)).toBeLessThan((1140 - 480) * 1);
  });
});
