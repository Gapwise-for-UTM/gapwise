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
  return renderToStaticMarkup(
    <UploadPanel {...baseProps} loading={loading} variant="hero" />,
  );
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

    expect(html).toContain("Reading your ACORN schedule…");
    expect(html).toContain("The original .ics file is parsed locally and never uploaded.");
    expect(html).not.toMatch(/\d+%/);
    expect(html).not.toContain('role="progressbar"');
  });
});
