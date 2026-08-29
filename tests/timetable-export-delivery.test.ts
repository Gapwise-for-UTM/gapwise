import { describe, expect, test } from "bun:test";
import { canDeliverGeneratedExportImmediately } from "@/lib/timetable-export-delivery";

describe("export delivery activation", () => {
  test("returns false when transient activation is inactive", () => {
    expect(
      canDeliverGeneratedExportImmediately({ userActivation: { isActive: false } }),
    ).toBe(false);
  });

  test("returns true when transient activation is active", () => {
    expect(canDeliverGeneratedExportImmediately({ userActivation: { isActive: true } })).toBe(true);
  });

  test("falls back to immediate delivery when activation state is unavailable", () => {
    expect(canDeliverGeneratedExportImmediately({})).toBe(true);
    expect(canDeliverGeneratedExportImmediately(undefined)).toBe(true);
  });
});
