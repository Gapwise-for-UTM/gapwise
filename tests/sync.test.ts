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
    const original = [meeting()];
    const serialized = serializeSchedule(original);
    expect(serialized).toEqual(original);
    expect(deserializeSchedule(JSON.parse(JSON.stringify(serialized)))).toEqual(original);
  });

  test("rejects invalid cloud schedule records", () => {
    expect(() => deserializeSchedule([{ rawIcs: "BEGIN:VCALENDAR" }])).toThrow();
  });

  test("uses safe user preference defaults", () => {
    expect(sanitizeUserPreferences(undefined)).toEqual(DEFAULT_USER_PREFERENCES);
    expect(sanitizeUserPreferences({ walkingSpeedMps: 99 }).walkingSpeedMps).toBe(1.35);
  });
});
