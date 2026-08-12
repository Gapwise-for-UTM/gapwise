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
  removeItem: () => {
    stored = null;
  },
};

describe("legacy plaintext route preference persistence", () => {
  beforeEach(() => {
    stored = null;
  });

  test("is ignored and cleared in encrypted-only production", () => {
    stored = JSON.stringify({
      ...DEFAULT_USER_PREFERENCES,
      dayOrigin: "residence",
      residenceBuildingCode: "RIH",
      walkingSpeedMps: 1.5,
    });

    expect(loadLocalUserPreferences(storage)).toEqual(DEFAULT_USER_PREFERENCES);
    expect(stored).toBeNull();
  });

  test("does not create new plaintext preference records", () => {
    saveLocalUserPreferences(
      {
        ...DEFAULT_USER_PREFERENCES,
        dayOrigin: "residence",
        residenceBuildingCode: "RIH",
        walkingSpeedMps: 1.5,
      },
      storage,
    );
    expect(stored).toBeNull();
  });
});
