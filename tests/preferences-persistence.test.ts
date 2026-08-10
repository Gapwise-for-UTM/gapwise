import { beforeEach, describe, expect, test } from "bun:test";
import {
  DEFAULT_USER_PREFERENCES,
  loadLocalUserPreferences,
  saveLocalUserPreferences,
} from "@/features/sync/preferences";

let stored: string | null = null;
const storage = {
  getItem: () => stored,
  setItem: (_key: string, value: string) => {
    stored = value;
  },
};

describe("local route preference persistence", () => {
  beforeEach(() => {
    stored = null;
  });

  test("survives reload-style reads for guest residence settings", () => {
    saveLocalUserPreferences(
      {
        ...DEFAULT_USER_PREFERENCES,
        dayOrigin: "residence",
        residenceBuildingCode: "RIH",
        walkingSpeedMps: 1.5,
      },
      storage,
    );

    expect(loadLocalUserPreferences(storage)).toMatchObject({
      dayOrigin: "residence",
      residenceBuildingCode: "RIH",
      walkingSpeedMps: 1.5,
    });
  });

  test("falls back safely when browser storage is malformed", () => {
    stored = "not-json";
    expect(loadLocalUserPreferences(storage)).toEqual(DEFAULT_USER_PREFERENCES);
  });
});
