import { Link } from "@tanstack/react-router";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type ThemePreference } from "@/hooks/use-preferences";

export function LegalPage({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  const { preference, setTheme } = useTheme();
  const appearances: Array<{ value: ThemePreference; label: string; icon: typeof Sun }> = [
    { value: "light", label: "Light appearance", icon: Sun },
    { value: "dark", label: "Dark appearance", icon: Moon },
    { value: "system", label: "System appearance", icon: Monitor },
  ];
  return (
    <div className="min-h-screen bg-background text-foreground transition-colors">
      <header className="border-b border-border bg-card/55 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="brand-lockup flex items-center gap-3" aria-label="Gapwise home">
            <span className="brand-mark-shell">
              <img src="/logo-mark.svg" alt="" />
            </span>
            <span className="font-display font-semibold">
              Gapwise <span className="brand-utm-pill">UTM</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <div
              className="flex items-center rounded-xl border border-border bg-background/60 p-1"
              role="radiogroup"
              aria-label="Appearance"
            >
              {appearances.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-label={label}
                  aria-checked={preference === value}
                  onClick={() => setTheme(value)}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${preference === value ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              ))}
            </div>
            <Link to="/" className="button-secondary px-2 py-2 text-sm font-semibold sm:px-3">
              <span className="hidden sm:inline">Open Gapwise</span>
              <span className="sm:hidden">Open</span>
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <p className="eyebrow text-accent">{eyebrow}</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          {title}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">Effective August 21, 2026</p>
        <article className="surface mt-10 space-y-8 bg-card/70 p-6 text-sm leading-7 text-muted-foreground sm:p-9 [&_h2]:mb-2 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
          {children}
        </article>
        <footer className="mt-12 flex gap-4 border-t border-border pt-6 text-sm">
          <Link to="/privacy" className="text-accent hover:underline">
            Privacy
          </Link>
          <Link to="/terms" className="text-accent hover:underline">
            Terms
          </Link>
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
