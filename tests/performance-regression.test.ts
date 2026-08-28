import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { DEFAULT_ROUTE_PREFERENCES } from "@/config/routing";
import { UTM_ROUTING_GRAPH } from "@/data/utm/campus";
import {
  createMemoizedTransitionPlanner,
  planMeetingTransition,
} from "@/features/routing/transition";
import { deserializeSchedule } from "@/features/sync/schedule-serialization";
import { parseIcs } from "@/lib/ics-parser";
import { buildTimetableModel } from "@/lib/timetable-layout";
import type { Weekday } from "@/lib/timetable-types";
import { meeting } from "./fixtures";

const weekdays: Weekday[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

function largeSchedule(count = 120) {
  return Array.from({ length: count }, (_, index) => {
    const weekday = weekdays[index % weekdays.length]!;
    const slot = Math.floor(index / weekdays.length) % 12;
    return meeting({
      id: `meeting-${index}`,
      courseCode: `CSC${String(100 + index).padStart(3, "0")}H5`,
      weekday,
      startTime: 8 * 60 + slot * 60,
      endTime: 8 * 60 + slot * 60 + 50,
      buildingCode: index % 2 === 0 ? "MN" : "IB",
      room: index % 2 === 0 ? "1270" : "340",
    });
  });
}

function largeIcs(count = 120) {
  const events = Array.from({ length: count }, (_, index) => {
    const code = `CSC${String(100 + index).padStart(3, "0")}H5`;
    return [
      "BEGIN:VEVENT",
      `UID:${index}@gapwise.test`,
      "DTSTART:20260907T090000",
      "DTEND:20260907T095000",
      `SUMMARY:${code} LEC 0101`,
      `DESCRIPTION:Course ${index}`,
      `LOCATION:${index % 2 === 0 ? "MN 1270" : "IB 340"}`,
      "END:VEVENT",
    ].join("\r\n");
  });
  return ["BEGIN:VCALENDAR", "VERSION:2.0", ...events, events[0]!, "END:VCALENDAR"].join("\r\n");
}

describe("large timetable regressions", () => {
  test("normalizes and lays out 120 meetings within one main-thread budget", () => {
    const raw = [...largeSchedule(), largeSchedule()[0]!];
    const started = performance.now();
    const normalized = deserializeSchedule(raw);
    const model = buildTimetableModel(normalized);
    const duration = performance.now() - started;

    expect(normalized).toHaveLength(120);
    expect(deserializeSchedule(raw)).toBe(normalized);
    expect([...model.days.values()].flatMap((day) => day.sorted)).toHaveLength(120);
    expect(duration).toBeLessThan(200);
  });

  test("parses 120 events, deduplicates repeated meetings, and stays responsive", () => {
    const started = performance.now();
    const result = parseIcs(largeIcs());
    const duration = performance.now() - started;

    expect(result.meetings).toHaveLength(120);
    expect(duration).toBeLessThan(200);
  });

  test("reuses route results until inputs or preferences change", () => {
    let calculations = 0;
    const planner = createMemoizedTransitionPlanner(UTM_ROUTING_GRAPH, (...args) => {
      calculations += 1;
      return planMeetingTransition(...args);
    });
    const from = meeting();
    const to = meeting({ id: "next", buildingCode: "IB", room: "340" });

    const first = planner(from, to, DEFAULT_ROUTE_PREFERENCES);
    expect(planner(from, to, { ...DEFAULT_ROUTE_PREFERENCES })).toBe(first);
    expect(calculations).toBe(1);

    planner(from, to, { ...DEFAULT_ROUTE_PREFERENCES, mode: "step-free" });
    planner(from, { ...to, buildingCode: "DH" }, DEFAULT_ROUTE_PREFERENCES);
    expect(calculations).toBe(3);
  });

  test("keeps Day Route and MapLibre out of the initial bundle path", async () => {
    const [entry, route, map, importLifecycle, monument] = await Promise.all([
      readFile("src/main.tsx", "utf8"),
      readFile("src/routes/_app.tsx", "utf8"),
      readFile("src/components/CampusMap.tsx", "utf8"),
      readFile("src/features/timetable/import-lifecycle.ts", "utf8"),
      readFile("src/components/UtmMonumentViewer.tsx", "utf8"),
    ]);

    expect(entry).not.toContain("maplibre-gl");
    expect(route).toContain('lazy(() =>\n  import("@/components/DayRoute")');
    expect(route).toContain('hidden={view !== "route"}');
    expect(map).toContain('void import("maplibre-gl")');
    expect(map).toContain('import "maplibre-gl/dist/maplibre-gl.css"');
    expect(map).toContain("maplibre-gl-worker.mjs?worker&url");
    expect(map).toContain("setWorkerUrl(mapLibreWorkerUrl)");
    expect(importLifecycle).toContain('await import("@/lib/ics-parser")');
    expect(importLifecycle).not.toContain("import { IcsParseError");
    expect(monument).toContain('{ rootMargin: "0px" }');
    expect(monument).toContain('loading="lazy"');
  });
});
