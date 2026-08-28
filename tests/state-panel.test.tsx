import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { LoadingPanel, StatePanel } from "@/components/ui/state-panel";
import { Skeleton } from "@/components/ui/skeleton";

describe("shared async state language", () => {
  test("announces loading politely and marks the region busy", () => {
    const html = renderToStaticMarkup(
      <LoadingPanel
        title="Loading your timetable…"
        description="Your saved timetable stays safe while Gapwise finishes."
      />,
    );

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Loading your timetable…");
    expect(html).toContain("Your saved timetable stays safe while Gapwise finishes.");
  });

  test("keeps empty-state hierarchy and actions in one reusable surface", () => {
    const html = renderToStaticMarkup(
      <StatePanel
        eyebrow="Private browser import"
        title="Add your timetable"
        description="Import your ACORN calendar to build a private weekly view on this device."
        actions={<button type="button">Import ACORN</button>}
      />,
    );

    expect(html).toContain("Private browser import");
    expect(html).toContain("<h2");
    expect(html).toContain("Add your timetable");
    expect(html).toContain("Import ACORN");
  });

  test("disables skeleton animation when reduced motion is requested", () => {
    const html = renderToStaticMarkup(<Skeleton className="h-4 w-24" />);

    expect(html).toContain("animate-pulse");
    expect(html).toContain("motion-reduce:animate-none");
  });
});
