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
          "Build with Gapwise public UTM data, APIs, SDKs, deterministic routing and gap planning, and permissioned AI integration.",
      },
      { property: "og:title", content: "Gapwise Developers" },
      {
        property: "og:description",
        content: "The developer gateway for Gapwise API, SDKs, open campus data, docs, and AI/MCP.",
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
  ["GET", "/v1", "Discovery and version metadata"],
  ["GET", "/v1/buildings", "Buildings, coverage, and provenance"],
  ["GET", "/v1/places", "Campus places and availability"],
  ["POST", "/v1/routes", "Deterministic campus routing"],
  ["POST", "/v1/gaps/plan", "Route-aware gap assessment"],
] as const;

const ENTRY_POINTS = [
  {
    icon: BookOpen,
    title: "Read the docs",
    body: "Quickstarts, endpoint reference, data provenance, SDK guides, security, AI/MCP, uncertainty, and versioning.",
    href: "https://docs.gapwise.ca",
    label: "docs.gapwise.ca",
  },
  {
    icon: Database,
    title: "Explore campus data",
    body: "Canonical raw UTM campus artifacts, schemas, checksums, provenance, and source-level reuse through Gapwise Data.",
    href: "https://data.gapwise.ca",
    label: "data.gapwise.ca",
  },
  {
    icon: Package,
    title: "Official SDKs",
    body: "Typed JavaScript/TypeScript and Python clients share the same v1 contract and release validation as the API.",
    href: "https://docs.gapwise.ca/sdk/javascript/",
    label: "SDK guides",
  },
  {
    icon: Braces,
    title: "OpenAPI 3.1",
    body: "Generate a client or inspect the authoritative machine-readable contract for every public v1 operation.",
    href: "https://api.gapwise.ca/openapi.json",
    label: "openapi.json",
  },
] as const;

const PLATFORM_FACTS = [
  "Production v1",
  "No API key",
  "Open campus data",
  "Deterministic results",
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
          <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
            <div>
              <p className="eyebrow text-accent">Gapwise Developers · Production platform</p>
              <h1 className="mt-4 max-w-3xl font-display text-4xl font-semibold tracking-[-0.055em] sm:text-6xl">
                Build with the campus layer behind Gapwise.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-muted-foreground">
                Use the stable API and SDKs for deterministic campus intelligence, Gapwise Data for
                canonical raw UTM artifacts, or the separate AI/MCP surface for explicitly delegated
                student context.
              </p>

              <div className="mt-6 flex flex-wrap gap-2" aria-label="Platform properties">
                {PLATFORM_FACTS.map((fact) => (
                  <span
                    key={fact}
                    className="rounded-full border border-border bg-background/80 px-3 py-1.5 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                  >
                    {fact}
                  </span>
                ))}
              </div>

              <div className="mt-7 flex flex-wrap gap-2">
                <a
                  href="https://docs.gapwise.ca"
                  className="button-primary inline-flex min-h-11 items-center gap-2 px-4 text-sm font-semibold"
                >
                  <BookOpen className="h-4 w-4" aria-hidden="true" />
                  Documentation
                </a>
                <a
                  href="https://data.gapwise.ca"
                  className="button-secondary inline-flex min-h-11 items-center gap-2 px-4 text-sm font-semibold"
                >
                  <Database className="h-4 w-4" aria-hidden="true" />
                  Campus data
                </a>
                <a
                  href="https://api.gapwise.ca/openapi.json"
                  className="button-secondary inline-flex min-h-11 items-center gap-2 px-4 text-sm font-semibold"
                >
                  <Braces className="h-4 w-4" aria-hidden="true" />
                  OpenAPI
                </a>
                <a
                  href="https://github.com/Gapwise-for-UTM/gapwise"
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
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                <span className="font-mono text-[0.65rem] uppercase tracking-[0.11em] text-muted-foreground">
                  Plain HTTP · zero setup
                </span>
                <span className="rounded-full border border-border px-2 py-1 font-mono text-[0.6rem] font-semibold text-accent">
                  v1
                </span>
              </div>
              <pre className="overflow-x-auto p-5 text-[0.75rem] leading-6 text-foreground">
                <code>{API_EXAMPLE}</code>
              </pre>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
                  Campus facts originate in Gapwise Data; core pins a tested snapshot rather than
                  adding a runtime dependency on the Data website.
                </p>
                <p className="flex items-start gap-2">
                  <RouteIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                  Routing and gap planning reuse the deterministic engines behind Gapwise.
                </p>
              </div>

              <div className="mt-7 rounded-xl border border-border bg-muted/30 p-4">
                <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  SDK release status
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  The official TypeScript and Python clients are source-available and validated by
                  the release gate. Check the documentation for current npm, JSR, and PyPI
                  availability before installing from a registry.
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
                    <span className="font-mono text-[0.65rem] font-semibold text-accent">
                      {method}
                    </span>
                    <code className="break-all text-xs font-semibold">{path}</code>
                    <span className="text-xs text-muted-foreground sm:text-right">{detail}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-border p-5">
                <a
                  href="https://docs.gapwise.ca/api/"
                  className="font-mono text-xs font-semibold text-accent"
                >
                  Read the complete API reference →
                </a>
              </div>
            </section>
          </div>

          <section className="mt-12 grid gap-4 md:grid-cols-2">
            <div className="surface p-5">
              <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Public data
              </p>
              <div className="mt-3 flex items-start gap-3">
                <FileJson2 className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
                <div>
                  <h2 className="font-display text-lg font-semibold">Canonical raw campus data</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Need source-level GeoJSON, graph artifacts, provenance, or audits rather than
                    API semantics? Gapwise Data publishes the validated canonical tree with
                    checksums.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <a
                      href="https://data.gapwise.ca"
                      className="button-secondary inline-flex min-h-10 items-center justify-center px-4 text-xs font-semibold"
                    >
                      Explore Data
                    </a>
                    <a
                      href="https://data.gapwise.ca/datasets/utm/latest/manifest.json"
                      className="button-secondary inline-flex min-h-10 items-center justify-center px-4 text-xs font-semibold"
                    >
                      Manifest
                    </a>
                    <a
                      href="https://docs.gapwise.ca/data/"
                      className="button-secondary inline-flex min-h-10 items-center justify-center px-4 text-xs font-semibold"
                    >
                      Data docs
                    </a>
                    <a
                      href="/data/utm-campus-v1.json"
                      className="button-secondary inline-flex min-h-10 items-center justify-center px-4 text-xs font-semibold"
                    >
                      Download JSON
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="surface p-5">
              <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Operational contract
              </p>
              <h2 className="mt-3 font-display text-lg font-semibold">Build defensively.</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Treat unknown availability as unknown, preserve request IDs in error reports, and
                handle <code>429</code> responses without assuming a fixed global quota. Versioning
                and compatibility guarantees are documented explicitly.
              </p>
              <a
                href="https://docs.gapwise.ca/platform/versioning/"
                className="mt-4 inline-block font-mono text-xs font-semibold text-accent"
              >
                Versioning policy →
              </a>
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}
