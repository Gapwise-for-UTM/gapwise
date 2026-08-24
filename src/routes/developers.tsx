import { Link, createFileRoute } from "@tanstack/react-router";
import {
  BookOpen,
  Braces,
  Code2,
  Database,
  FileJson2,
  Package,
  Route as RouteIcon,
  ShieldCheck,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTheme } from "@/hooks/use-preferences";

export const Route = createFileRoute("/developers")({
  head: () => ({
    meta: [
      { title: "Gapwise Developers — UTM campus intelligence API" },
      {
        name: "description",
        content:
          "Build with Gapwise public UTM building, place, routing, and deterministic gap-planning data.",
      },
      { property: "og:title", content: "Gapwise Developers" },
      {
        property: "og:description",
        content: "A small public API for deterministic UTM campus intelligence.",
      },
    ],
  }),
  component: DevelopersPage,
});

const API_EXAMPLE = `const response = await fetch("https://api.gapwise.ca/v1/routes", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ from: "MN", to: "IB" }),
});

const { data, meta } = await response.json();`;

const ENDPOINTS = [
  ["GET", "/v1", "API discovery"],
  ["GET", "/v1/buildings", "Buildings and provenance"],
  ["GET", "/v1/places", "Campus places and availability"],
  ["POST", "/v1/routes", "Deterministic routing"],
  ["POST", "/v1/gaps/plan", "Route-aware gap planning"],
] as const;

const ENTRY_POINTS = [
  {
    icon: BookOpen,
    title: "Read the docs",
    body: "Start with the contract, examples, uncertainty model, and platform guarantees.",
    href: "https://docs.gapwise.ca",
    label: "docs.gapwise.ca",
  },
  {
    icon: Package,
    title: "Use an official SDK",
    body: "Typed JavaScript and Python clients live with the API implementation and share its release checks.",
    href: "https://github.com/andrewmuratov/gapwise/tree/main/sdk",
    label: "SDK source",
  },
  {
    icon: Braces,
    title: "Generate a client",
    body: "The OpenAPI 3.1 document is the authoritative machine-readable contract for v1.",
    href: "https://api.gapwise.ca/openapi.json",
    label: "OpenAPI 3.1",
  },
] as const;

function DevelopersPage() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="app-nav sticky top-0 z-30 border-b" data-scrolled="true">
        <div className="mx-auto flex min-h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link to="/" className="brand-lockup flex items-center gap-3" aria-label="Gapwise home">
            <span className="brand-mark-shell">
              <img src="/logo-mark.svg" alt="" aria-hidden="true" />
            </span>
            <span className="font-display text-base font-semibold tracking-[-0.035em]">
              Gapwise <span className="brand-utm-pill">UTM</span>
            </span>
          </Link>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-border">
          <div className="topography-field" aria-hidden="true" />
          <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <p className="eyebrow text-accent">Gapwise Developers</p>
              <h1 className="mt-4 max-w-3xl font-display text-4xl font-semibold tracking-[-0.055em] sm:text-6xl">
                Build with the campus layer behind Gapwise.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-muted-foreground">
                Public UTM buildings, places, deterministic routing, and gap planning through one
                versioned contract. No student timetable, account, or private location data is
                required.
              </p>
              <div className="mt-7 flex flex-wrap gap-2">
                <a
                  href="https://docs.gapwise.ca"
                  className="button-primary inline-flex min-h-11 items-center gap-2 px-4 text-sm font-semibold"
                >
                  <BookOpen className="h-4 w-4" aria-hidden="true" />
                  Documentation
                </a>
                <a
                  href="https://api.gapwise.ca/openapi.json"
                  className="button-secondary inline-flex min-h-11 items-center gap-2 px-4 text-sm font-semibold"
                >
                  <Braces className="h-4 w-4" aria-hidden="true" />
                  OpenAPI
                </a>
                <a
                  href="https://github.com/andrewmuratov/gapwise"
                  target="_blank"
                  rel="noreferrer"
                  className="button-secondary inline-flex min-h-11 items-center gap-2 px-4 text-sm font-semibold"
                >
                  <Code2 className="h-4 w-4" aria-hidden="true" />
                  GitHub
                </a>
              </div>
            </div>

            <div className="surface overflow-hidden">
              <div className="border-b border-border px-4 py-3 font-mono text-[0.65rem] uppercase tracking-[0.11em] text-muted-foreground">
                Plain HTTP works everywhere
              </div>
              <pre className="overflow-x-auto p-5 text-[0.75rem] leading-6 text-foreground">
                <code>{API_EXAMPLE}</code>
              </pre>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="grid gap-4 md:grid-cols-3">
            {ENTRY_POINTS.map((item) => {
              const Icon = item.icon;
              return (
                <a
                  key={item.title}
                  href={item.href}
                  className="surface group p-5 transition-transform hover:-translate-y-0.5"
                >
                  <Icon className="h-5 w-5 text-accent" aria-hidden="true" />
                  <h2 className="mt-5 font-display text-xl font-semibold tracking-tight">
                    {item.title}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
                  <p className="mt-5 font-mono text-xs font-semibold text-accent">{item.label} →</p>
                </a>
              );
            })}
          </div>

          <div className="mt-12 grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
            <section>
              <p className="eyebrow text-accent">Contract</p>
              <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight">
                Small surface, explicit semantics.
              </h2>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">
                Successful v1 responses use a <code>{`{ data, meta }`}</code> envelope. Errors use a
                structured <code>error</code> object with an API version and request ID. Unknown
                campus facts stay unknown instead of being converted into confident guesses.
              </p>
              <div className="mt-6 space-y-3 text-sm text-muted-foreground">
                <p className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                  Public v1 requires no API key and excludes private student/account data.
                </p>
                <p className="flex items-start gap-2">
                  <Database className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                  Building and place data carries provenance and coverage information.
                </p>
                <p className="flex items-start gap-2">
                  <RouteIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                  Routing and gap planning reuse deterministic Gapwise engines.
                </p>
              </div>
            </section>

            <section className="surface overflow-hidden" aria-labelledby="endpoints-title">
              <div className="border-b border-border p-5">
                <p className="eyebrow text-accent">Canonical base URL</p>
                <h2 id="endpoints-title" className="mt-2 font-mono text-lg font-semibold">
                  https://api.gapwise.ca/v1
                </h2>
              </div>
              <div className="divide-y divide-border">
                {ENDPOINTS.map(([method, path, detail]) => (
                  <div
                    key={path}
                    className="grid gap-1 px-5 py-4 sm:grid-cols-[3rem_minmax(0,1fr)_auto] sm:items-center sm:gap-4"
                  >
                    <span className="font-mono text-[0.65rem] font-semibold text-accent">{method}</span>
                    <code className="break-all text-xs font-semibold">{path}</code>
                    <span className="text-xs text-muted-foreground sm:text-right">{detail}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="mt-12 surface flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="flex items-center gap-2 font-semibold">
                <FileJson2 className="h-4 w-4 text-accent" aria-hidden="true" />
                Versioned public campus snapshot
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Need data without an API call? Download the public UTM snapshot directly.
              </p>
            </div>
            <a
              href="/data/utm-campus-v1.json"
              className="button-secondary inline-flex min-h-10 shrink-0 items-center justify-center px-4 text-xs font-semibold"
            >
              Download JSON
            </a>
          </section>
        </section>
      </main>
    </div>
  );
}
