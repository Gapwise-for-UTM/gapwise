import { Link, createFileRoute } from "@tanstack/react-router";
import { CalendarDays, Code2, FileUp, Play, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { DayReplay } from "@/components/DayReplay";
import { BubbleTabs } from "@/components/BubbleTabs";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UTM_ROUTING_GRAPH } from "@/data/utm/campus";
import { DEFAULT_GAP_PREFERENCES } from "@/features/gaps/preferences";
import { createScheduleTransitionPlanner } from "@/features/routing/transition";
import { loadGuestTimetable } from "@/features/security/guest-timetable";
import { DEFAULT_USER_PREFERENCES } from "@/features/sync/preferences";
import { useTheme } from "@/hooks/use-preferences";
import { chooseDefaultTerm } from "@/lib/calendar-awareness";
import { DEMO_MEETINGS } from "@/lib/demo-timetable";
import { IcsParseError, MAX_ICS_FILE_BYTES, parseIcs } from "@/lib/ics-parser";
import { TERMS, type Meeting, type Term } from "@/lib/timetable-types";

export const Route = createFileRoute("/replay")({
  head: () => ({
    meta: [
      { title: "Day Replay — Gapwise for UTM" },
      {
        name: "description",
        content:
          "Replay a UTM class day across the Gapwise campus map. ACORN calendars are parsed locally in your browser.",
      },
      { property: "og:title", content: "Gapwise Day Replay" },
      {
        property: "og:description",
        content: "Watch a UTM timetable unfold across classes, gaps, and campus routes.",
      },
    ],
  }),
  component: ReplayPage,
});

type ReplaySource = "remembered" | "local" | "demo" | null;

function ReplayPage() {
  const { theme, toggleTheme } = useTheme();
  const inputRef = useRef<HTMLInputElement>(null);
  const [meetings, setMeetings] = useState<Meeting[] | null>(null);
  const [source, setSource] = useState<ReplaySource>(null);
  const [term, setTerm] = useState<Term>("Fall");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    void loadGuestTimetable()
      .then((record) => {
        if (!active || !record.meetings?.length) return;
        setMeetings(record.meetings);
        setTerm(chooseDefaultTerm(record.meetings, new Date()));
        setSource("remembered");
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const planTransition = useMemo(
    () => createScheduleTransitionPlanner(UTM_ROUTING_GRAPH, meetings ?? []),
    [meetings],
  );
  const availableTerms = useMemo(
    () => TERMS.filter((item) => meetings?.some((meeting) => meeting.term === item)),
    [meetings],
  );

  async function importCalendar(file: File) {
    setError(null);
    setWarnings([]);
    if (!/\.ics$/i.test(file.name) && file.type !== "text/calendar") {
      setError("Choose an ACORN .ics calendar file.");
      return;
    }
    if (file.size > MAX_ICS_FILE_BYTES) {
      setError("That calendar is too large. Choose an .ics file under 2 MB.");
      return;
    }
    setLoading(true);
    try {
      const result = parseIcs(await file.text());
      setMeetings(result.meetings);
      setTerm(chooseDefaultTerm(result.meetings, new Date()));
      setWarnings(result.warnings);
      setSource("local");
    } catch (cause) {
      setMeetings(null);
      setSource(null);
      setError(
        cause instanceof IcsParseError
          ? cause.message
          : "Gapwise couldn't read that calendar. Export a fresh .ics file from ACORN and try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  function loadDemo() {
    setError(null);
    setWarnings([]);
    setMeetings(DEMO_MEETINGS);
    setTerm(chooseDefaultTerm(DEMO_MEETINGS, new Date()));
    setSource("demo");
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="app-nav sticky top-0 z-30 border-b" data-scrolled="true">
        <div className="mx-auto flex min-h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link to="/" className="brand-lockup flex items-center gap-3" aria-label="Gapwise home">
            <span className="brand-mark-shell">
              <img src="/logo-mark.svg" alt="" aria-hidden="true" />
            </span>
            <span className="font-display text-base font-semibold tracking-[-0.035em]">
              Gapwise <span className="brand-utm-pill">UTM</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to="/developers"
              className="button-secondary hidden min-h-9 items-center gap-2 px-3 text-xs font-semibold sm:inline-flex"
            >
              <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
              Developers
            </Link>
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-10">
        <section className="rise-in mb-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <p className="eyebrow text-accent">Gapwise Labs</p>
            <h1 className="mt-2 max-w-4xl font-display text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
              Replay an entire UTM day.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
              Move a virtual clock through your classes and watch the campus route, gaps, and
              deterministic planning context appear as the day unfolds.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/40 px-3 py-2">
              <ShieldCheck className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
              .ics parsed locally
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/40 px-3 py-2">
              <CalendarDays className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
              No replay backend
            </span>
          </div>
        </section>

        <input
          ref={inputRef}
          type="file"
          accept=".ics,text/calendar"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importCalendar(file);
            event.target.value = "";
          }}
        />

        {!meetings ? (
          <section className="surface rise-in mx-auto max-w-3xl p-7 text-center sm:p-10">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-accent/20 bg-accent/8 text-accent">
              <Play className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className="mt-5 font-display text-2xl font-semibold tracking-tight">
              Pick a timetable to replay
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
              Import an ACORN calendar for a private local replay, or use Gapwise's synthetic demo
              timetable. The original file is not uploaded by this page.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
              <button
                type="button"
                disabled={loading}
                onClick={() => inputRef.current?.click()}
                className="button-primary inline-flex min-h-11 items-center justify-center gap-2 px-4 text-sm font-semibold disabled:opacity-60"
              >
                <FileUp className="h-4 w-4" aria-hidden="true" />
                {loading ? "Reading…" : "Import ACORN .ics"}
              </button>
              <button
                type="button"
                onClick={loadDemo}
                className="button-secondary min-h-11 px-4 text-sm font-semibold"
              >
                Use demo timetable
              </button>
            </div>
            {error ? (
              <p className="mt-4 text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </section>
        ) : (
          <div className="space-y-4">
            <section className="surface flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">
                  {source === "demo"
                    ? "Synthetic demo timetable"
                    : source === "remembered"
                      ? "Remembered browser timetable"
                      : "Local ACORN import"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {meetings.length} meetings available · replay calculations stay on this device
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {availableTerms.length > 1 ? (
                  <BubbleTabs
                    label="Replay term"
                    items={availableTerms.map((item) => ({ value: item, label: item }))}
                    value={term}
                    onChange={setTerm}
                    compact
                    className="w-44"
                  />
                ) : null}
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="button-secondary min-h-10 px-3 text-xs font-semibold"
                >
                  Replace calendar
                </button>
                <button
                  type="button"
                  onClick={loadDemo}
                  className="button-secondary min-h-10 px-3 text-xs font-semibold"
                >
                  Demo
                </button>
              </div>
            </section>

            {warnings.length > 0 ? (
              <section className="surface border-accent/30 p-4 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground">Calendar notes</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {warnings.slice(0, 4).map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            <DayReplay
              meetings={meetings}
              term={term}
              preferences={DEFAULT_USER_PREFERENCES}
              gapPreferences={DEFAULT_GAP_PREFERENCES}
              planTransition={planTransition}
            />
          </div>
        )}

        <p className="mt-8 text-center font-mono text-[0.62rem] uppercase tracking-[0.13em] text-muted-foreground">
          Independent student project · Not affiliated with U of T
        </p>
      </main>
    </div>
  );
}
