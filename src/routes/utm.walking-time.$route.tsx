import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getSeoWalkingRoute } from "@/data/seo-walking-routes";

type RouteMetrics = {
  status: "same-building" | "routed" | "approximate" | "unavailable";
  accuracy: string;
  totalDistanceMeters: number | null;
  estimatedSeconds: number | null;
  warnings: string[];
  routeVerification: "verified" | "mixed" | "inferred" | "unavailable";
};

type ApiResponse = {
  route?: RouteMetrics;
};

export const Route = createFileRoute("/utm/walking-time/$route")({
  head: ({ params }) => {
    const pair = getSeoWalkingRoute(params.route);
    if (!pair) return {};

    const canonical = `https://gapwise.ca/utm/walking-time/${pair.route}`;
    return {
      meta: [
        {
          title: `${pair.from.shortName} to ${pair.to.shortName} Walking Time at UTM — Gapwise`,
        },
        {
          name: "description",
          content: `Check the Gapwise walking-time estimate from ${pair.from.name} to ${pair.to.name} at UTM, with route distance, confidence, and planning context.`,
        },
      ],
      links: [{ rel: "canonical", href: canonical }],
    };
  },
  component: WalkingTimeRoutePage,
});

function formatMinutes(seconds: number) {
  const minutes = seconds / 60;
  return minutes < 1 ? "under 1 minute" : `about ${Math.ceil(minutes)} minutes`;
}

function WalkingTimeRoutePage() {
  const { route } = Route.useParams();
  const pair = getSeoWalkingRoute(route);
  const fromCode = pair?.from.code ?? null;
  const toCode = pair?.to.code ?? null;
  const [metrics, setMetrics] = useState<RouteMetrics | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!fromCode || !toCode) return;
    const controller = new AbortController();
    setMetrics(null);
    setFailed(false);

    void fetch("/api/utm-route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: fromCode, to: toCode }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("route request failed");
        return (await response.json()) as ApiResponse;
      })
      .then((payload) => {
        if (!payload.route) throw new Error("route payload missing");
        setMetrics(payload.route);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setFailed(true);
      });

    return () => controller.abort();
  }, [fromCode, toCode]);

  if (!pair) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-2xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-bold text-foreground">Walking-time route not found</h1>
        <p className="mt-3 text-muted-foreground">
          This public route is not part of the maintained Gapwise walking-time index.
        </p>
        <a className="mt-5 inline-block text-accent hover:underline" href="/utm/walking-times">
          View UTM walking times
        </a>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-10 sm:px-6">
      <nav className="text-sm text-muted-foreground" aria-label="Breadcrumb">
        <a href="/" className="hover:text-foreground">
          Gapwise
        </a>{" "}
        /{" "}
        <a href="/utm/walking-times" className="hover:text-foreground">
          UTM walking times
        </a>{" "}
        / {pair.from.shortName} to {pair.to.shortName}
      </nav>

      <article className="mt-6">
        <p className="text-sm font-medium text-accent">UTM campus routing</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {pair.from.shortName} to {pair.to.shortName} walking time at UTM
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          {pair.from.name} → {pair.to.name}
        </p>

        <div className="mt-6 rounded-2xl border border-border bg-card/50 p-5">
          {metrics && metrics.estimatedSeconds !== null && metrics.totalDistanceMeters !== null ? (
            <>
              <p className="text-2xl font-semibold text-foreground">
                {formatMinutes(metrics.estimatedSeconds)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Approximately {Math.round(metrics.totalDistanceMeters)} metres · {metrics.accuracy}
              </p>
              <p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">
                Route evidence: {metrics.routeVerification}
              </p>
            </>
          ) : failed ? (
            <p className="text-muted-foreground">
              The live route estimate could not be loaded. Open the Gapwise route planner to retry.
            </p>
          ) : (
            <p className="text-muted-foreground">Loading the current Gapwise route estimate…</p>
          )}
        </div>

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-foreground">Planning this class transition</h2>
          <p className="mt-3 text-muted-foreground">
            Gapwise calculates this building-to-building estimate from its maintained campus model.
            The result is useful for planning back-to-back classes, but it is not a guarantee of how
            long your walk will take. Entrances, elevators, construction, congestion, weather,
            accessibility needs, route choice, and personal walking speed can change the real time.
          </p>
        </section>

        {metrics?.warnings.length ? (
          <section className="mt-8">
            <h2 className="text-xl font-semibold text-foreground">Route notes</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">
              {metrics.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="mt-8 border-t border-border pt-6">
          <h2 className="text-xl font-semibold text-foreground">Use this with your timetable</h2>
          <p className="mt-3 text-muted-foreground">
            Import your UTM ACORN timetable into Gapwise to combine campus walking estimates with
            actual class times, schedule gaps, transition buffers, and leave-by timing.
          </p>
          <div className="mt-4 flex flex-wrap gap-4">
            <a href="/" className="text-accent hover:underline">
              Open Gapwise
            </a>
            <a href="/utm/walking-times" className="text-accent hover:underline">
              Compare more UTM building routes
            </a>
            <a href="https://data.gapwise.ca/" className="text-accent hover:underline">
              Campus data provenance
            </a>
          </div>
        </section>
      </article>
    </main>
  );
}
