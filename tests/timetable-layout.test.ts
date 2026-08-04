import { describe, expect, test } from "bun:test";
import { isCompactMeetingCard } from "@/lib/timetable-layout";
import { meeting } from "./fixtures";

describe("timetable card layout", () => {
  test("uses compact content for one-hour and overlapping cards", () => {
    expect(isCompactMeetingCard(meeting(), 1)).toBe(true);
    expect(isCompactMeetingCard(meeting({ endTime: 660 }), 1)).toBe(false);
    expect(isCompactMeetingCard(meeting({ endTime: 660 }), 2)).toBe(true);
  });
});
