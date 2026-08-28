import { afterEach, test, expect } from "bun:test";
import { Window } from "happy-dom";
import { StrictMode, act } from "react";
import { createRoot } from "react-dom/client";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";

type GlobalWithDom = typeof globalThis & {
  window?: Window;
  document?: Window["document"];
  navigator?: Window["navigator"];
  requestAnimationFrame?: typeof window.requestAnimationFrame;
  cancelAnimationFrame?: typeof window.cancelAnimationFrame;
};

const browserWindow = new Window({ url: "https://gapwise.test/" });
const globalDom = globalThis as GlobalWithDom & { IS_REACT_ACT_ENVIRONMENT?: boolean };
globalDom.IS_REACT_ACT_ENVIRONMENT = true;

Object.assign(globalDom, {
  window: browserWindow,
  document: browserWindow.document,
  navigator: browserWindow.navigator,
  requestAnimationFrame: browserWindow.requestAnimationFrame.bind(browserWindow),
  cancelAnimationFrame: browserWindow.cancelAnimationFrame.bind(browserWindow),
});

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

afterEach(() => {
  if (root) root.unmount();
  if (container) {
    container.remove();
    container = null;
  }
});

function ThrowingComponent() {
  throw new Error("test boundary");
}

test("AppErrorBoundary renders a friendly fallback when a child throws", () => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  const originalConsoleError = console.error;
  console.error = () => {
    // Suppress React error boundary logging during this expected failure.
  };

  act(() => {
    root!.render(
      <StrictMode>
        <AppErrorBoundary>
          <ThrowingComponent />
        </AppErrorBoundary>
      </StrictMode>,
    );
  });

  console.error = originalConsoleError;

  expect(container.textContent).toContain("Sorry, something went wrong.");
  expect(container.textContent).toContain("Timetable data saved in this browser is safe");
  expect(container.textContent).toContain("Reload");
});
