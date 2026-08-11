import { TERMS, WEEKDAYS, type Term, type Weekday } from "../../lib/timetable-types.js";
import { AVAILABILITY_SCHEMA_VERSION } from "./crypto-context.js";

export const AVAILABILITY_DAY_START = 9 * 60;
export const AVAILABILITY_DAY_END = 18 * 60;
export const AVAILABILITY_BUFFER_MINUTES = 15;
export const AVAILABILITY_ROUNDING_MINUTES = 30;
export const AVAILABILITY_MINIMUM_MINUTES = 60;
export const AVAILABILITY_PER_WEEKDAY_CAP = 2;
export const AVAILABILITY_PER_TERM_CAP = 8;
export const AVAILABILITY_RESPONSE_CAP = 3;
export const MAX_CAPSULE_PLAINTEXT_BYTES = 8 * 1024;

export type BusyEvent = {
  term: Term;
  weekday: Weekday;
  startMinute: number;
  endMinute: number;
};

export type AvailabilityWindow = {
  weekday: Weekday;
  startMinute: number;
  endMinute: number;
};

export type AvailabilityCapsuleV1 = {
  schemaVersion: typeof AVAILABILITY_SCHEMA_VERSION;
  terms: Record<Term, AvailabilityWindow[]>;
};

const ceilTo = (value: number, unit: number) => Math.ceil(value / unit) * unit;
const floorTo = (value: number, unit: number) => Math.floor(value / unit) * unit;

function weekdayIndex(weekday: Weekday): number {
  return WEEKDAYS.indexOf(weekday);
}

function rankWindows(left: AvailabilityWindow, right: AvailabilityWindow): number {
  const leftDuration = left.endMinute - left.startMinute;
  const rightDuration = right.endMinute - right.startMinute;
  return (
    rightDuration - leftDuration ||
    weekdayIndex(left.weekday) - weekdayIndex(right.weekday) ||
    left.startMinute - right.startMinute ||
    left.endMinute - right.endMinute
  );
}

function canonicalWindows(left: AvailabilityWindow, right: AvailabilityWindow): number {
  return (
    weekdayIndex(left.weekday) - weekdayIndex(right.weekday) ||
    left.startMinute - right.startMinute ||
    left.endMinute - right.endMinute
  );
}

function windowsForDay(events: BusyEvent[], weekday: Weekday): AvailabilityWindow[] {
  const sorted = events
    .filter((event) => event.weekday === weekday)
    .map((event) => ({ start: event.startMinute, end: event.endMinute }))
    .filter(
      (event) =>
        Number.isInteger(event.start) &&
        Number.isInteger(event.end) &&
        event.start >= 0 &&
        event.end <= 24 * 60 &&
        event.end > event.start,
    )
    .sort((left, right) => left.start - right.start || left.end - right.end);

  const merged: { start: number; end: number }[] = [];
  for (const event of sorted) {
    const previous = merged.at(-1);
    if (!previous || event.start > previous.end) merged.push({ ...event });
    else previous.end = Math.max(previous.end, event.end);
  }

  const candidates: AvailabilityWindow[] = [];
  for (let index = 1; index < merged.length; index += 1) {
    const previous = merged[index - 1]!;
    const next = merged[index]!;
    const startMinute = ceilTo(
      Math.max(previous.end + AVAILABILITY_BUFFER_MINUTES, AVAILABILITY_DAY_START),
      AVAILABILITY_ROUNDING_MINUTES,
    );
    const endMinute = floorTo(
      Math.min(next.start - AVAILABILITY_BUFFER_MINUTES, AVAILABILITY_DAY_END),
      AVAILABILITY_ROUNDING_MINUTES,
    );
    if (endMinute - startMinute < AVAILABILITY_MINIMUM_MINUTES) continue;
    candidates.push({ weekday, startMinute, endMinute });
  }

  return candidates.sort(rankWindows).slice(0, AVAILABILITY_PER_WEEKDAY_CAP);
}

