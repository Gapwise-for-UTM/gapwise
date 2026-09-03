import { createFileRoute } from "@tanstack/react-router";
import { listSeoWalkingRoutes } from "@/data/seo-walking-routes";

export const Route = createFileRoute("/utm/walking-times")({
  head: () => ({
    meta: [
      { title: "UTM Building Walking Times — Gapwise" },
      {
        name: "description",
        content:
          "Check Gapwise walking-time estimates between major University of Toronto Mississauga buildings, including Davis, CCT, Deerfield, Kaneff, and MN.",
      },
    ],
    links: [{ rel: "canonical", href: "https://gapwise.ca/utm/walking-times" }],
  }),
  component: WalkingTimesPage,
});

function WalkingTimesPage() {
  const routes = listSeoWalkingRoutes();

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-10 sm:px-6">
      <p className="text-sm font-medium text-accent">UTM campus routing</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        UTM building walking times
      </h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        Compare Gapwise&apos;s deterministic building-to-building route estimates for major UTM
        buildings. Estimates are planning guidance rather than guarantees and can vary with route
        conditions, accessibility needs, entrances, elevators, congestion, construction, weather,
        and walking speed.
      </p>

      <section className="mt-8">
        <h2 className="text-xl font-semibold text-foreground">Popular building pairs</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {routes.map(({ route, from, to }) => (
            <a
              key={route}
              href={`/utm/walking-time/${route}`}
              className="rounded-xl border border-border bg-card/40 p-4 transition-colors hover:border-accent/40 hover:bg-card/70"
            >
              <strong className="block text-foreground">
                {from.shortName} to {to.shortName}
              </strong>
              <span className="mt-1 block text-sm text-muted-foreground">
                {from.name} → {to.name}
              </span>
            </a>
          ))}
        </div>
      </section>

      <section className="mt-10 border-t border-border pt-6">
        <h2 className="text-xl font-semibold text-foreground">How the estimates work</h2>
        <p className="mt-3 text-muted-foreground">
          Gapwise uses its maintained UTM campus model and deterministic routing engine. When a
          connected mapped route is available, the estimate follows that campus path. When evidence
          is incomplete, Gapwise labels the result approximate or unavailable instead of presenting
          an inferred route as verified.
        </p>
        <p className="mt-3 text-muted-foreground">
          For schedule-aware planning, import your ACORN timetable into Gapwise and use the full app
          to combine walking time with class transitions, gaps, leave-by timing, and route confidence.
        </p>
      </section>
    </main>
  );
}
