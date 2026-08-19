import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  Braces,
  CheckCircle2,
  Code2,
  Database,
  Download,
  ExternalLink,
  FileJson2,
  Github,
  MapPinned,
  Play,
  Route as RouteIcon,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTheme } from "@/hooks/use-preferences";

export const Route = createFileRoute("/developers")({
  head: () => ({
    meta: [
      { title: "Gapwise Platform — UTM campus intelligence for developers" },
      {
        name: "description",
        content:
          "Build on Gapwise's public UTM building, routing, and deterministic gap-planning data with an OpenAPI contract, zero-dependency client, and open dataset snapshot.",
      },
      { property: "og:title", content: "Gapwise Platform" },
      {
        property: "og:description",
        content: "Public UTM campus intelligence, an open dataset, and a zero-dependency developer client.",
      },
    ],
  }),
  component: DevelopersPage,
});

const SDK_EXAMPLE = `import { gapwise } from "https://gapwise.ca/sdk/gapwise-utm.js";

const route = await gapwise.route({
  from: "MN",
  to: "IB",
});

console.log(route.route.estimatedSeconds);`;

const GAP_EXAMPLE = `const plan = await gapwise.planGap({
  from: "MN",
  to: "IB",
  term: "Fall",
  weekday: "Wednesday",
  startTime: 660,
  endTime: 780,
});

console.log(plan.gapPlan.assessment.primary);`;

type PlaygroundMode = "route" | "gap" | "buildings";

