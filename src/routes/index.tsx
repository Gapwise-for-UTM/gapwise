import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarRange, LayoutGrid, MapPinned, ShieldCheck, Trash2, Upload, X } from "lucide-react";
import { GapPlan } from "@/components/GapPlan";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TimetableGrid } from "@/components/TimetableGrid";
import { TodaySummary } from "@/components/TodaySummary";
import { UploadPanel } from "@/components/UploadPanel";
import { UtmMonumentViewer } from "@/components/UtmMonumentViewer";

import { AccountStatus } from "@/features/auth/AccountStatus";
import { useAuth } from "@/features/auth/use-auth";
import { CloudSyncControls } from "@/features/sync/CloudSyncControls";
import { createScheduleTransitionPlanner } from "@/features/routing/transition";
import {
  loadGapPreferences,
  sanitizeGapPreferences,
  saveGapPreferences,
} from "@/features/gaps/preferences";
import type { GapPreferences } from "@/features/gaps/types";
import { DEFAULT_USER_PREFERENCES, type UserPreferences } from "@/features/sync/preferences";
import {
  loadRememberedRecord,
  saveRemembered,
  useIntroDismissed,
  useTheme,
} from "@/hooks/use-preferences";
import { DEMO_MEETINGS } from "@/lib/demo-timetable";
import { chooseDefaultTerm } from "@/lib/calendar-awareness";
import { findGaps } from "@/lib/gaps";
import { IcsParseError, MAX_ICS_FILE_BYTES, parseIcs } from "@/lib/ics-parser";
import { TERMS, type Meeting, type Term } from "@/lib/timetable-types";
import { chooseRestoration, type RestorationState } from "@/features/sync/restoration";
import { deserializeSchedule } from "@/features/sync/schedule-serialization";
import { cloudRestoration, isRestorationAbort } from "@/features/sync/cloud-restoration";
import { UTM_ROUTING_GRAPH } from "@/data/utm/campus";

const DayRoute = lazy(() =>
  import("@/components/DayRoute").then((module) => ({ default: module.DayRoute })),
);

