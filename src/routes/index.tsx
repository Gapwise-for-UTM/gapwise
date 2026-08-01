import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarRange, LayoutGrid, ShieldCheck, Trash2, Upload, X } from "lucide-react";
import { GapPlan } from "@/components/GapPlan";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TimetableGrid } from "@/components/TimetableGrid";
import { UploadPanel } from "@/components/UploadPanel";
import {
  loadRemembered,
  saveRemembered,
  useIntroDismissed,
  useTheme,
} from "@/hooks/use-preferences";
import { DEMO_MEETINGS } from "@/lib/demo-timetable";
import { findGaps } from "@/lib/gaps";
import { IcsParseError, parseIcs } from "@/lib/ics-parser";
import type { Meeting, Term } from "@/lib/timetable-types";

const TITLE = "Gapwise UTM — Find the useful gaps in your UTM timetable";
const DESCRIPTION =
  "Upload your ACORN .ics export to see your weekly UTM timetable and every useful gap between classes. Parsed in your browser; no account required.";

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
  { title: "Upload the .ics file", body: "It is parsed locally, in this browser tab only." },
  { title: "Review your weekly gap plan", body: "See every gap, how long it is, and where you are." },
];

function Index() {
  const { theme, toggleTheme } = useTheme();
  const { dismissed, dismiss } = useIntroDismissed();

  const [meetings, setMeetings] = useState<Meeting[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(false);
  const [term, setTerm] = useState<Term>("Fall");
  const [view, setView] = useState<"timetable" | "gaps">("timetable");
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    const { remember: stored, data } = loadRemembered<Meeting[]>();
    setRemember(stored);
    if (data && data.length > 0) setMeetings(data);
  }, []);

  const terms = useMemo(() => {
    if (!meetings) return [] as Term[];
    return (["Fall", "Winter"] as Term[]).filter((t) =>
      meetings.some((m) => m.term === t)
    );
  }, [meetings]);

  useEffect(() => {
    if (terms.length > 0 && !terms.includes(term)) setTerm(terms[0]!);
  }, [terms, term]);

  const termMeetings = useMemo(
    () => (meetings ?? []).filter((m) => m.term === term),
    [meetings, term]
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
      setWarnings(result.warnings);
      setIsDemo(false);
      saveRemembered(remember, remember ? result.meetings : null);
    } catch (err) {
      setMeetings(null);
      setWarnings([]);
      setError(
        err instanceof IcsParseError
          ? err.message
          : "Something went wrong while reading that calendar. Try exporting it from ACORN again."
      );
    } finally {
      setLoading(false);
    }
  }

  function loadDemo() {
    setError(null);
    setWarnings([]);
    setMeetings(DEMO_MEETINGS);
    setIsDemo(true);
    setTerm("Fall");
  }

  function clearTimetable() {
    setMeetings(null);
    setWarnings([]);
    setError(null);
    setIsDemo(false);
    saveRemembered(remember, null);
  }

  function handleRemember(value: boolean) {
    setRemember(value);
    saveRemembered(value, value && !isDemo ? meetings : null);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <p className="font-display text-lg font-semibold">Gapwise UTM</p>
            <p className="text-xs text-muted-foreground">Your timetable stays on your device.</p>
          </div>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        {!meetings ? (
          <>
            <section className="max-w-2xl">
              <h1 className="text-3xl font-semibold leading-tight sm:text-5xl">
                Turn your ACORN timetable into a smarter campus day.
              </h1>
              <p className="mt-4 text-base text-muted-foreground sm:text-lg">
                Upload your calendar export to find every useful gap between classes. No account
                required, and your timetable never leaves your device.
              </p>
              <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1.5 text-xs font-medium">
                <ShieldCheck className="h-4 w-4 text-accent" aria-hidden="true" />
                Parsed in your browser — nothing is uploaded
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
          </>
        ) : (
          <>
            {!dismissed ? (
              <div className="surface mb-6 flex items-start justify-between gap-4 bg-secondary/50 p-4">
                <p className="text-sm text-muted-foreground">
                  Switch between <strong className="text-foreground">Weekly timetable</strong> and{" "}
                  <strong className="text-foreground">Gap plan</strong> below. Gaps are grouped by
                  weekday, and usable time already accounts for walking between buildings.
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
              ) : (
                <GapPlan gaps={gaps} />
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
          </>
        )}
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl space-y-2 px-4 py-8 text-sm text-muted-foreground sm:px-6">
          <p className="inline-flex items-center gap-2">
            <Upload className="h-4 w-4" aria-hidden="true" />
            Your timetable stays on your device.
          </p>
          <p>
            Gapwise UTM is an independent student project and is not affiliated with the
            University of Toronto.
          </p>
        </div>
      </footer>
    </div>
  );
}
