import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

describe("timetable export loading", () => {
  test("loads heavy renderers only after an export action", async () => {
    const source = await readFile("src/components/TimetableExportDialog.tsx", "utf8");

    expect(source).toContain('await import("@/lib/timetable-export")');
    expect(source).toContain('await import("@/lib/timetable-print-export")');
    expect(source).not.toContain('} from "@/lib/timetable-export";');
    expect(source).not.toContain('} from "@/lib/timetable-print-export";');
  });
});
