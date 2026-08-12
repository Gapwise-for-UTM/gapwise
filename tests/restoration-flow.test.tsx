import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { Window } from "happy-dom";
import { StrictMode, act, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { Meeting } from "@/lib/timetable-types";
import type { PrivateDataPayloadV1 } from "@/features/security/private-data";
import { DEFAULT_USER_PREFERENCES } from "@/features/sync/preferences";
import { DEFAULT_GAP_PREFERENCES } from "@/features/gaps/preferences";
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

type EncryptedFixture = {
  meetings: Meeting[];
  updatedAt: string;
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
let loadImplementation: (userId: string) => Promise<EncryptedFixture | null> = async () => null;

function payload(meetings: Meeting[]): PrivateDataPayloadV1 {
  return {
    schemaVersion: 1,
    schedule: meetings,
    personalItems: [],
    preferences: DEFAULT_USER_PREFERENCES,
    gapPreferences: DEFAULT_GAP_PREFERENCES,
  };
}

mock.module("@/features/auth/use-auth", () => ({ useAuth: useMockAuth }));
mock.module("@/features/sync/encrypted-sync-service", () => ({
  loadEncryptedPrivateState: async (userId: string) => {
    loadCalls.push(userId);
    const record = await loadImplementation(userId);
    return record
      ? {
          payload: payload(record.meetings),
          source: "cloud" as const,
          updatedAt: record.updatedAt,
          persistentKeys: true,
        }
      : null;
  },
  saveEncryptedPrivateState: async () => undefined,
  deleteEncryptedPrivateCloud: async () => undefined,
  isEncryptedSyncOptedIn: () => false,
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
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

beforeEach(() => {
  authSnapshot = { user: null, loading: true, error: null };
  loadImplementation = async () => null;
  loadCalls.length = 0;
  localStorage.clear();
  sessionStorage.clear();
  document.body.replaceChildren();
});

afterEach(async () => {
  await unmountRoute();
});

describe("route-level encrypted timetable restoration", () => {
  test("waits for delayed auth and renders encrypted cloud data without flashing upload", async () => {
    const cloud = meeting({ id: "cloud", courseCode: "CLOUD101H5" });
    const query = deferred<EncryptedFixture | null>();
    loadImplementation = async () => query.promise;

    await mountRoute();
    expect(pageText()).toContain("Checking for your timetable…");
    expect(pageText()).not.toContain("Upload your ACORN calendar");

    await setAuth({ user: authenticatedUser, loading: false, error: null });
    await waitFor(() => loadCalls.length === 1, "the encrypted restore to start");
    query.resolve({ meetings: [cloud], updatedAt: "2026-08-01T12:00:00.000Z" });
    await waitFor(() => pageText().includes("CLOUD101H5"), "the cloud timetable to render");

    expect(pageText()).toContain("Your timetable");
    expect(pageText()).not.toContain("Drop your .ics file here");
    expect(loadCalls).toEqual([authenticatedUser.id]);
  });

  test("restores encrypted cloud data again after a simulated reload", async () => {
    const cloud = meeting({ id: "reload-cloud", courseCode: "RELOAD101H5" });
    authSnapshot = { user: authenticatedUser, loading: false, error: null };
    loadImplementation = async () => ({
      meetings: [cloud],
      updatedAt: "2026-08-01T12:00:00.000Z",
    });

    await mountRoute();
    await waitFor(() => pageText().includes("RELOAD101H5"), "the first encrypted restore");
    await unmountRoute();
    await mountRoute();
    await waitFor(() => pageText().includes("RELOAD101H5"), "the reload encrypted restore");

    expect(loadCalls).toEqual([authenticatedUser.id, authenticatedUser.id]);
  });

  test("shows a visible error when encrypted cloud restore fails", async () => {
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
  });

  test("shows upload only after authenticated encrypted restore returns no record", async () => {
    const query = deferred<EncryptedFixture | null>();
    authSnapshot = { user: authenticatedUser, loading: false, error: null };
    loadImplementation = async () => query.promise;

    await mountRoute();
    expect(pageText()).not.toContain("Upload your ACORN calendar");
    query.resolve(null);
    await waitFor(() => pageText().includes("Upload your ACORN calendar"), "the empty state");
    expect(pageText()).not.toContain("We couldn't restore your cloud timetable.");
  });

  test("ignores and removes legacy plaintext remembered timetable state", async () => {
    const legacy = meeting({ id: "legacy-local", courseCode: "LEGACY101H5" });
    localStorage.setItem("gapwise:remember", "1");
    localStorage.setItem(
      "gapwise:timetable",
      JSON.stringify({ data: [legacy], updatedAt: "2026-08-01T12:00:00.000Z" }),
    );
    authSnapshot = { user: null, loading: false, error: null };

    await mountRoute();
    await waitFor(() => pageText().includes("Upload your ACORN calendar"), "the guest empty state");

    expect(pageText()).not.toContain("LEGACY101H5");
    expect(localStorage.getItem("gapwise:timetable")).toBeNull();
    expect(localStorage.getItem("gapwise:remember")).toBeNull();
  });

  test("clears encrypted cloud-restored UI state on sign-out", async () => {
    const cloud = meeting({ id: "signed-out", courseCode: "SIGNOUT101H5" });
    authSnapshot = { user: authenticatedUser, loading: false, error: null };
    loadImplementation = async () => ({
      meetings: [cloud],
      updatedAt: "2026-08-01T12:00:00.000Z",
    });

    await mountRoute();
    await waitFor(() => pageText().includes("SIGNOUT101H5"), "the encrypted restore");
    await setAuth({ user: null, loading: false, error: null });
    await waitFor(() => pageText().includes("Upload your ACORN calendar"), "the signed-out state");
    expect(pageText()).not.toContain("SIGNOUT101H5");
  });

  test("ignores an encrypted restore that resolves after sign-out", async () => {
    const cloud = meeting({ id: "stale", courseCode: "STALE101H5" });
    const query = deferred<EncryptedFixture | null>();
    authSnapshot = { user: authenticatedUser, loading: false, error: null };
    loadImplementation = async () => query.promise;

    await mountRoute();
    await waitFor(() => loadCalls.length === 1, "the encrypted restore to start");
    await setAuth({ user: null, loading: false, error: null });
    query.resolve({ meetings: [cloud], updatedAt: "2026-08-01T12:00:00.000Z" });
    await waitFor(() => pageText().includes("Upload your ACORN calendar"), "the guest state");
    await flush();

    expect(pageText()).not.toContain("STALE101H5");
    expect(loadCalls).toEqual([authenticatedUser.id]);
  });

  test("keeps the weekly grid mounted while switching schedule views", async () => {
    authSnapshot = { user: null, loading: false, error: null };
    await mountRoute();
    await waitFor(() => pageText().includes("Try a demo"), "the demo button");
    const buttons = () => Array.from(container!.querySelectorAll("button"));
    const click = async (label: string) => {
      const button = buttons().find((candidate) => candidate.textContent?.includes(label));
      expect(button).toBeTruthy();
      await act(async () =>
        button?.dispatchEvent(new browserWindow.MouseEvent("click", { bubbles: true })),
      );
    };

    await click("Try a demo");
    await waitFor(() => pageText().includes("Demo timetable"), "the demo timetable");
    const courseNode = Array.from(container!.querySelectorAll("span")).find(
      (node) => node.textContent === "DEM101H5",
    );
    expect(courseNode).toBeTruthy();

    await click("Gap plan");
    expect(container!.contains(courseNode!)).toBeTrue();
    await click("Weekly timetable");
    expect(
      Array.from(container!.querySelectorAll("span")).find(
        (node) => node.textContent === "DEM101H5",
      ),
    ).toBe(courseNode);
  });

  test("does not query cloud over an already loaded in-memory demo", async () => {
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
  });
});
