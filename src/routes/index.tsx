import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { CalendarRange, LayoutGrid, MapPinned, ShieldCheck, Trash2, Upload, X } from "lucide-react";
import { GapPlan } from "@/components/GapPlan";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TimetableGrid } from "@/components/TimetableGrid";
import { TodaySummary } from "@/components/TodaySummary";
import { UploadPanel } from "@/components/UploadPanel";
import { AccountStatus } from "@/features/auth/AccountStatus";
import { useAuth } from "@/features/auth/use-auth";
import { CloudSyncControls } from "@/features/sync/CloudSyncControls";
import { DEFAULT_USER_PREFERENCES, type UserPreferences } from "@/features/sync/preferences";
import {
  loadRememberedRecord,
  saveRemembered,
  useIntroDismissed,
  useTheme,
} from "@/hooks/use-preferences";
import { DEMO_MEETINGS } from "@/lib/demo-timetable";
import { findGaps } from "@/lib/gaps";
import { IcsParseError, parseIcs } from "@/lib/ics-parser";
import type { Meeting, Term } from "@/lib/timetable-types";
import { chooseRestoration, type RestorationState } from "@/features/sync/restoration";
import { deserializeSchedule } from "@/features/sync/schedule-serialization";
import { loadScheduleRecord } from "@/features/sync/sync-service";

const DayRoute = lazy(() =>
  import("@/components/DayRoute").then((module) => ({ default: module.DayRoute })),
);

const TITLE = "Gapwise UTM — Smarter Campus Gaps";
const DESCRIPTION =
  "An independent student project for finding useful UTM timetable gaps and campus routes, with private browser parsing and optional cloud sync.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: Index,
});

const STEPS = [
  { title: "Export from ACORN", body: "Download your timetable as a .ics calendar file." },
  { title: "Upload the .ics file", body: "It is parsed locally in your browser." },
  {
    title: "Review your weekly gap plan",
    body: "See every gap, how long it is, and where you are.",
  },
];

