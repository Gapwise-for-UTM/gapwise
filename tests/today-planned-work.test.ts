import { describe, expect, test } from "bun:test";
import { buildTodayState } from "@/features/today/today-state";
import { DEFAULT_USER_PREFERENCES } from "@/features/sync/preferences";
import { DEFAULT_GAP_PREFERENCES } from "@/features/gaps/preferences";
import { meeting } from "./fixtures";

const route = () => ({
  status: "unavailable" as const,
  message: "unknown",
  accuracy: "Location unavailable",
  result: null,
  displayCoordinates: [],
  warnings: [],
  approximateDistanceMeters: null,
  approximateSeconds: null,
});

const dated = (overrides: Parameters<typeof meeting>[0]) =>
  meeting({
    term: "Fall",
    weekday: "Monday",
    dateRange: { startDate: "2026-09-07", endDate: "2026-12-07" },
    ...overrides,
  });

describe("Today planned study context", () => {
  test("reports active and next study without changing fixed commitment semantics", () => {
    const fixedBefore = dated({ id: "lecture", startTime: 9 * 60, endTime: 11 * 60 });
    const study = dated({
      id: "study",
      sectionCode: "STUDY",
      courseCode: "MAT157",
      courseName: "Problem Set 4",
      notes: "90m accepted",
      startTime: 11 * 60 + 20,
      endTime: 12 * 60 + 50,
    });
    const fixedAfter = dated({
      id: "tutorial",
      courseCode: "CSC110",
      startTime: 14 * 60,
      endTime: 15 * 60,
    });
    const state = buildTodayState({
      meetings: [fixedBefore, study, fixedAfter],
      selectedTerm: "Fall",
      preferences: DEFAULT_USER_PREFERENCES,
      gapPreferences: DEFAULT_GAP_PREFERENCES,
      planTransition: route,
      now: new Date(2026, 8, 7, 11, 45),
    });
    expect(state.kind).toBe("gap");
    expect(state.plannedWork.current?.id).toBe("study");
    if (state.kind === "gap") {
      expect(state.gap.previous.id).toBe("lecture");
      expect(state.gap.next.id).toBe("tutorial");
    }
  });

  test("does not turn study-only time before or after fixed work into a detected gap", () => {
    const fixed = dated({ id: "lecture", startTime: 12 * 60, endTime: 13 * 60 });
    const studies = [
      dated({
        id: "early",
        sectionCode: "STUDY",
        notes: "60m accepted",
        startTime: 9 * 60,
        endTime: 10 * 60,
      }),
      dated({
        id: "late",
        sectionCode: "STUDY",
        notes: "60m accepted",
        startTime: 15 * 60,
        endTime: 16 * 60,
      }),
    ];
    const input = {
      meetings: [fixed, ...studies],
      selectedTerm: "Fall" as const,
      preferences: DEFAULT_USER_PREFERENCES,
      gapPreferences: DEFAULT_GAP_PREFERENCES,
      planTransition: route,
    };
    expect(buildTodayState({ ...input, now: new Date(2026, 8, 7, 9, 30) }).kind).toBe(
      "before-first",
    );
    expect(buildTodayState({ ...input, now: new Date(2026, 8, 7, 15, 30) }).kind).toBe("done");
  });

  test("shows the next accepted block but ignores completed lifecycle history", () => {
    const fixed = dated({ id: "lecture", startTime: 12 * 60, endTime: 13 * 60 });
    const completed = dated({
      id: "done",
      sectionCode: "STUDY",
      notes: "60m completed",
      startTime: 9 * 60,
      endTime: 10 * 60,
    });
    const next = dated({
      id: "next-study",
      sectionCode: "STUDY",
      notes: "60m accepted",
      startTime: 11 * 60,
      endTime: 12 * 60,
    });
    const state = buildTodayState({
      meetings: [fixed, completed, next],
      selectedTerm: "Fall",
      preferences: DEFAULT_USER_PREFERENCES,
      gapPreferences: DEFAULT_GAP_PREFERENCES,
      planTransition: route,
      now: new Date(2026, 8, 7, 10, 30),
    });
    expect(state.plannedWork.current).toBeNull();
    expect(state.plannedWork.next?.id).toBe("next-study");
  });
});
