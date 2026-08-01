import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { Window } from "happy-dom";
import { StrictMode, act, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { Meeting } from "@/lib/timetable-types";
import type { CloudScheduleRecord } from "@/features/sync/sync-service";
import { deserializeSchedule } from "@/features/sync/schedule-serialization";
import { meeting } from "./fixtures";

const browserWindow = new Window({ url: "https://gapwise.test/" });
const browserGlobals = globalThis as unknown as Record<string, unknown>;
Object.assign(browserGlobals, {
  window: browserWindow,
  self: browserWindow,
  document: browserWindow.document,
  navigator: browserWindow.navigator,
  location: browserWindow.location,
  history: browserWindow.history,
  localStorage: browserWindow.localStorage,
  sessionStorage: browserWindow.sessionStorage,
  Node: browserWindow.Node,
  Element: browserWindow.Element,
  HTMLElement: browserWindow.HTMLElement,
  SVGElement: browserWindow.SVGElement,
  Event: browserWindow.Event,
  CustomEvent: browserWindow.CustomEvent,
  MouseEvent: browserWindow.MouseEvent,
  File: browserWindow.File,
  Blob: browserWindow.Blob,
  MutationObserver: browserWindow.MutationObserver,
  ResizeObserver: browserWindow.ResizeObserver,
  IntersectionObserver: browserWindow.IntersectionObserver,
  DOMRect: browserWindow.DOMRect,
  getComputedStyle: browserWindow.getComputedStyle.bind(browserWindow),
  requestAnimationFrame: browserWindow.requestAnimationFrame.bind(browserWindow),
  cancelAnimationFrame: browserWindow.cancelAnimationFrame.bind(browserWindow),
  IS_REACT_ACT_ENVIRONMENT: true,
});

type AuthSnapshot = {
  user: User | null;
  loading: boolean;
  error: string | null;
};

const authenticatedUser = {
  id: "user-1",
  app_metadata: {},
  user_metadata: { name: "Gapwise Tester" },
  aud: "authenticated",
  created_at: "2026-08-01T00:00:00.000Z",
} as User;

let authSnapshot: AuthSnapshot = { user: null, loading: true, error: null };
const authSubscribers = new Set<() => void>();

function useMockAuth(): AuthSnapshot {
  const [, rerender] = useState(0);
  useEffect(() => {
    const update = () => rerender((value) => value + 1);
    authSubscribers.add(update);
    return () => authSubscribers.delete(update);
  }, []);
  return authSnapshot;
}

const loadCalls: string[] = [];
const saveCalls: Meeting[][] = [];
let loadImplementation: (userId: string) => Promise<CloudScheduleRecord | null> = async () => null;

mock.module("@/features/auth/use-auth", () => ({ useAuth: useMockAuth }));
mock.module("@/features/sync/sync-service", () => ({
  loadScheduleRecord: (userId: string) => {
    loadCalls.push(userId);
    return loadImplementation(userId);
  },
  loadSchedule: async () => (await loadImplementation(authenticatedUser.id))?.meetings ?? null,
  saveSchedule: async (meetings: Meeting[]) => {
    saveCalls.push(meetings);
  },
  deleteSchedule: async () => undefined,
  savePreferences: async () => undefined,
  loadPreferences: async () => null,
}));

const { createRoot } = await import("react-dom/client");
const { Route } = await import("@/routes/index");
const Index = Route.options.component;
if (!Index) throw new Error("The index route component is not configured.");

let root: ReturnType<typeof createRoot> | null = null;
let container: HTMLDivElement | null = null;

function pageText() {
  return container?.textContent ?? "";
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function waitFor(check: () => boolean, description: string) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (check()) return;
    await flush();
  }
  throw new Error(`Timed out waiting for ${description}. Current page: ${pageText()}`);
}

async function setAuth(snapshot: AuthSnapshot) {
  await act(async () => {
    authSnapshot = snapshot;
    for (const update of authSubscribers) update();
  });
}

