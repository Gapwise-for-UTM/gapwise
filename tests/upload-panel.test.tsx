import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { UploadPanel } from "@/components/UploadPanel";

const baseProps = {
  onFile: () => undefined,
  onDemo: () => undefined,
  error: null,
  remember: false,
  onRememberChange: () => undefined,
};

function renderPanel(loading: boolean) {
  return renderToStaticMarkup(<UploadPanel {...baseProps} loading={loading} variant="hero" />);
}

function textContent(html: string) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

describe("AND-66 first-run upload surface", () => {
  test("puts the local-first import action ahead of demo and account decisions", () => {
    const html = renderPanel(false);

    expect(html).toContain("See gaps. Navigate UTM. Privately.");
    expect(html).toContain("Import ACORN");
    expect(html).toContain("Your calendar stays on this device. No account required.");
    expect(html).toContain("Choose the .ics file you downloaded from ACORN.");
    expect(html).toContain("Try Demo Schedule");
    expect(html).toContain('accept=".ics,text/calendar"');
  });

  test("uses a schedule-shaped local parsing state without fake progress", () => {
    const html = renderPanel(true);
    const visibleText = textContent(html);

    expect(visibleText).toContain("Reading your ACORN schedule…");
    expect(visibleText).toContain("The original .ics file is parsed locally and never uploaded.");
    expect(visibleText).not.toMatch(/\b\d+%\b/);
    expect(html).not.toContain('role="progressbar"');
  });

  test("explains import failure, state safety, and the best recovery action", () => {
    const html = renderToStaticMarkup(
      <UploadPanel
        {...baseProps}
        loading={false}
        error="That file type isn't supported. Please choose a .ics calendar file."
        variant="hero"
      />,
    );
    const visibleText = textContent(html);

    expect(visibleText).toContain("The calendar could not be imported.");
    expect(visibleText).toContain("Any timetable already in this browser is safe.");
    expect(visibleText).toContain("Choose another ACORN .ics file to try again.");
  });
});
