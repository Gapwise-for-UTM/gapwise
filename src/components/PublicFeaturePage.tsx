import { ArrowRight, ExternalLink, ShieldCheck } from "lucide-react";
import type { PublicFeaturePage as PublicFeaturePageData } from "@/content/public-feature-pages";

const RESOURCE_LINKS = [
  ["/utm-timetable", "Timetable"],
  ["/gap-planner", "Gap planner"],
  ["/campus-map", "Campus map"],
  ["/campus-routing", "Campus routing"],
  ["/acorn-import", "ACORN import"],
  ["/about", "About"],
] as const;

export function PublicFeaturePage({ page }: { page: PublicFeaturePageData }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background/92 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <a href="/" className="brand-lockup flex items-center gap-3" aria-label="Gapwise home">
            <span className="brand-mark-shell">
              <img src="/logo-mark.svg" alt="" aria-hidden="true" />
            </span>
            <span className="font-display text-base font-semibold tracking-tight">Gapwise</span>
          </a>
          <nav
            className="hidden items-center gap-5 text-sm text-muted-foreground md:flex"
            aria-label="Public product pages"
          >
            <a href="/about" className="hover:text-foreground">
              About
            </a>
            <a href="/developers" className="hover:text-foreground">
              Developers
            </a>
            <a href="https://docs.gapwise.ca" className="hover:text-foreground">
              Docs
            </a>
          </nav>
          <a
            href="/"
            className="button-primary inline-flex min-h-10 items-center gap-2 px-3 text-sm font-semibold"
          >
            Open Gapwise <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-20">
        <section className="max-w-4xl">
          <p className="eyebrow text-accent">{page.eyebrow}</p>
          <h1 className="mt-4 font-display text-4xl font-semibold tracking-[-0.05em] sm:text-6xl">
            {page.title}
          </h1>
          <p className="mt-6 max-w-3xl text-base leading-8 text-muted-foreground sm:text-lg">
            {page.lead}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="/"
              className="button-primary inline-flex min-h-11 items-center gap-2 px-4 text-sm font-semibold"
            >
              Try Gapwise <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
            <a
              href="https://docs.gapwise.ca"
              className="button-secondary inline-flex min-h-11 items-center gap-2 px-4 text-sm font-semibold"
            >
              Documentation <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
        </section>

        <div className="mt-14 grid gap-4 lg:grid-cols-3">
          {page.sections.map((section, index) => (
            <article key={section.title} className="surface p-6 sm:p-7">
              <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-accent">
                {String(index + 1).padStart(2, "0")}
              </p>
              <h2 className="mt-4 font-display text-xl font-semibold tracking-tight">
                {section.title}
              </h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">{section.body}</p>
              {section.bullets?.length ? (
                <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                  {section.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-2">
                      <span
                        className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                        aria-hidden="true"
                      />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}
        </div>

        <aside className="mt-8 surface flex gap-4 p-5 sm:p-6">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
          <div>
            <h2 className="font-display font-semibold">
              Independent, privacy-first, and explicit about limits
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Gapwise is an independent student-built project for University of Toronto Mississauga.
              It is not an official University of Toronto service and is not affiliated with or
              endorsed by the University.
            </p>
          </div>
        </aside>

        <section className="mt-14 border-t border-border pt-8">
          <p className="eyebrow text-muted-foreground">Explore Gapwise</p>
          <nav className="mt-4 flex flex-wrap gap-2" aria-label="Related Gapwise pages">
            {RESOURCE_LINKS.filter(([href]) => href !== page.path).map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="button-secondary px-3 py-2 text-sm font-semibold"
              >
                {label}
              </a>
            ))}
          </nav>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-xs text-muted-foreground sm:px-6 md:flex-row md:items-center md:justify-between">
          <span>Gapwise · Make the time between classes count.</span>
          <nav className="flex flex-wrap gap-4" aria-label="Gapwise resources">
            <a href="/privacy" className="hover:text-foreground">
              Privacy
            </a>
            <a href="/trust" className="hover:text-foreground">
              Trust
            </a>
            <a href="/support" className="hover:text-foreground">
              Support
            </a>
            <a href="https://github.com/Gapwise-for-UTM" className="hover:text-foreground">
              GitHub
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