const TITLE = "Gapwise for UTM — Smarter Campus Gaps";
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
  const [openedViews, setOpenedViews] = useState({ gaps: false, route: false });
  const [isDemo, setIsDemo] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_USER_PREFERENCES);
  const [gapPreferences, setGapPreferences] = useState<GapPreferences>(loadGapPreferences);
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
  const replacementInputRef = useRef<HTMLInputElement>(null);
  const authenticatedUserId = user?.id ?? null;
  const planTransition = useMemo(
    () => createScheduleTransitionPlanner(UTM_ROUTING_GRAPH, meetings ?? []),
    [meetings],
  );

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
      cloudRestoration.cancel(previousUser.current);
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
      cloudRestoration.cancel(previousUser.current);
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
    void cloudRestoration
      .restore(userId)
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
      .catch((restoreError: unknown) => {
        if (isRestorationAbort(restoreError)) return;
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
      });
  }, [authLoading, authError, authenticatedUserId, localRecord]);

  const terms = useMemo(() => {
    if (!meetings) return [] as Term[];
    return TERMS.filter((t) => meetings.some((m) => m.term === t));
  }, [meetings]);

  useEffect(() => {
    if (terms.length > 0 && !terms.includes(term)) setTerm(terms[0]!);
  }, [terms, term]);

  useEffect(() => {
    if (meetings?.length) setTerm(chooseDefaultTerm(meetings, new Date()));
  }, [meetings]);

  const termMeetings = useMemo(
    () => (meetings ?? []).filter((m) => m.term === term),
    [meetings, term],
  );
  const gaps = useMemo(() => findGaps(meetings ?? [], term), [meetings, term]);

  async function handleFile(file: File) {
    const previousMeetings = latestMeetings.current;
    setError(null);
    if (!/\.ics$/i.test(file.name) && file.type !== "text/calendar") {
      const message = "That file type isn't supported. Please choose a .ics calendar file.";
      if (previousMeetings?.length) setRestorationMessage(`Update failed · ${message}`);
      else setError(message);
      return;
    }
    if (file.size > MAX_ICS_FILE_BYTES) {
      const message = "That calendar is too large. Please choose an .ics file under 2 MB.";
      if (previousMeetings?.length) setRestorationMessage(`Update failed · ${message}`);
      else setError(message);
      return;
    }
    setRestorationMessage(null);
    setLoading(true);
    try {
      const text = await file.text();
      const result = parseIcs(text);
      setMeetings(result.meetings);
      latestMeetings.current = result.meetings;
      restoredSource.current = "memory";
      setRestoration("restored-memory");
      if (previousMeetings?.length) {
        const previousById = new Map(previousMeetings.map((meeting) => [meeting.id, meeting]));
        const nextIds = new Set(result.meetings.map((meeting) => meeting.id));
        const added = result.meetings.filter((meeting) => !previousById.has(meeting.id)).length;
        const removed = previousMeetings.filter((meeting) => !nextIds.has(meeting.id)).length;
        const changed = result.meetings.filter((meeting) => {
          const previous = previousById.get(meeting.id);
          return previous && JSON.stringify(previous) !== JSON.stringify(meeting);
        }).length;
        const changes = [
          added ? `${added} added` : null,
          removed ? `${removed} removed` : null,
          changed ? `${changed} updated` : null,
        ].filter(Boolean);
        setRestorationMessage(
          `Timetable updated · ${changes.length ? changes.join(" · ") : "no meeting changes"}`,
        );
      } else {
        setRestorationMessage(null);
      }
      setWarnings(result.warnings);
      setIsDemo(false);
      saveRemembered(remember, remember ? result.meetings : null);
    } catch (err) {
      const message =
        err instanceof IcsParseError
          ? err.message
          : "Something went wrong while reading that calendar. Try exporting it from ACORN again.";
      if (previousMeetings?.length) {
        setRestorationMessage(`Update failed · ${message}`);
      } else {
        setMeetings(null);
        latestMeetings.current = null;
        restoredSource.current = "none";
        setWarnings([]);
        setError(message);
      }
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
    saveRemembered(remember, null);
  }

  function loadCloudTimetable(cloudMeetings: Meeting[]) {
    setMeetings(cloudMeetings);
    latestMeetings.current = cloudMeetings;
    setWarnings([]);
    setError(null);
    setIsDemo(false);
    saveRemembered(remember, remember ? cloudMeetings : null);
    restoredSource.current = "cloud";
    setRestoration("restored-cloud");
  }

  function handleRemember(value: boolean) {
    setRemember(value);
    saveRemembered(value, value && !isDemo ? meetings : null);
  }

  function updateGapPreferences(next: GapPreferences) {
    const sanitized = sanitizeGapPreferences(next);
    setGapPreferences(sanitized);
    saveGapPreferences(sanitized);
  }

  const showView = useCallback((nextView: "timetable" | "gaps" | "route") => {
    if (nextView !== "timetable") {
      setOpenedViews((current) => (current[nextView] ? current : { ...current, [nextView]: true }));
    }
    setView(nextView);
  }, []);

  const openGapPlan = useCallback(() => showView("gaps"), [showView]);
  const openDayRoute = useCallback(() => showView("route"), [showView]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <a
            href="/"
            aria-label="Gapwise for UTM home"
            className="group flex min-w-0 items-center gap-3"
          >
            <img
              src="/logo-mark.svg"
              alt=""
              aria-hidden="true"
              className="h-8 w-8 shrink-0 transition-transform duration-300 group-hover:scale-105"
            />
            <div className="min-w-0">
              <p className="truncate font-display text-lg font-semibold tracking-tight">
                Gapwise <span className="text-accent">for UTM</span>
              </p>
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
            <div className="rise-in grid grid-cols-1 overflow-hidden rounded-3xl border border-border bg-card shadow-[var(--shadow-lift)] lg:grid-cols-[1.05fr_1fr]">
              <section className="hero-surface relative flex flex-col p-7 text-hero-foreground sm:p-11 lg:p-12">
                <p className="inline-flex w-fit items-center gap-2 rounded-full border border-hero-accent/30 bg-hero-muted/70 px-3 py-1.5 backdrop-blur">
                  <ShieldCheck className="h-3.5 w-3.5 text-hero-accent" aria-hidden="true" />
                  <span className="eyebrow">Your timetable stays on your device</span>
                </p>

                <h1 className="mt-7 max-w-[19ch] text-balance font-display text-[2.15rem] font-bold leading-[1.05] tracking-tight sm:text-[3.15rem]">
                  Find the gaps in your <span className="text-hero-accent">UTM timetable.</span>
                </h1>

                <p className="mt-4 max-w-md text-base leading-relaxed text-hero-foreground/75 sm:text-lg">
                  Upload your ACORN calendar export to see useful gaps, plan study time, and route
                  between classes across campus.
                </p>

                <div className="mt-8 lg:mt-auto lg:pt-10">
                  <UtmMonumentViewer className="border-hero-accent/25 bg-hero-muted/40 bg-none" />
                  <p className="mt-3 text-xs text-hero-foreground/65">
                    Drag to rotate the UTM entrance monument · scroll or pinch to zoom
                  </p>
                </div>
              </section>

              <div className="flex flex-col justify-center p-7 sm:p-11 lg:p-12">
                <div className="mx-auto w-full max-w-md">
                  <UploadPanel
                    variant="hero"
                    onFile={handleFile}
                    onDemo={loadDemo}
                    loading={loading}
                    error={error}
                    remember={remember}
                    onRememberChange={handleRemember}
                  />
                  <p className="mt-9 border-t border-border pt-6 text-center text-[0.65rem] uppercase leading-relaxed tracking-widest text-muted-foreground">
                    Independent student project · Not affiliated with the University of Toronto
                  </p>
                </div>
              </div>
            </div>

            <ol className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {STEPS.map((step, i) => (
                <li key={step.title} className="surface surface-interactive p-5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary font-display text-sm font-bold text-accent">
                    {i + 1}
                  </span>
                  <h2 className="mt-4 font-display text-base font-semibold tracking-tight">
                    {step.title}
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                </li>
              ))}
            </ol>

            <div className="mt-6">
              <CloudSyncControls
                user={user}
                meetings={meetings}
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

            <div className="rise-in flex flex-col gap-5 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-6">
              <div className="min-w-0">
                <p className="eyebrow text-muted-foreground">
                  {isDemo ? "Sample data" : "Campus day plan"}
                </p>
                <h1 className="mt-1.5 font-display text-2xl font-bold tracking-tight sm:text-3xl">
                  {isDemo ? "Demo timetable" : "Your timetable"}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {termMeetings.length} meetings in {term} · {gaps.length} gaps detected
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 self-start sm:self-auto">
                <input
                  ref={replacementInputRef}
                  type="file"
                  accept=".ics,text/calendar"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void handleFile(file);
                    event.target.value = "";
                  }}
                />
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => replacementInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
                >
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  {loading ? "Updating…" : "Update timetable"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("Remove this timetable from this browser?"))
                      clearTimetable();
                  }}
                  aria-label="Remove timetable"
                  title="Remove timetable"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-input bg-card text-muted-foreground transition-colors hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
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

            <TodaySummary
              meetings={meetings}
              selectedTerm={term}
              preferences={preferences}
              gapPreferences={gapPreferences}
              planTransition={planTransition}
              onOpenGapPlan={openGapPlan}
              onOpenDayRoute={openDayRoute}
            />

            <div className="mt-6 flex flex-wrap items-center gap-3">
              {terms.length > 1 ? (
                <div
                  role="tablist"
                  aria-label="Term"
                  className="inline-flex rounded-2xl border border-border bg-card p-1 shadow-[var(--shadow-soft)]"
                >
                  {terms.map((t) => (
                    <button
                      key={t}
                      role="tab"
                      type="button"
                      aria-selected={term === t}
                      onClick={() => setTerm(t)}
                      className={`rounded-xl px-4 py-1.5 text-sm font-semibold transition-all duration-200 ${
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
                className="grid w-full grid-cols-3 rounded-2xl border border-border bg-card p-1 shadow-[var(--shadow-soft)] sm:inline-flex sm:w-auto"
              >
                <button
                  role="tab"
                  type="button"
                  aria-label="Weekly timetable"
                  aria-selected={view === "timetable"}
                  onClick={() => showView("timetable")}
                  className={`inline-flex min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 py-1.5 text-sm font-semibold transition-all duration-200 sm:gap-2 sm:px-4 ${
                    view === "timetable"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  <LayoutGrid className="h-4 w-4" aria-hidden="true" />
                  <span>
                    <span className="hidden sm:inline">Weekly </span>timetable
                  </span>
                </button>
                <button
                  role="tab"
                  type="button"
                  aria-selected={view === "gaps"}
                  onClick={() => showView("gaps")}
                  className={`inline-flex min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 py-1.5 text-sm font-semibold transition-all duration-200 sm:gap-2 sm:px-4 ${
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
                  onClick={() => showView("route")}
                  className={`inline-flex min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 py-1.5 text-sm font-semibold transition-all duration-200 sm:gap-2 sm:px-4 ${
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
                <div className="surface flex flex-col items-center p-10 text-center sm:p-14">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary">
                    <CalendarRange className="h-6 w-6 text-accent" aria-hidden="true" />
                  </span>
                  <h2 className="mt-5 font-display text-lg font-semibold tracking-tight">
                    Nothing scheduled in {term}
                  </h2>
                  <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                    This export doesn&apos;t contain any {term} term meetings. Try another term tab
                    or upload a different ACORN export.
                  </p>
                </div>
              ) : (
                <>
                  <div hidden={view !== "timetable"}>
                    <TimetableGrid
                      meetings={termMeetings}
                      onRouteToMeeting={() => showView("route")}
                    />
                  </div>
                  {openedViews.gaps ? (
                    <div hidden={view !== "gaps"}>
                      <GapPlan
                        gaps={gaps}
                        preferences={preferences}
                        gapPreferences={gapPreferences}
                        onGapPreferencesChange={updateGapPreferences}
                        planTransition={planTransition}
                      />
                    </div>
                  ) : null}
                  {openedViews.route ? (
                    <div hidden={view !== "route"}>
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
                          planTransition={planTransition}
                        />
                      </Suspense>
                    </div>
                  ) : null}
                </>
              )}
            </div>

            <div className="mt-6">
              <CloudSyncControls
                user={user}
                meetings={meetings}
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

      <footer className="mt-4 border-t border-border bg-card/40">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 text-sm text-muted-foreground sm:grid-cols-[minmax(0,1fr)_auto] sm:px-6">
          <div className="min-w-0 space-y-2">
            <p className="inline-flex items-center gap-2 font-medium text-foreground">
              <Upload className="h-4 w-4 text-accent" aria-hidden="true" />
              Your calendar is parsed in your browser. Cloud sync is optional.
            </p>
            <p className="max-w-xl leading-relaxed">
              Gapwise for UTM is an independent student project and is not affiliated with the
              University of Toronto.
            </p>
          </div>
          <p className="eyebrow self-end text-muted-foreground">Built for UTM students</p>
        </div>
      </footer>
    </div>
  );
}
