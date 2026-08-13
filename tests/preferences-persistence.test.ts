import { beforeEach, describe, expect, test } from "bun:test";
import {
  DEFAULT_USER_PREFERENCES,
  loadLocalUserPreferences,
  saveLocalUserPreferences,
} from "@/features/sync/preferences";
import { DEFAULT_GAP_PREFERENCES, loadGapPreferences } from "@/features/gaps/preferences";
import { loadPersonalItems } from "@/features/personal/persistence";

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

  test("ignores and clears legacy plaintext personal items", () => {
    stored = JSON.stringify([
      {
        id: "legacy-private-item",
        title: "Private appointment",
        notes: "must not cross browser users",
      },
    ]);

    expect(loadPersonalItems(storage)).toEqual([]);
    expect(stored).toBeNull();
  });

  test("ignores and clears legacy plaintext gap preferences", () => {
    stored = JSON.stringify({ willingToLeaveCampus: true, oneWayHomeCommuteMinutes: 90 });

    expect(loadGapPreferences(storage)).toEqual(DEFAULT_GAP_PREFERENCES);
    expect(stored).toBeNull();
  });
});
