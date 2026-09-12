import { describe, expect, test } from "bun:test";
import { getLocationPresentation } from "@/features/routing/location-presentation";
import { resolveMeetingLocation } from "@/features/routing/location-resolver";
import { parseIcs } from "@/lib/ics-parser";
import { createTimetableExportPlan, renderTimetableExportSvg } from "@/lib/timetable-export";
import { renderTimetablePrintSvg } from "@/lib/timetable-print-export";
import { campusForCourseCode, locationLabel } from "@/lib/timetable-types";

function event({
  uid,
  code,
  location,
  start,
  end,
}: {
  uid: string;
  code: string;
  location: string;
  start: string;
  end: string;
}) {
  return [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${code} LEC0101`,
    `DESCRIPTION:${code} course`,
    `LOCATION:${location}`,
    "END:VEVENT",
  ].join("\r\n");
}

function calendar(events: string[]) {
  return ["BEGIN:VCALENDAR", "VERSION:2.0", ...events, "END:VCALENDAR"].join("\r\n");
}

const crossCampusCalendar = () =>
  calendar([
    event({
      uid: "utsg",
      code: "CSC108H1",
      location: "BA 1170",
      start: "20260907T090000",
      end: "20260907T110000",
    }),
    event({
      uid: "utsc",
      code: "CSCA08H3",
      location: "SW 319",
      start: "20260908T120000",
      end: "20260908T140000",
    }),
    event({
      uid: "utm",
      code: "CSC110Y5",
      location: "MN 1270",
      start: "20260909T150000",
      end: "20260909T170000",
    }),
  ]);

describe("all-campus timetable compatibility", () => {
  test("infers St. George, Scarborough, and Mississauga per course", () => {
    expect(campusForCourseCode("CSC108H1")).toBe("UTSG");
    expect(campusForCourseCode("CSCA08H3")).toBe("UTSC");
    expect(campusForCourseCode("CSC110Y5")).toBe("UTM");
    expect(campusForCourseCode("PERSONAL")).toBe("UNKNOWN");
  });

  test("imports a mixed-campus ACORN calendar without treating non-UTM rooms as TBA", () => {
    const parsed = parseIcs(crossCampusCalendar());
    const utsg = parsed.meetings.find((meeting) => meeting.courseCode === "CSC108H1")!;
    const utsc = parsed.meetings.find((meeting) => meeting.courseCode === "CSCA08H3")!;
    const utm = parsed.meetings.find((meeting) => meeting.courseCode === "CSC110Y5")!;

    expect(utsg).toMatchObject({
      campus: "UTSG",
      sourceLocation: "BA 1170",
      locationType: "physical",
      locationUnknown: false,
      buildingCode: null,
      room: null,
    });
    expect(utsc).toMatchObject({
      campus: "UTSC",
      sourceLocation: "SW 319",
      locationType: "physical",
      locationUnknown: false,
      buildingCode: null,
      room: null,
    });
    expect(utm).toMatchObject({
      campus: "UTM",
      sourceLocation: "MN 1270",
      locationType: "physical",
      locationUnknown: false,
      buildingCode: "MN",
      room: "1270",
    });

    expect(locationLabel(utsg)).toBe("BA 1170");
    expect(locationLabel(utsc)).toBe("SW 319");
    expect(locationLabel(utm)).toBe("MN 1270");
    expect(parsed.warnings.join(" ")).not.toContain("not in the recognized UTM building registry");
  });

  test("shows source-backed rooms in timetable surfaces without pretending they are on the UTM map", () => {
    const parsed = parseIcs(crossCampusCalendar());
    const utsg = parsed.meetings.find((meeting) => meeting.courseCode === "CSC108H1")!;
    const utsc = parsed.meetings.find((meeting) => meeting.courseCode === "CSCA08H3")!;
    const utm = parsed.meetings.find((meeting) => meeting.courseCode === "CSC110Y5")!;

    expect(getLocationPresentation({ meeting: utsg })).toMatchObject({
      status: "known",
      label: "BA 1170",
      detail: "Class location.",
    });
    expect(getLocationPresentation({ meeting: utsc })).toMatchObject({
      status: "known",
      label: "SW 319",
      detail: "Class location.",
    });

    expect(resolveMeetingLocation(utsg).status).toBe("unknown");
    expect(resolveMeetingLocation(utsc).status).toBe("unknown");
    expect(resolveMeetingLocation(utm).status).toBe("known");
  });

  test("keeps all three campuses in normal and print timetable exports", () => {
    const meetings = parseIcs(crossCampusCalendar()).meetings;
    const plan = createTimetableExportPlan(meetings, "Fall");
    const exportSvg = renderTimetableExportSvg(meetings, plan);
    const printSvg = renderTimetablePrintSvg(meetings, plan);

    for (const location of ["BA 1170", "SW 319", "MN 1270"]) {
      expect(exportSvg).toContain(`>${location}</text>`);
      expect(printSvg).toContain(`>${location}</text>`);
    }
  });
});
