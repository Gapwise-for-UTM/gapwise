import { afterEach, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { AppUpdatePrompt } from "@/components/AppUpdatePrompt";
import { announceAppUpdate } from "@/features/pwa/update-events";

const browserWindow = new Window({ url: "https://gapwise.test/" });
Object.assign(globalThis, {
  window: browserWindow,
  document: browserWindow.document,
  navigator: browserWindow.navigator,
  Event: browserWindow.Event,
  CustomEvent: browserWindow.CustomEvent,
  IS_REACT_ACT_ENVIRONMENT: true,
});

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

test("stale clients offer one safe update action", async () => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root!.render(<AppUpdatePrompt />));

  let updates = 0;
  act(() => announceAppUpdate(async () => void (updates += 1)));

  expect(container.textContent).toContain("A newer version of Gapwise is ready.");
  expect(container.textContent).toContain("Your timetable data is safe in this browser.");
  const button = container.querySelector("button");
  expect(button?.textContent).toContain("Update Gapwise");

  await act(async () => button?.click());
  expect(updates).toBe(1);
});