function DevelopersPage() {
  const { theme, toggleTheme } = useTheme();
  const [mode, setMode] = useState<PlaygroundMode>("route");
  const [result, setResult] = useState<string>("");
  const [running, setRunning] = useState(false);

  async function runExample() {
    setRunning(true);
    setResult("");
    try {
      let response: Response;
      if (mode === "buildings") {
        response = await fetch("/api/utm-buildings");
      } else if (mode === "gap") {
        response = await fetch("/api/utm-gap-plan", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            from: "MN",
            to: "IB",
            term: "Fall",
            weekday: "Wednesday",
            startTime: 660,
            endTime: 780,
          }),
        });
      } else {
        response = await fetch("/api/utm-route", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ from: "MN", to: "IB" }),
        });
      }
      const body = (await response.json()) as unknown;
      setResult(JSON.stringify(body, null, 2));
    } catch {
      setResult(JSON.stringify({ error: "The live example could not be reached." }, null, 2));
    } finally {
      setRunning(false);
    }
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
              to="/replay"
              className="button-secondary hidden min-h-9 items-center gap-2 px-3 text-xs font-semibold sm:inline-flex"
            >
              <Play className="h-3.5 w-3.5" aria-hidden="true" />
              Day Replay
            </Link>
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-border">
          <div className="topography-field" aria-hidden="true" />
          <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1.05fr)_minmax(24rem,0.95fr)] lg:items-center">
            <div>
              <p className="eyebrow text-accent">Gapwise Platform · public preview</p>
              <h1 className="mt-4 max-w-4xl font-display text-4xl font-semibold tracking-[-0.055em] sm:text-6xl">
                UTM campus intelligence, open to build on.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-muted-foreground">
                Use the deterministic building, routing, and gap-planning layer behind Gapwise
                without importing a student's timetable or requesting private account access.
              </p>
              <div className="mt-7 flex flex-wrap gap-2">
                <a
                  href="/openapi.json"
                  className="button-primary inline-flex min-h-11 items-center gap-2 px-4 text-sm font-semibold"
                >
                  <Braces className="h-4 w-4" aria-hidden="true" />
                  OpenAPI contract
                </a>
                <a
                  href="/data/utm-campus-v1.json"
                  className="button-secondary inline-flex min-h-11 items-center gap-2 px-4 text-sm font-semibold"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Download dataset
                </a>
                <a
                  href="https://github.com/andrewmuratov/gapwise"
                  target="_blank"
                  rel="noreferrer"
                  className="button-secondary inline-flex min-h-11 items-center gap-2 px-4 text-sm font-semibold"
                >
                  <Github className="h-4 w-4" aria-hidden="true" />
                  Source
                </a>
              </div>
            </div>

            <div className="surface overflow-hidden p-1">
              <div className="border-b border-border px-4 py-3 font-mono text-[0.65rem] uppercase tracking-[0.11em] text-muted-foreground">
                Zero-dependency client
              </div>
              <pre className="overflow-x-auto p-5 text-[0.75rem] leading-6 text-foreground">
                <code>{SDK_EXAMPLE}</code>
              </pre>
              <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                Browser ESM · standard fetch · no API key for public campus data
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Database,
                value: "30",
                label: "canonical UTM buildings",
              },
              {
                icon: RouteIcon,
                value: "4",
                label: "bounded public endpoints",
              },
              {
                icon: ShieldCheck,
                value: "0",
                label: "student records required",
              },
              {
                icon: FileJson2,
                value: "1",
                label: "versioned open snapshot",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.label} className="surface p-5">
                  <Icon className="h-4 w-4 text-accent" aria-hidden="true" />
                  <p className="mt-5 font-mono text-3xl font-semibold tabular-nums">{item.value}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.label}</p>
                </article>
              );
            })}
          </div>

          <div className="mt-12 grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <section>
              <p className="eyebrow text-accent">Public surface</p>
              <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight">
                Four small primitives. One shared engine.
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">
                These endpoints expose the same bounded campus logic used by Gapwise's own product
                surfaces. Responses label routing coverage and uncertainty instead of inventing
                missing indoor or accessibility data.
              </p>
              <div className="mt-6 space-y-2">
                {[
                  ["GET", "/api/utm-buildings", "Canonical building inventory and provenance"],
                  ["GET", "/api/utm-building?q=MN", "Resolve one canonical UTM building"],
                  ["POST", "/api/utm-route", "Deterministic building-to-building route"],
                  ["POST", "/api/utm-gap-plan", "Route-aware deterministic gap assessment"],
                ].map(([method, path, detail]) => (
                  <div
                    key={path}
                    className="surface flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:gap-4"
                  >
                    <span className="w-12 shrink-0 font-mono text-[0.65rem] font-semibold text-accent">
                      {method}
                    </span>
                    <code className="min-w-0 flex-1 break-all text-xs font-semibold">{path}</code>
                    <span className="text-xs text-muted-foreground sm:max-w-[15rem] sm:text-right">
                      {detail}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="surface overflow-hidden" aria-labelledby="playground-title">
              <div className="border-b border-border p-5">
                <p className="eyebrow text-accent">Live playground</p>
                <h2 id="playground-title" className="mt-2 font-display text-2xl font-semibold">
                  Call production on purpose.
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Nothing runs just because this page loaded. Choose an example, then execute one
                  bounded request against the public API.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {[
                    ["route", "MN → IB route"],
                    ["gap", "11–1 gap plan"],
                    ["buildings", "Building inventory"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={mode === value}
                      onClick={() => {
                        setMode(value as PlaygroundMode);
                        setResult("");
                      }}
                      className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                        mode === value
                          ? "border-accent/50 bg-accent/10 text-accent"
                          : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-5">
                <button
                  type="button"
                  disabled={running}
                  onClick={() => void runExample()}
                  className="button-primary inline-flex min-h-10 items-center gap-2 px-4 text-sm font-semibold disabled:opacity-60"
                >
                  <Play className="h-4 w-4" aria-hidden="true" />
                  {running ? "Running…" : "Run live example"}
                </button>
                <pre className="mt-4 max-h-[28rem] min-h-52 overflow-auto rounded-xl border border-border bg-background/70 p-4 text-[0.68rem] leading-5 text-muted-foreground">
                  <code>
                    {result ||
                      (mode === "gap"
                        ? GAP_EXAMPLE
                        : mode === "buildings"
                          ? "GET https://gapwise.ca/api/utm-buildings"
                          : SDK_EXAMPLE)}
                  </code>
                </pre>
              </div>
            </section>
          </div>

          <section className="mt-12">
            <p className="eyebrow text-accent">Open UTM data</p>
            <div className="mt-3 grid gap-4 lg:grid-cols-3">
              <article className="surface p-5 lg:col-span-2">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent/20 bg-accent/8 text-accent">
                    <Database className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="font-display text-xl font-semibold tracking-tight">
                      A provenance-preserving campus snapshot
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      The versioned JSON contains the canonical building inventory, aliases,
                      routing-coverage status, entrance counts, accessibility status, and source
                      provenance already exposed by the public API.
                    </p>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <a
                    href="/data/utm-campus-v1.json"
                    className="button-secondary inline-flex min-h-10 items-center gap-2 px-3 text-xs font-semibold"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    JSON snapshot
                  </a>
                  <a
                    href="https://github.com/andrewmuratov/gapwise/tree/main/src/data/utm"
                    target="_blank"
                    rel="noreferrer"
                    className="button-secondary inline-flex min-h-10 items-center gap-2 px-3 text-xs font-semibold"
                  >
                    <MapPinned className="h-3.5 w-3.5" aria-hidden="true" />
                    Routing source files
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                </div>
              </article>
              <article className="surface p-5">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <ShieldCheck className="h-4 w-4 text-accent" aria-hidden="true" />
                  Licensing stays explicit
                </p>
                <p className="mt-3 text-xs leading-6 text-muted-foreground">
                  Gapwise code is MIT. Upstream data keeps its own licensing and attribution
                  requirements. OpenStreetMap-derived records require OpenStreetMap attribution and
                  ODbL compliance; the snapshot preserves source URLs and verification state.
                </p>
              </article>
            </div>
          </section>

          <section className="mt-12 grid gap-4 md:grid-cols-3">
            {[
              {
                icon: Code2,
                title: "Use the tiny client",
                body: "Import a static ESM module from gapwise.ca. It is a thin typed wrapper over the public HTTP contract, not another backend.",
                href: "/sdk/gapwise-utm.js",
                link: "JavaScript client",
              },
              {
                icon: Braces,
                title: "Generate your own client",
                body: "Use the OpenAPI 3.1 document with your preferred generator, validation stack, or API tooling.",
                href: "/openapi.json",
                link: "OpenAPI JSON",
              },
              {
                icon: Sparkles,
                title: "See the product consume it",
                body: "Day Replay demonstrates the same deterministic campus model as a visual, fully client-side schedule simulation.",
                href: "/replay",
                link: "Open Day Replay",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="surface flex flex-col p-5">
                  <Icon className="h-4 w-4 text-accent" aria-hidden="true" />
                  <h3 className="mt-5 font-display text-lg font-semibold tracking-tight">
                    {item.title}
                  </h3>
                  <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">{item.body}</p>
                  <a
                    href={item.href}
                    className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-accent hover:underline"
                  >
                    {item.link}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                </article>
              );
            })}
          </section>
        </section>

        <footer className="border-t border-border px-4 py-8 text-center sm:px-6">
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.13em] text-muted-foreground">
            Independent student project · Not affiliated with U of T
          </p>
        </footer>
      </main>
    </div>
  );
}
