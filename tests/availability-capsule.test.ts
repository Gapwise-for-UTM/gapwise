import { describe, expect, test } from "bun:test";
import {
  AVAILABILITY_BUFFER_MINUTES,
  AVAILABILITY_PER_TERM_CAP,
  AVAILABILITY_PER_WEEKDAY_CAP,
  AVAILABILITY_RESPONSE_CAP,
  deriveAvailabilityCapsule,
  intersectAvailabilityCapsules,
  validateAvailabilityCapsule,
  type BusyEvent,
} from "@/features/security/availability-capsule";

function busy(overrides: Partial<BusyEvent> = {}): BusyEvent {
  return {
    term: "Fall",
    weekday: "Monday",
    startMinute: 9 * 60,
    endMinute: 10 * 60,
    ...overrides,
  };
}

describe("lossy friend availability capsule", () => {
  test("publishes only buffered, inward-rounded internal gaps", () => {
    const capsule = deriveAvailabilityCapsule([
      busy(),
      busy({ startMinute: 12 * 60, endMinute: 13 * 60 }),
    ]);
    expect(capsule.terms.Fall).toEqual([
      { weekday: "Monday", startMinute: 10 * 60 + 30, endMinute: 11 * 60 + 30 },
    ]);
    expect(capsule.terms.Fall[0]!.startMinute).toBeGreaterThanOrEqual(
      10 * 60 + AVAILABILITY_BUFFER_MINUTES,
    );
    expect(capsule.terms.Fall[0]!.endMinute).toBeLessThanOrEqual(
      12 * 60 - AVAILABILITY_BUFFER_MINUTES,
    );
  });

  test("never exposes before-first-event or after-last-event availability", () => {
    const capsule = deriveAvailabilityCapsule([busy()]);
    expect(capsule.terms.Fall).toEqual([]);
  });

  test("drops gaps shorter than 60 minutes after buffer and rounding", () => {
    const capsule = deriveAvailabilityCapsule([
      busy(),
      busy({ startMinute: 11 * 60 + 15, endMinute: 12 * 60 }),
    ]);
    expect(capsule.terms.Fall).toEqual([]);
  });

  test("merges overlapping busy events before deriving candidates", () => {
    const capsule = deriveAvailabilityCapsule([
      busy(),
      busy({ startMinute: 9 * 60 + 30, endMinute: 10 * 60 + 30 }),
      busy({ startMinute: 13 * 60, endMinute: 14 * 60 }),
    ]);
    expect(capsule.terms.Fall).toEqual([
      { weekday: "Monday", startMinute: 11 * 60, endMinute: 12 * 60 + 30 },
    ]);
  });

  test("enforces per-weekday and per-term candidate caps deterministically", () => {
    const events: BusyEvent[] = [];
    for (const weekday of ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const) {
      events.push(
        busy({ weekday, startMinute: 9 * 60, endMinute: 9 * 60 + 30 }),
        busy({ weekday, startMinute: 11 * 60, endMinute: 11 * 60 + 30 }),
        busy({ weekday, startMinute: 14 * 60, endMinute: 14 * 60 + 30 }),
        busy({ weekday, startMinute: 17 * 60, endMinute: 17 * 60 + 30 }),
      );
    }
    const first = deriveAvailabilityCapsule(events);
    const second = deriveAvailabilityCapsule([...events].reverse());
    expect(first).toEqual(second);
    expect(first.terms.Fall).toHaveLength(AVAILABILITY_PER_TERM_CAP);
    for (const weekday of ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const) {
      expect(
        first.terms.Fall.filter((window) => window.weekday === weekday).length,
      ).toBeLessThanOrEqual(AVAILABILITY_PER_WEEKDAY_CAP);
    }
  });

  test("returns at most three canonical intersections with only allowed fields", () => {
    const own = deriveAvailabilityCapsule([
      busy(),
      busy({ startMinute: 12 * 60, endMinute: 13 * 60 }),
      busy({ weekday: "Tuesday" }),
      busy({ weekday: "Tuesday", startMinute: 12 * 60, endMinute: 13 * 60 }),
      busy({ weekday: "Wednesday" }),
      busy({ weekday: "Wednesday", startMinute: 12 * 60, endMinute: 13 * 60 }),
      busy({ weekday: "Thursday" }),
      busy({ weekday: "Thursday", startMinute: 12 * 60, endMinute: 13 * 60 }),
    ]);
    const suggestions = intersectAvailabilityCapsules(own, own, "Fall");
    expect(suggestions).toHaveLength(AVAILABILITY_RESPONSE_CAP);
    for (const suggestion of suggestions) {
      expect(Object.keys(suggestion).sort()).toEqual(["endMinute", "startMinute", "weekday"]);
      expect(JSON.stringify(suggestion)).not.toMatch(
        /course|section|activity|room|building|user|busy/iu,
      );
    }
    expect(intersectAvailabilityCapsules(own, own, "Fall")).toEqual(suggestions);
  });

  test("rejects malformed, oversized, unrounded, and over-cap capsules", () => {
    expect(() => validateAvailabilityCapsule({ schemaVersion: 99, terms: {} })).toThrow();
    expect(() =>
      validateAvailabilityCapsule({
        schemaVersion: 1,
        terms: {
          Fall: [{ weekday: "Monday", startMinute: 541, endMinute: 660 }],
          Winter: [],
          Summer: [],
        },
      }),
    ).toThrow();
    expect(() =>
      validateAvailabilityCapsule({
        schemaVersion: 1,
        terms: {
          Fall: Array.from({ length: AVAILABILITY_PER_TERM_CAP + 1 }, (_, index) => ({
            weekday: "Monday",
            startMinute: 540 + index * 30,
            endMinute: 600 + index * 30,
          })),
          Winter: [],
          Summer: [],
        },
      }),
    ).toThrow();
  });
});
