import { describe, expect, test } from "bun:test";
import { gapBetween, querySchedulePosition } from "@/lib/schedule-context";
import { meeting } from "./fixtures";

function fixed(id: string, startTime: number, endTime: number) {
  return meeting({ id, startTime, endTime, weekday: "Monday", term: "Fall" });
}

const day = [fixed("first", 540, 600), fixed("second", 660, 720)];

describe("canonical schedule position", () => {
  test("distinguishes before, exact start, exact end, gap, and after", () => {
    expect(querySchedulePosition(day, 539).phase).toBe("before");
    expect(querySchedulePosition(day, 540).currentCommitment?.id).toBe("first");
    expect(querySchedulePosition(day, 599).currentCommitment?.id).toBe("first");
    expect(querySchedulePosition(day, 600).currentGap?.id).toContain("first-second");
    expect(querySchedulePosition(day, 660).currentCommitment?.id).toBe("second");
    expect(querySchedulePosition(day, 720).phase).toBe("after");
  });

  test("does not invent gaps before the first, after the last, or between adjacent items", () => {
    expect(querySchedulePosition(day, 500).currentGap).toBeNull();
    expect(querySchedulePosition(day, 800).currentGap).toBeNull();
    expect(
      querySchedulePosition([fixed("a", 540, 600), fixed("b", 600, 660)], 600).currentGap,
    ).toBeNull();
  });

  test("handles overlaps without negative gaps and keeps deterministic current ordering", () => {
    const overlapping = [
      fixed("long", 540, 660),
      fixed("short", 570, 600),
      fixed("next", 720, 780),
    ];
    expect(querySchedulePosition(overlapping, 580).currentCommitment?.id).toBe("long");
    expect(querySchedulePosition(overlapping, 660).currentGap).toMatchObject({
      previous: { id: "long" },
      next: { id: "next" },
      durationMinutes: 60,
    });
    expect(gapBetween(overlapping[0]!, overlapping[1]!)).toBeNull();
  });

  test("returns an empty before state for a day without commitments", () => {
    expect(querySchedulePosition([], 600)).toEqual({
      phase: "before",
      currentCommitment: null,
      previousCommitment: null,
      nextCommitment: null,
      currentGap: null,
      remainingCommitments: [],
    });
  });

  test("includes fixed personal meeting-shaped commitments without special cases", () => {
    const personal = { ...fixed("personal", 610, 630), sectionCode: "PERSONAL" };
    expect(querySchedulePosition([...day, personal], 620).currentCommitment?.id).toBe("personal");
    expect(querySchedulePosition([...day, personal], 605).nextCommitment?.id).toBe("personal");
  });
});
