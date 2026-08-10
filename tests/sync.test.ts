import { describe, expect, test } from "bun:test";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getCurrentUser } from "@/features/auth/auth-service";
import { deserializeSchedule, serializeSchedule } from "@/features/sync/schedule-serialization";
import { DEFAULT_USER_PREFERENCES, sanitizeUserPreferences } from "@/features/sync/preferences";
import { meeting } from "./fixtures";

describe("guest-safe cloud services", () => {
  test("Supabase-disabled mode remains a guest session", async () => {
    expect(isSupabaseConfigured).toBe(false);
    expect(await getCurrentUser()).toBeNull();
  });

  test("serializes and deserializes only normalized schedule fields", () => {
    const original = [
      meeting({
        dateRange: { startDate: "2026-09-07", endDate: "2026-12-07" },
        excludedDates: ["2026-10-12"],
        recurrenceIntervalWeeks: 1,
        locationType: "physical",
      }),
    ];
    const serialized = serializeSchedule(original);
    expect(serialized).toEqual(original);
    expect(deserializeSchedule(JSON.parse(JSON.stringify(serialized)))).toEqual(original);
  });

  test("rejects invalid cloud schedule records", () => {
    expect(() => deserializeSchedule([{ rawIcs: "BEGIN:VCALENDAR" }])).toThrow();
    expect(() =>
      deserializeSchedule([
        meeting({ dateRange: { startDate: "2026-09-07", endDate: "2026-02-01" } }),
      ]),
    ).toThrow();
  });

  test("continues to load schedules saved before recurrence metadata was added", () => {
    expect(deserializeSchedule([meeting()])).toEqual([meeting()]);
  });

  test("uses safe user preference defaults", () => {
    expect(sanitizeUserPreferences(undefined)).toEqual(DEFAULT_USER_PREFERENCES);
    expect(sanitizeUserPreferences({ walkingSpeedMps: 99 }).walkingSpeedMps).toBe(1.35);
  });

  test("accepts only a listed residence and otherwise preserves commuter defaults", () => {
    expect(
      sanitizeUserPreferences({ dayOrigin: "residence", residenceBuildingCode: "OPH" }),
    ).toMatchObject({ dayOrigin: "residence", residenceBuildingCode: "OPH" });
    expect(
      sanitizeUserPreferences({ dayOrigin: "residence", residenceBuildingCode: "NOT-A-HOME" }),
    ).toMatchObject({ dayOrigin: "commute", residenceBuildingCode: null });
    expect(
      sanitizeUserPreferences({ dayOrigin: "commute", residenceBuildingCode: "OPH" }),
    ).toMatchObject({ dayOrigin: "commute", residenceBuildingCode: null });
  });
});
