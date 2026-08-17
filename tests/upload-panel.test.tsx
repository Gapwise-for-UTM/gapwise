/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { UploadPanel } from "@/components/UploadPanel";

afterEach(() => cleanup());

const baseProps = {
  onFile: vi.fn(),
  onDemo: vi.fn(),
  error: null,
  remember: false,
  onRememberChange: vi.fn(),
};

describe("AND-66 first-run upload surface", () => {
  test("puts the local-first import action ahead of demo and account decisions", () => {
    render(<UploadPanel {...baseProps} loading={false} variant="hero" />);
    expect(screen.getByText("See gaps. Navigate UTM. Privately.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Import ACORN" })).toBeTruthy();
    expect(
      screen.getByText("Your calendar stays on this device. No account required."),
    ).toBeTruthy();
    expect(screen.getByText("Choose the .ics file you downloaded from ACORN.")).toBeTruthy();
    expect(screen.getByText("Try Demo Schedule")).toBeTruthy();
    const input = document.querySelector<HTMLInputElement>("#ics-file");
    expect(input?.accept).toContain(".ics");
  });

  test("uses a schedule-shaped local parsing state without fake progress", () => {
    render(<UploadPanel {...baseProps} loading variant="hero" />);
    expect(screen.getByText("Reading your ACORN schedule…")).toBeTruthy();
    expect(
      screen.getByText("The original .ics file is parsed locally and never uploaded."),
    ).toBeTruthy();
    expect(screen.queryByText(/\d+%/)).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });
});
