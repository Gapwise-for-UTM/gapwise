import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, MapPinned } from "lucide-react";
import { getRecognizedBuilding } from "@/data/utm/building-registry";
import { evaluateOpenNow } from "@/features/campus-state/hours";
import { getCampusPlace, getCampusSource } from "@/features/campus-state/snapshot";

export const Route = createFileRoute("/places/$placeId")({
  loader: ({ params }) => {
    const place = getCampusPlace(params.placeId);
    if (!place) throw notFound();
    return place;
  },
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData ? `${loaderData.name} — Gapwise Places` : "Place — Gapwise" }],
  }),
  component: PlacePage,
});

function PlacePage() {
  const place = Route.useLoaderData();
  const building = getRecognizedBuilding(place.buildingCode);
  const source = getCampusSource(place.metadataProvenance.sourceId);
  const open = evaluateOpenNow(place.hours, place.hoursProvenance);
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <Link
          to="/places"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-accent"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          All places
        </Link>
        <article className="surface mt-4 overflow-hidden">
          <div className="border-b p-6 sm:p-8">
            <span className="eyebrow capitalize text-accent">{place.kind}</span>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
              {place.name}
            </h1>
            <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">{place.summary}</p>
          </div>
          <div className="grid gap-6 p-6 sm:grid-cols-2 sm:p-8">
            <section>
              <h2 className="font-display text-lg font-semibold">Right now</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {open.state === "unknown"
                  ? "Current hours unknown"
                  : open.state === "open"
                    ? "Open now"
                    : "Closed now"}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Current hours are not assumed when the official source cannot be refreshed.
              </p>
            </section>
            <section>
              <h2 className="font-display text-lg font-semibold">Location</h2>
              <p className="mt-2 flex gap-2 text-sm text-muted-foreground">
                <MapPinned className="h-4 w-4 shrink-0" aria-hidden="true" />
                {building?.name ?? place.buildingCode} ({place.buildingCode})
                {place.floorOrRoom ? ` · ${place.floorOrRoom}` : ""}
              </p>
            </section>
            <section>
              <h2 className="font-display text-lg font-semibold">Useful here</h2>
              <ul className="mt-2 flex flex-wrap gap-2">
                {place.amenities.map((amenity) => (
                  <li key={amenity} className="rounded-full border px-3 py-1 text-xs">
                    {amenity}
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h2 className="font-display text-lg font-semibold">What Gapwise knows</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Identity and location are source-backed. Occupancy, indoor navigation and
                accessibility details are not claimed unless separately verified.
              </p>
              {source && (
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-accent"
                >
                  {source.name}
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              )}
            </section>
          </div>
          {(place.actions?.length ?? 0) > 0 && (
            <footer className="flex flex-wrap gap-3 border-t p-6 sm:p-8">
              {place.actions?.map((action) => (
                <a
                  key={action.url}
                  href={action.url}
                  target="_blank"
                  rel="noreferrer"
                  className="button-primary inline-flex min-h-11 items-center gap-2 px-4 text-sm font-semibold"
                >
                  {action.label}
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </a>
              ))}
            </footer>
          )}
        </article>
      </main>
    </div>
  );
}