function Index() {
  const { theme, toggleTheme } = useTheme();
  const { dismissed, dismiss } = useIntroDismissed();
  const { user, loading: authLoading, error: authError } = useAuth();

  const [meetings, setMeetings] = useState<Meeting[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(false);
  const [term, setTerm] = useState<Term>("Fall");
  const [view, setView] = useState<"timetable" | "gaps" | "route">("timetable");
  const [isDemo, setIsDemo] = useState(false);
  const [sourceFilename, setSourceFilename] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_USER_PREFERENCES);
  const [localRecord] = useState(() => {
    if (typeof window === "undefined") return null;
    const stored = loadRememberedRecord<unknown>();
    if (!stored.record) return { remember: stored.remember, record: null };
    try {
      return {
        remember: stored.remember,
        record: {
          data: deserializeSchedule(stored.record.data),
          updatedAt: stored.record.updatedAt,
        },
      };
    } catch {
      return { remember: stored.remember, record: null };
    }
  });
  const [restoration, setRestoration] = useState<RestorationState>("waiting-for-auth");
  const [restorationMessage, setRestorationMessage] = useState<string | null>(null);
  const restoredSource = useRef<"memory" | "local" | "cloud" | "none">("none");
  const latestMeetings = useRef<Meeting[] | null>(meetings);
  const mounted = useRef(false);
  const requestVersion = useRef(0);
  const requestedUser = useRef<string | null>(null);
  const previousUser = useRef<string | null>(null);
  const authenticatedUserId = user?.id ?? null;

  latestMeetings.current = meetings;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    setRemember(localRecord?.remember ?? false);
  }, [localRecord]);

  useEffect(() => {
    if (authLoading) {
      setRestoration("waiting-for-auth");
      return;
    }
    const userId = authenticatedUserId;
    if (!userId) {
      requestVersion.current += 1;
      requestedUser.current = null;
      let currentMeetings = latestMeetings.current;
      if (previousUser.current && restoredSource.current === "cloud") {
        currentMeetings = null;
        latestMeetings.current = null;
        setMeetings(null);
      }
      previousUser.current = null;
      const choice = chooseRestoration(
        restoredSource.current === "memory" ? currentMeetings : null,
        localRecord?.record ?? null,
        null,
      );
      if (choice.meetings && choice.source !== "memory") {
        latestMeetings.current = choice.meetings;
        setMeetings(choice.meetings);
      }
      restoredSource.current = choice.source;
      setRestoration(authError ? "failed" : choice.state);
      setRestorationMessage(
        authError
          ? "We couldn't restore your signed-in session. Cloud restore is unavailable."
          : null,
      );
      return;
    }

    if (previousUser.current !== userId) {
      requestVersion.current += 1;
      requestedUser.current = null;
      if (previousUser.current && restoredSource.current === "cloud") {
        latestMeetings.current = null;
        setMeetings(null);
      }
      previousUser.current = userId;
    }

    if (latestMeetings.current?.length && restoredSource.current === "memory") {
      setRestoration("restored-memory");
      return;
    }
    if (requestedUser.current === userId) return;
    requestedUser.current = userId;
    const version = ++requestVersion.current;
    setRestoration("checking-cloud");
    setRestorationMessage(null);
    let timeoutId: number | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = window.setTimeout(() => reject(new Error("timeout")), 8000);
    });
    const cloudRequest = Promise.resolve().then(() => loadScheduleRecord(userId));
    void Promise.race([cloudRequest, timeout])
      .then((cloud) => {
        if (
          !mounted.current ||
          requestVersion.current !== version ||
          previousUser.current !== userId
        )
          return;
        const memory = restoredSource.current === "memory" ? latestMeetings.current : null;
        const choice = chooseRestoration(memory, localRecord?.record ?? null, cloud);
        if (choice.meetings && choice.source !== "memory") {
          latestMeetings.current = choice.meetings;
          setMeetings(choice.meetings);
        }
        restoredSource.current = choice.source;
        setRestoration(choice.state);
        if (choice.state === "cloud-version-available")
          setRestorationMessage("A cloud version is available; your local timetable was kept.");
      })
      .catch(() => {
        if (
          !mounted.current ||
          requestVersion.current !== version ||
          previousUser.current !== userId
        )
          return;
        const memory = restoredSource.current === "memory" ? latestMeetings.current : null;
        const choice = chooseRestoration(memory, localRecord?.record ?? null, null);
        if (choice.meetings && choice.source !== "memory") {
          latestMeetings.current = choice.meetings;
          setMeetings(choice.meetings);
        }
        restoredSource.current = choice.source;
        setRestoration("failed");
        setRestorationMessage(
          "We couldn't restore your cloud timetable. Your local timetable is unchanged.",
        );
      })
      .finally(() => {
        if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      });
  }, [authLoading, authError, authenticatedUserId, localRecord]);

  const terms = useMemo(() => {
    if (!meetings) return [] as Term[];
    return (["Fall", "Winter"] as Term[]).filter((t) => meetings.some((m) => m.term === t));
  }, [meetings]);

  useEffect(() => {
    if (terms.length > 0 && !terms.includes(term)) setTerm(terms[0]!);
  }, [terms, term]);

  const termMeetings = useMemo(
    () => (meetings ?? []).filter((m) => m.term === term),
    [meetings, term],
  );
  const gaps = useMemo(() => findGaps(meetings ?? [], term), [meetings, term]);

  async function handleFile(file: File) {
    setError(null);
    if (!/\.ics$/i.test(file.name) && file.type !== "text/calendar") {
      setError("That file type isn't supported. Please choose a .ics calendar file.");
      return;
    }
    setLoading(true);
    try {
      const text = await file.text();
      const result = parseIcs(text);
      setMeetings(result.meetings);
      latestMeetings.current = result.meetings;
      restoredSource.current = "memory";
      setRestoration("restored-memory");
      setRestorationMessage(null);
      setWarnings(result.warnings);
      setIsDemo(false);
      setSourceFilename(file.name);
      saveRemembered(remember, remember ? result.meetings : null);
    } catch (err) {
      setMeetings(null);
      latestMeetings.current = null;
      restoredSource.current = "none";
      setWarnings([]);
      setError(
        err instanceof IcsParseError
          ? err.message
          : "Something went wrong while reading that calendar. Try exporting it from ACORN again.",
      );
    } finally {
      setLoading(false);
    }
  }

  function loadDemo() {
    setError(null);
    setWarnings([]);
    setMeetings(DEMO_MEETINGS);
    latestMeetings.current = DEMO_MEETINGS;
    restoredSource.current = "memory";
    setRestoration("restored-memory");
    setRestorationMessage(null);
    setIsDemo(true);
    setSourceFilename(null);
    setTerm("Fall");
  }

  function clearTimetable() {
    setMeetings(null);
    latestMeetings.current = null;
    restoredSource.current = "none";
    setRestoration("no-cloud-data");
    setRestorationMessage(null);
    setWarnings([]);
    setError(null);
    setIsDemo(false);
    setSourceFilename(null);
    saveRemembered(remember, null);
  }

  function loadCloudTimetable(cloudMeetings: Meeting[]) {
    setMeetings(cloudMeetings);
    latestMeetings.current = cloudMeetings;
    setWarnings([]);
    setError(null);
    setIsDemo(false);
    setSourceFilename(null);
    const firstTerm = (["Fall", "Winter"] as Term[]).find((item) =>
      cloudMeetings.some((meeting) => meeting.term === item),
    );
    if (firstTerm) setTerm(firstTerm);
    saveRemembered(remember, remember ? cloudMeetings : null);
    restoredSource.current = "cloud";
    setRestoration("restored-cloud");
  }

  function handleRemember(value: boolean) {
    setRemember(value);
    saveRemembered(value, value && !isDemo ? meetings : null);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <a href="/" aria-label="Gapwise UTM home" className="flex min-w-0 items-center gap-3">
            <img src="/logo-mark.svg" alt="" aria-hidden="true" className="h-8 w-8 shrink-0" />
            <div className="min-w-0">
              <p className="font-display text-lg font-semibold">Gapwise UTM</p>
            </div>
          </a>
          <div className="flex items-center gap-2">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <AccountStatus
              user={user}
              loading={authLoading}
              onAccountDeleted={(clearLocal) => {
                const retainedLocal = clearLocal
                  ? null
                  : loadRememberedRecord<Meeting[]>().record?.data;
                setMeetings(retainedLocal?.length ? retainedLocal : null);
                latestMeetings.current = retainedLocal?.length ? retainedLocal : null;
                restoredSource.current = retainedLocal?.length ? "local" : "none";
                setRestoration(retainedLocal?.length ? "restored-local" : "no-cloud-data");
                setRestorationMessage(null);
              }}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-9">
        {(authLoading || restoration === "checking-cloud") && !meetings ? (
          <div className="py-16" role="status" aria-live="polite">
            <div className="h-4 w-36 animate-pulse rounded bg-muted" />
            <div className="mt-4 h-24 max-w-xl animate-pulse rounded-xl bg-muted" />
            <span className="sr-only">Checking for your timetable…</span>
          </div>
        ) : !meetings ? (
          <>
            <section className="max-w-2xl">
              <h1 className="text-3xl font-semibold leading-tight sm:text-5xl">
                Turn your ACORN timetable into a smarter campus day.
              </h1>
              <p className="mt-4 text-base text-muted-foreground sm:text-lg">
                Upload your calendar export to find useful gaps and plan routes between classes. No
                account is required; private cloud sync is optional.
              </p>
              <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1.5 text-xs font-medium">
                <ShieldCheck className="h-4 w-4 text-accent" aria-hidden="true" />
                The original calendar file is parsed in your browser and is never uploaded
              </p>
            </section>

            <ol className="mt-10 grid gap-4 sm:grid-cols-3">
              {STEPS.map((step, i) => (
                <li key={step.title} className="surface p-5">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  <h2 className="mt-3 text-base font-semibold">{step.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
                </li>
              ))}
            </ol>

            <div className="mt-10">
              <UploadPanel
                onFile={handleFile}
                onDemo={loadDemo}
                loading={loading}
                error={error}
                remember={remember}
                onRememberChange={handleRemember}
              />
            </div>
            <div className="mt-6">
              <CloudSyncControls
                user={user}
                meetings={meetings}
                sourceFilename={sourceFilename}
                onLoad={loadCloudTimetable}
                restorationState={restoration}
              />
            </div>
          </>
        ) : (
          <>
            {!dismissed ? (
              <div className="surface mb-6 flex items-start justify-between gap-4 bg-secondary/50 p-4">
                <p className="text-sm text-muted-foreground">
                  Switch between <strong className="text-foreground">Weekly timetable</strong>,{" "}
                  <strong className="text-foreground">Gap plan</strong>, and{" "}
                  <strong className="text-foreground">Day route</strong>. Verified route data is
                  used where available; estimates are labelled.
                </p>
                <button
                  type="button"
                  onClick={dismiss}
                  aria-label="Dismiss instructions"
                  className="rounded-md p-1 text-muted-foreground hover:bg-secondary"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ) : null}

            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold sm:text-3xl">
                  {isDemo ? "Demo timetable" : "Your timetable"}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {termMeetings.length} meetings in {term} · {gaps.length} gaps detected
                </p>
              </div>
              <button
                type="button"
                onClick={clearTimetable}
                className="inline-flex items-center gap-2 rounded-lg border border-input bg-card px-4 py-2 text-sm font-semibold transition-colors hover:bg-secondary"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Remove timetable
              </button>
            </div>

            {warnings.length > 0 ? (
              <div className="surface mt-6 border-accent/40 p-4">
                <h2 className="text-sm font-semibold">A few things to double-check</h2>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <TodaySummary meetings={meetings} preferences={preferences} />

            <div className="mt-6 flex flex-wrap items-center gap-3">
              {terms.length > 1 ? (
                <div
                  role="tablist"
                  aria-label="Term"
                  className="inline-flex rounded-lg border border-border bg-card p-1"
                >
                  {terms.map((t) => (
                    <button
                      key={t}
                      role="tab"
                      type="button"
                      aria-selected={term === t}
                      onClick={() => setTerm(t)}
                      className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-colors ${
                        term === t
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-secondary"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              ) : null}

              <div
                role="tablist"
                aria-label="View mode"
                className="inline-flex rounded-lg border border-border bg-card p-1"
              >
                <button
                  role="tab"
                  type="button"
                  aria-selected={view === "timetable"}
                  onClick={() => setView("timetable")}
                  className={`inline-flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-semibold transition-colors ${
                    view === "timetable"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  <LayoutGrid className="h-4 w-4" aria-hidden="true" />
                  Weekly timetable
                </button>
                <button
                  role="tab"
                  type="button"
                  aria-selected={view === "gaps"}
                  onClick={() => setView("gaps")}
                  className={`inline-flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-semibold transition-colors ${
                    view === "gaps"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  <CalendarRange className="h-4 w-4" aria-hidden="true" />
                  Gap plan
                </button>
                <button
                  role="tab"
                  type="button"
                  aria-selected={view === "route"}
                  onClick={() => setView("route")}
                  className={`inline-flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-semibold transition-colors ${
                    view === "route"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  <MapPinned className="h-4 w-4" aria-hidden="true" />
                  Day route
                </button>
              </div>
            </div>

            <div className="mt-6">
              {termMeetings.length === 0 ? (
                <div className="surface p-8 text-center">
                  <h2 className="text-lg font-semibold">Nothing scheduled in {term}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    This export doesn&apos;t contain any {term} term meetings.
                  </p>
                </div>
              ) : view === "timetable" ? (
                <TimetableGrid meetings={termMeetings} />
              ) : view === "gaps" ? (
                <GapPlan gaps={gaps} preferences={preferences} />
              ) : (
                <Suspense
                  fallback={
                    <div
                      className="surface h-96 animate-pulse p-6 text-sm text-muted-foreground"
                      role="status"
                    >
                      Loading the route map…
                    </div>
                  }
                >
                  <DayRoute
                    meetings={meetings}
                    term={term}
                    onTermChange={setTerm}
                    preferences={preferences}
                    onPreferencesChange={setPreferences}
                    user={user}
                  />
                </Suspense>
              )}
            </div>

            <div className="mt-10">
              <UploadPanel
                onFile={handleFile}
                onDemo={loadDemo}
                loading={loading}
                error={error}
                remember={remember}
                onRememberChange={handleRemember}
              />
            </div>
            <div className="mt-6">
              <CloudSyncControls
                user={user}
                meetings={meetings}
                sourceFilename={sourceFilename}
                onLoad={loadCloudTimetable}
                restorationState={restoration}
              />
            </div>
          </>
        )}
        {restorationMessage ? (
          <div
            className="fixed bottom-4 left-1/2 z-40 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm shadow-sm"
            role="status"
          >
            <span>{restorationMessage}</span>
            <button
              type="button"
              className="font-semibold"
              onClick={() => setRestorationMessage(null)}
              aria-label="Dismiss message"
            >
              ×
            </button>
          </div>
        ) : null}
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl space-y-2 px-4 py-8 text-sm text-muted-foreground sm:px-6">
          <p className="inline-flex items-center gap-2">
            <Upload className="h-4 w-4" aria-hidden="true" />
            Your calendar is parsed in your browser. Cloud sync is optional.
          </p>
          <p>
            Gapwise UTM is an independent student project and is not affiliated with the University
            of Toronto.
          </p>
        </div>
      </footer>
    </div>
  );
}
