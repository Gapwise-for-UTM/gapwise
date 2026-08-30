import { describe, expect, test } from "bun:test";
import { millisecondsUntilNextMinute } from "@/features/today/use-today-state";

describe("Today clock scheduling", () => {
  test("aligns refreshes to the next minute boundary", () => {
    expect(millisecondsUntilNextMinute(0)).toBe(60_000);
    expect(millisecondsUntilNextMinute(1)).toBe(59_999);
    expect(millisecondsUntilNextMinute(59_999)).toBe(1);
    expect(millisecondsUntilNextMinute(60_000)).toBe(60_000);
    expect(millisecondsUntilNextMinute(90_250)).toBe(29_750);
  });
});
