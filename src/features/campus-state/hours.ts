import type { CampusFactStatus, HoursInterval, Provenance, WeeklyHours } from "./types";

export type OpenNowResult = {
  state: "open" | "closed" | "unknown";
  freshness: CampusFactStatus;
  nextTransition: Date | null;
};

const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Toronto",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const DAYS: Record<string, 1 | 2 | 3 | 4 | 5 | 6 | 7> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

function minuteValue(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour <= 24 && minute < 60 && (hour !== 24 || minute === 0) ? hour * 60 + minute : null;
}

function localParts(date: Date) {
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map(({ type, value }) => [type, value]),
  );
  return {
    day: DAYS[parts["weekday"]!]!,
    minute: Number(parts["hour"]) * 60 + Number(parts["minute"]),
  };
}

function validInterval(interval: HoursInterval) {
  const opens = minuteValue(interval.opens);
  const closes = minuteValue(interval.closes);
  return opens !== null && closes !== null && opens !== closes ? { opens, closes } : null;
}

/** Evaluate published weekly hours in campus local time, including overnight intervals and DST. */
export function evaluateOpenNow(
  hours: WeeklyHours | undefined,
  provenance: Provenance,
  now = new Date(),
): OpenNowResult {
  if (!hours || provenance.status === "unknown" || provenance.status === "unavailable") {
    return { state: "unknown", freshness: provenance.status, nextTransition: null };
  }
  const local = localParts(now);
  const previousDay = (local.day === 1 ? 7 : local.day - 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
  const current = (hours.intervals[local.day] ?? []).map(validInterval).filter(Boolean);
  const previous = (hours.intervals[previousDay] ?? []).map(validInterval).filter(Boolean);
  const open =
    current.some((interval) =>
      interval!.closes > interval!.opens
        ? local.minute >= interval!.opens && local.minute < interval!.closes
        : local.minute >= interval!.opens,
    ) ||
    previous.some(
      (interval) => interval!.closes < interval!.opens && local.minute < interval!.closes,
    );

  // Searching minute-by-minute is intentionally bounded (one week) and correctly crosses DST.
  let nextTransition: Date | null = null;
  for (let offset = 1; offset <= 7 * 24 * 60; offset += 1) {
    const candidate = new Date(now.getTime() + offset * 60_000);
    const candidateLocal = localParts(candidate);
    const candidatePrevious = (candidateLocal.day === 1 ? 7 : candidateLocal.day - 1) as
      1 | 2 | 3 | 4 | 5 | 6 | 7;
    const isOpen =
      (hours.intervals[candidateLocal.day] ?? [])
        .map(validInterval)
        .filter(Boolean)
        .some((i) =>
          i!.closes > i!.opens
            ? candidateLocal.minute >= i!.opens && candidateLocal.minute < i!.closes
            : candidateLocal.minute >= i!.opens,
        ) ||
      (hours.intervals[candidatePrevious] ?? [])
        .map(validInterval)
        .filter(Boolean)
        .some((i) => i!.closes < i!.opens && candidateLocal.minute < i!.closes);
    if (isOpen !== open) {
      nextTransition = candidate;
      break;
    }
  }
  return { state: open ? "open" : "closed", freshness: provenance.status, nextTransition };
}