export function deriveAvailabilityCapsule(events: BusyEvent[]): AvailabilityCapsuleV1 {
  const terms = Object.fromEntries(
    TERMS.map((term) => {
      const termEvents = events.filter((event) => event.term === term);
      const windows = WEEKDAYS.flatMap((weekday) => windowsForDay(termEvents, weekday))
        .sort(rankWindows)
        .slice(0, AVAILABILITY_PER_TERM_CAP)
        .sort(canonicalWindows);
      return [term, windows];
    }),
  ) as Record<Term, AvailabilityWindow[]>;
  return { schemaVersion: AVAILABILITY_SCHEMA_VERSION, terms };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateWindow(value: unknown): AvailabilityWindow {
  if (
    !isPlainRecord(value) ||
    Object.keys(value).some((key) => !["weekday", "startMinute", "endMinute"].includes(key))
  ) {
    throw new Error("Availability capsule contains an invalid window.");
  }
  const weekday = value["weekday"];
  const startMinute = value["startMinute"];
  const endMinute = value["endMinute"];
  if (
    !WEEKDAYS.includes(weekday as Weekday) ||
    !Number.isInteger(startMinute) ||
    !Number.isInteger(endMinute) ||
    (startMinute as number) < AVAILABILITY_DAY_START ||
    (endMinute as number) > AVAILABILITY_DAY_END ||
    (startMinute as number) % AVAILABILITY_ROUNDING_MINUTES !== 0 ||
    (endMinute as number) % AVAILABILITY_ROUNDING_MINUTES !== 0 ||
    (endMinute as number) - (startMinute as number) < AVAILABILITY_MINIMUM_MINUTES
  ) {
    throw new Error("Availability capsule contains an invalid window.");
  }
  return {
    weekday: weekday as Weekday,
    startMinute: startMinute as number,
    endMinute: endMinute as number,
  };
}

export function validateAvailabilityCapsule(value: unknown): AvailabilityCapsuleV1 {
  if (
    !isPlainRecord(value) ||
    Object.keys(value).some((key) => !["schemaVersion", "terms"].includes(key))
  ) {
    throw new Error("Availability capsule is malformed.");
  }
  if (value["schemaVersion"] !== AVAILABILITY_SCHEMA_VERSION || !isPlainRecord(value["terms"])) {
    throw new Error("Unsupported availability capsule version.");
  }
  const rawTerms = value["terms"];
  if (Object.keys(rawTerms).some((term) => !TERMS.includes(term as Term))) {
    throw new Error("Availability capsule contains an invalid term.");
  }
  const terms = {} as Record<Term, AvailabilityWindow[]>;
  for (const term of TERMS) {
    const rawWindows = rawTerms[term];
    if (!Array.isArray(rawWindows) || rawWindows.length > AVAILABILITY_PER_TERM_CAP) {
      throw new Error("Availability capsule exceeds its candidate cap.");
    }
    const windows = rawWindows.map(validateWindow);
    for (const weekday of WEEKDAYS) {
      if (
        windows.filter((window) => window.weekday === weekday).length > AVAILABILITY_PER_WEEKDAY_CAP
      ) {
        throw new Error("Availability capsule exceeds its weekday cap.");
      }
    }
    const unique = new Set(
      windows.map((window) => `${window.weekday}:${window.startMinute}:${window.endMinute}`),
    );
    if (unique.size !== windows.length)
      throw new Error("Availability capsule contains duplicates.");
    terms[term] = windows.sort(canonicalWindows);
  }
  return { schemaVersion: AVAILABILITY_SCHEMA_VERSION, terms };
}

export function intersectAvailabilityCapsules(
  left: AvailabilityCapsuleV1,
  right: AvailabilityCapsuleV1,
  term: Term,
): AvailabilityWindow[] {
  if (!TERMS.includes(term)) throw new Error("Unsupported term.");
  const intersections: AvailabilityWindow[] = [];
  for (const own of left.terms[term]) {
    for (const friend of right.terms[term]) {
      if (own.weekday !== friend.weekday) continue;
      const startMinute = Math.max(own.startMinute, friend.startMinute);
      const endMinute = Math.min(own.endMinute, friend.endMinute);
      if (endMinute - startMinute < AVAILABILITY_MINIMUM_MINUTES) continue;
      intersections.push({ weekday: own.weekday, startMinute, endMinute });
    }
  }
  const deduplicated = [
    ...new Map(
      intersections.map((window) => [
        `${window.weekday}:${window.startMinute}:${window.endMinute}`,
        window,
      ]),
    ).values(),
  ];
  return deduplicated.sort(rankWindows).slice(0, AVAILABILITY_RESPONSE_CAP);
}
