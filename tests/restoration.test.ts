import { describe, expect, test } from "bun:test";
import { chooseRestoration } from "@/features/sync/restoration";
import { meeting } from "./fixtures";

const localMeeting = meeting({ id: "local" });
const cloudMeeting = meeting({ id: "cloud" });
const local = (updatedAt: string | null) => ({ data: [localMeeting], updatedAt });
const cloud = (updatedAt: string | null) => ({ meetings: [cloudMeeting], updatedAt });

describe("cloud restoration precedence", () => {
  test("preserves an in-memory timetable", () => {
    expect(chooseRestoration([localMeeting], null, cloud("2026-08-01")).source).toBe("memory");
  });
  test("restores the only valid local source", () => {
    expect(chooseRestoration(null, local("2026-08-01"), null).source).toBe("local");
  });
  test("restores the only valid cloud source", () => {
    expect(chooseRestoration(null, null, cloud("2026-08-01")).source).toBe("cloud");
  });
  test("chooses a newer local record", () => {
    expect(chooseRestoration(null, local("2026-08-02"), cloud("2026-08-01")).source).toBe("local");
  });
  test("chooses a newer cloud record", () => {
    expect(chooseRestoration(null, local("2026-08-01"), cloud("2026-08-02")).source).toBe("cloud");
  });
  test("keeps local and announces cloud when timestamps are incomparable", () => {
    const choice = chooseRestoration(null, local(null), cloud("not-a-date"));
    expect(choice.source).toBe("local");
    expect(choice.state).toBe("cloud-version-available");
  });
  test("reports no cloud data for empty sources", () => {
    expect(chooseRestoration(null, null, null).state).toBe("no-cloud-data");
  });
});