async function mountRoute() {
  container = document.createElement("div") as HTMLDivElement;
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(
      <StrictMode>
        <Index />
      </StrictMode>,
    );
  });
}

async function unmountRoute() {
  if (root) {
    await act(async () => root?.unmount());
    root = null;
  }
  container?.remove();
  container = null;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function remember(meetings: Meeting[], updatedAt: string) {
  localStorage.setItem("gapwise:remember", "1");
  localStorage.setItem("gapwise:timetable", JSON.stringify({ data: meetings, updatedAt }));
}

beforeEach(() => {
  authSnapshot = { user: null, loading: true, error: null };
  loadImplementation = async () => null;
  loadCalls.length = 0;
  saveCalls.length = 0;
  localStorage.clear();
  sessionStorage.clear();
  document.body.replaceChildren();
});

afterEach(async () => {
  await unmountRoute();
});

describe("route-level timetable restoration", () => {
  test("waits for delayed auth and renders a valid cloud timetable without flashing upload", async () => {
    const cloud = meeting({ id: "cloud", courseCode: "CLOUD101H5" });
    const query = deferred<CloudScheduleRecord | null>();
    loadImplementation = async () => query.promise;

    await mountRoute();
    expect(pageText()).toContain("Checking for your timetable…");
    expect(pageText()).not.toContain("Upload your ACORN calendar");

    await setAuth({ user: authenticatedUser, loading: false, error: null });
    await waitFor(() => loadCalls.length === 1, "the cloud query to start");
    expect(pageText()).not.toContain("Upload your ACORN calendar");

    query.resolve({ meetings: [cloud], updatedAt: "2026-08-01T12:00:00.000Z" });
    await waitFor(() => pageText().includes("CLOUD101H5"), "the cloud timetable to render");

    expect(pageText()).toContain("Your timetable");
    expect(pageText()).not.toContain("Turn your ACORN timetable into a smarter campus day.");
    expect(loadCalls).toEqual([authenticatedUser.id]);
    expect(saveCalls).toHaveLength(0);
  });

  test("restores a synced cloud timetable again after a simulated reload", async () => {
    const cloud = meeting({ id: "reload-cloud", courseCode: "RELOAD101H5" });
    authSnapshot = { user: authenticatedUser, loading: false, error: null };
    loadImplementation = async () => ({
      meetings: [cloud],
      updatedAt: "2026-08-01T12:00:00.000Z",
    });

    await mountRoute();
    await waitFor(() => pageText().includes("RELOAD101H5"), "the first cloud restore");
    await unmountRoute();
    await mountRoute();
    await waitFor(() => pageText().includes("RELOAD101H5"), "the reload cloud restore");

    expect(loadCalls).toEqual([authenticatedUser.id, authenticatedUser.id]);
    expect(pageText()).not.toContain("Turn your ACORN timetable into a smarter campus day.");
    expect(saveCalls).toHaveLength(0);
  });

  test("shows a visible error when the cloud query fails", async () => {
    authSnapshot = { user: authenticatedUser, loading: false, error: null };
    loadImplementation = async () => {
      throw new Error("network unavailable");
    };

    await mountRoute();
    await waitFor(
      () => pageText().includes("We couldn't restore your cloud timetable."),
      "the restore error",
    );

    expect(pageText()).toContain("Upload your ACORN calendar");
  });

  test("shows a visible error when auth session initialization fails", async () => {
    authSnapshot = {
      user: null,
      loading: false,
      error: "We couldn't restore your signed-in session.",
    };

    await mountRoute();
    await waitFor(
      () => pageText().includes("We couldn't restore your signed-in session."),
      "the auth initialization error",
    );

    expect(loadCalls).toHaveLength(0);
    expect(pageText()).toContain("Upload your ACORN calendar");
  });

  test("shows a visible error when the cloud record is malformed", async () => {
    authSnapshot = { user: authenticatedUser, loading: false, error: null };
    loadImplementation = async () => ({
      meetings: deserializeSchedule([{ rawIcs: "BEGIN:VCALENDAR" }]),
      updatedAt: "2026-08-01T12:00:00.000Z",
    });

    await mountRoute();
    await waitFor(
      () => pageText().includes("We couldn't restore your cloud timetable."),
      "the malformed-record error",
    );

    expect(pageText()).toContain("Upload your ACORN calendar");
  });

  test("shows upload only after an authenticated cloud query returns no record", async () => {
    const query = deferred<CloudScheduleRecord | null>();
    authSnapshot = { user: authenticatedUser, loading: false, error: null };
    loadImplementation = async () => query.promise;

    await mountRoute();
    expect(pageText()).not.toContain("Upload your ACORN calendar");
    query.resolve(null);
    await waitFor(() => pageText().includes("Upload your ACORN calendar"), "the empty state");

    expect(pageText()).not.toContain("We couldn't restore your cloud timetable.");
  });

  test("restores a remembered local timetable independently in guest mode", async () => {
    const local = meeting({ id: "local", courseCode: "LOCAL101H5" });
    remember([local], "2026-08-01T12:00:00.000Z");
    authSnapshot = { user: null, loading: false, error: null };

    await mountRoute();
    await waitFor(() => pageText().includes("LOCAL101H5"), "the local timetable");

    expect(loadCalls).toHaveLength(0);
    expect(pageText()).toContain("Your timetable");
  });

  test.each([
    ["cloud", "2026-08-01T10:00:00.000Z", "2026-08-01T12:00:00.000Z", "CLOUD201H5"],
    ["local", "2026-08-01T12:00:00.000Z", "2026-08-01T10:00:00.000Z", "LOCAL201H5"],
  ])(
    "uses %s timestamp precedence in the mounted route",
    async (_source, localTime, cloudTime, expectedCode) => {
      const local = meeting({ id: "local-precedence", courseCode: "LOCAL201H5" });
      const cloud = meeting({ id: "cloud-precedence", courseCode: "CLOUD201H5" });
      remember([local], localTime);
      authSnapshot = { user: authenticatedUser, loading: false, error: null };
      loadImplementation = async () => ({ meetings: [cloud], updatedAt: cloudTime });

      await mountRoute();
      await waitFor(() => pageText().includes(expectedCode), `${_source} precedence`);

      expect(pageText()).toContain(expectedCode);
    },
  );

  test("clears a cloud-restored timetable on sign-out", async () => {
    const cloud = meeting({ id: "signed-out", courseCode: "SIGNOUT101H5" });
    authSnapshot = { user: authenticatedUser, loading: false, error: null };
    loadImplementation = async () => ({
      meetings: [cloud],
      updatedAt: "2026-08-01T12:00:00.000Z",
    });

    await mountRoute();
    await waitFor(() => pageText().includes("SIGNOUT101H5"), "the cloud restore");
    await setAuth({ user: null, loading: false, error: null });
    await waitFor(() => pageText().includes("Upload your ACORN calendar"), "the signed-out state");

    expect(pageText()).not.toContain("SIGNOUT101H5");
  });

  test("does not query or upload over an already loaded in-memory timetable", async () => {
    authSnapshot = { user: null, loading: false, error: null };
    await mountRoute();
    await waitFor(() => pageText().includes("Try a demo"), "the demo button");

    const demoButton = Array.from(container!.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Try a demo"),
    );
    expect(demoButton).toBeTruthy();
    await act(async () =>
      demoButton?.dispatchEvent(new browserWindow.MouseEvent("click", { bubbles: true })),
    );
    await waitFor(() => pageText().includes("Demo timetable"), "the in-memory demo timetable");

    await setAuth({ user: authenticatedUser, loading: false, error: null });
    await flush();

    expect(pageText()).toContain("Demo timetable");
    expect(loadCalls).toHaveLength(0);
    expect(saveCalls).toHaveLength(0);
  });
});
