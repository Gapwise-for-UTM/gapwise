import { Link } from "@tanstack/react-router";

export function LegalPage({
  eyebrow,
  title,
  dateLabel = "Effective",
  date = "August 21, 2026",
  children,
}: {
  eyebrow: string;
  title: string;
  dateLabel?: string;
  date?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex min-h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="brand-lockup flex items-center gap-3" aria-label="Gapwise home">
            <span className="brand-mark-shell">
              <img src="/logo-mark.svg" alt="" />
            </span>
            <span className="font-display font-semibold">Gapwise UTM</span>
          </Link>
          <Link to="/" className="button-secondary px-3 py-2 text-sm font-semibold">
            Open Gapwise
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <p className="eyebrow text-accent">{eyebrow}</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          {title}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {dateLabel} {date}
        </p>
        <article className="mt-10 space-y-8 text-sm leading-7 text-muted-foreground [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mb-2 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
          {children}
        </article>
        <footer className="mt-12 flex flex-wrap gap-4 border-t border-border pt-6 text-sm">
          <Link to="/trust" className="text-accent hover:underline">
            Trust Center
          </Link>
          <Link to="/privacy" className="text-accent hover:underline">
            Privacy
          </Link>
          <Link to="/terms" className="text-accent hover:underline">
            Terms
          </Link>
          <Link to="/security" className="text-accent hover:underline">
            Security
          </Link>
          <Link to="/accessibility" className="text-accent hover:underline">
            Accessibility
          </Link>
          <a href="https://status.gapwise.ca/" className="text-accent hover:underline">
            Status
          </a>
          <a
            href="https://github.com/andrewmuratov/gapwise"
            className="text-accent hover:underline"
          >
            Source
          </a>
        </footer>
      </main>
    </div>
  );
}
