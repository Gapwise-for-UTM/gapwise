import { DoorOpen, MapPin, Search, ShieldCheck, X } from "lucide-react";
import { useMemo, useState } from "react";
import { CampusMap, type CampusMapProps } from "./CampusMap";
import {
  getBuildingExplorerDetails,
  searchCampusBuildings,
  type BuildingSearchResult,
} from "@/features/routing/building-explorer";

type CampusExplorerProps = Omit<CampusMapProps, "selectedBuildingCode" | "onSelectBuilding"> & {
  selectedBuildingCode: string | null;
  onSelectBuilding: (code: string | null) => void;
};

function verificationLabel(verified: number, inferred: number) {
  if (verified > 0 && inferred === 0) return "Verified mapped entrance data";
  if (verified > 0) return "Mixed verified and inferred approach data";
  if (inferred > 0) return "Mapped approach; entrance verification pending";
  return "Entrance verification unknown";
}

function confidenceLabel(verified: number, inferred: number) {
  if (verified > 0 && inferred === 0) return "Verified";
  if (verified > 0 && inferred > 0) return "Mixed";
  if (inferred > 0) return "Inferred";
  return "Unknown";
}

function floorStatusLabel(result: BuildingSearchResult) {
  if (result.floorVerification === "verified") return "verified";
  if (result.floorVerification === "inferred") return "inferred";
  return "floor status unknown";
}

export function CampusExplorer({
  selectedBuildingCode,
  onSelectBuilding,
  ...mapProps
}: CampusExplorerProps) {
  const [query, setQuery] = useState("");
  const [roomResult, setRoomResult] = useState<BuildingSearchResult | null>(null);
  const results = useMemo(() => searchCampusBuildings(query), [query]);
  const details = useMemo(
    () => getBuildingExplorerDetails(selectedBuildingCode),
    [selectedBuildingCode],
  );

  function selectResult(result: BuildingSearchResult) {
    setQuery("");
    setRoomResult(result.room ? result : null);
    onSelectBuilding(result.building.code);
  }

  function selectFromMap(code: string) {
    setRoomResult(null);
    onSelectBuilding(code);
  }

  function clearSelection() {
    setRoomResult(null);
    setQuery("");
    onSelectBuilding(null);
  }

  return (
    <div className="campus-explorer relative">
      <CampusMap
        {...mapProps}
        selectedBuildingCode={selectedBuildingCode}
        onSelectBuilding={selectFromMap}
      />

      <div className="campus-explorer-search absolute left-3 top-3 z-20 w-[min(22rem,calc(100%-5.75rem))]">
        <label htmlFor="campus-building-search" className="sr-only">
          Search UTM buildings
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            id="campus-building-search"
            type="search"
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setQuery("");
              if (event.key === "Enter" && results[0]) {
                event.preventDefault();
                selectResult(results[0]);
              }
            }}
            placeholder="Search MN, Deerfield, Kaneff…"
            aria-describedby="campus-search-help"
            className="h-11 w-full rounded-xl border border-border bg-popover/96 pl-10 pr-3 text-sm text-popover-foreground shadow-lg outline-none backdrop-blur focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
          />
        </div>
        <span id="campus-search-help" className="sr-only">
          Search by building code, full name, alias, or a room-like value such as MN 3120.
        </span>

        {query.trim() ? (
          <div className="mt-1.5 overflow-hidden rounded-xl border border-border bg-popover/98 p-1.5 text-popover-foreground shadow-xl backdrop-blur">
            {results.length > 0 ? (
              <ul aria-label="UTM building search results" className="max-h-64 overflow-y-auto">
                {results.map((result) => (
                  <li key={result.building.code}>
                    <button
                      type="button"
                      onClick={() => selectResult(result)}
                      data-testid="building-search-result"
                      className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                    >
                      <span className="inline-flex min-w-10 justify-center rounded-md bg-accent/12 px-2 py-1 font-mono text-xs font-bold text-accent">
                        {result.building.code}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">
                          {result.building.name}
                        </span>
                        {result.room ? (
                          <span className="block text-xs text-muted-foreground">
                            Room {result.room}
                            {result.floor
                              ? ` · Floor ${result.floor} ${floorStatusLabel(result)}`
                              : ""}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-3 py-3 text-sm text-muted-foreground" role="status">
                No mapped UTM building matches that search.
              </p>
            )}
          </div>
        ) : null}
      </div>

      {details ? (
        <section
          className="campus-building-card absolute left-3 top-[4.75rem] z-10 max-h-[calc(100%-5.5rem)] w-[min(23rem,calc(100%-1.5rem))] overflow-y-auto rounded-xl border border-border bg-popover/96 p-4 text-popover-foreground shadow-xl backdrop-blur"
          aria-labelledby="selected-building-title"
          aria-live="polite"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.14em] text-accent">
                {details.building.code} · {details.building.category}
              </p>
              <h2
                id="selected-building-title"
                className="mt-1 font-display text-lg font-semibold tracking-tight"
              >
                {details.building.name}
              </h2>
            </div>
            <button
              type="button"
              onClick={clearSelection}
              aria-label={`Close ${details.building.name} details`}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {roomResult?.building.code === details.building.code && roomResult.room ? (
            <div className="mt-3 rounded-lg border border-accent/25 bg-accent/8 p-3 text-xs leading-5">
              <p className="font-semibold">
                {details.building.code} {roomResult.room}
                {roomResult.floor ? ` · Floor ${roomResult.floor}` : ""}
              </p>
              <p className="mt-0.5 text-muted-foreground">
                {roomResult.floorVerification === "verified"
                  ? "The floor is backed by verified room metadata. "
                  : roomResult.floorVerification === "inferred"
                    ? "The floor is inferred from the building's room-numbering rule. "
                    : ""}
                Exact indoor room routing is not mapped.
              </p>
            </div>
          ) : null}

          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg border border-border bg-background/50 p-2.5">
              <dt className="flex items-center gap-1.5 text-muted-foreground">
                <DoorOpen className="h-3.5 w-3.5" aria-hidden="true" /> Entrances
              </dt>
              <dd className="mt-1 font-semibold">{details.campus.entrances.length} mapped</dd>
            </div>
            <div className="rounded-lg border border-border bg-background/50 p-2.5">
              <dt className="flex items-center gap-1.5 text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Confidence
              </dt>
              <dd className="mt-1 font-semibold">
                {confidenceLabel(details.verifiedEntrances, details.inferredApproaches)}
              </dd>
            </div>
          </dl>

          <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
            <span>
              {verificationLabel(details.verifiedEntrances, details.inferredApproaches)}. Indoor
              room paths are not currently mapped.
            </span>
          </p>

          <ul className="mt-3 space-y-2 border-t border-border pt-3 text-xs">
            {details.campus.entrances.map((entrance) => (
              <li key={entrance.id}>
                <p className="font-semibold">{entrance.label}</p>
                <p className="text-muted-foreground">
                  {entrance.kind === "entrance" ? "Mapped entrance" : "Mapped approach"} ·{" "}
                  {entrance.accessibility === "accessible"
                    ? "Accessibility marked accessible"
                    : entrance.accessibility === "not_accessible"
                      ? "Marked not accessible"
                      : "Accessibility unknown"}
                </p>
                {entrance.notes ? (
                  <p className="mt-0.5 leading-5 text-muted-foreground">{entrance.notes}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
