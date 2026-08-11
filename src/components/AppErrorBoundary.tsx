import { Component, type ErrorInfo, type ReactNode } from "react";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
};

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  override state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(_error: unknown, _info: ErrorInfo) {
    console.error("Gapwise component rendering failed.");
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background text-foreground">
          <main className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4 py-8 sm:px-6">
            <div className="w-full rounded-3xl border border-border bg-card p-8 text-center shadow-[var(--shadow-soft)]">
              <p className="inline-flex rounded-full border border-border bg-secondary/50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-foreground/80">
                Oops
              </p>
              <h1 className="mt-6 text-2xl font-semibold text-foreground">
                Sorry, something went wrong.
              </h1>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                An unexpected rendering error occurred. Reload the page to continue.
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-6 inline-flex rounded-xl border border-input bg-background px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
              >
                Reload
              </button>
            </div>
          </main>
        </div>
      );
    }

    return this.props.children;
  }
}
