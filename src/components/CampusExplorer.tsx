import { DoorOpen, MapPin, Search, ShieldCheck, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CampusMap, type CampusMapProps, type MapFocusPadding } from "./CampusMap";
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
  const [activeEntranceId, setActiveEntranceId] = useState<string | null>(null);
  const [focusPadding, setFocusPadding] = useState<MapFocusPadding>({
    top: 76,
    right: 24,
    bottom: 24,
    left: 24,
  });
  const explorerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const results = useMemo(() => searchCampusBuildings(query), [query]);
  const details = useMemo(
    () => getBuildingExplorerDetails(selectedBuildingCode),
    [selectedBuildingCode],
  );

  useEffect(() => {
    setActiveEntranceId(null);
  }, [selectedBuildingCode]);

  useEffect(() => {
    const explorer = explorerRef.current;
    if (!explorer) return;
    const update = () => {
      const bounds = explorer.getBoundingClientRect();
      const searchBounds = searchRef.current?.getBoundingClientRect();
      const cardBounds = cardRef.current?.getBoundingClientRect();
      const narrow = bounds.width < 640;
      const next: MapFocusPadding = {
        top: searchBounds ? Math.max(24, searchBounds.bottom - bounds.top + 14) : 24,
        right: 24,
        bottom: 24,
        left: 24,
      };
      if (cardBounds) {
        if (narrow) next.bottom = Math.max(24, bounds.bottom - cardBounds.top + 14);
        else next.left = Math.max(24, cardBounds.right - bounds.left + 16);
      }
      setFocusPadding((current) =>
        current.top === next.top &&
        current.right === next.right &&
        current.bottom === next.bottom &&
        current.left === next.left
          ? current
          : next,
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(explorer);
    if (searchRef.current) observer.observe(searchRef.current);
    if (cardRef.current) observer.observe(cardRef.current);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [details]);

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
    <div ref={explorerRef} className="campus-explorer relative">
      <CampusMap
        {...mapProps}
        selectedBuildingCode={selectedBuildingCode}
        onSelectBuilding={selectFromMap}
        activeEntranceId={activeEntranceId}
        onActiveEntranceChange={setActiveEntranceId}
        focusPadding={focusPadding}
      />

      <div
        ref={searchRef}
        className="campus-explorer-search absolute left-3 top-3 z-20 w-[min(22rem,calc(100%-5.75rem))]"
      >
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

      <p className="sr-only" role="status" aria-live="polite">
        {details ? `${details.building.code} ${details.building.name} selected` : ""}
      </p>

      {details ? (
        <section
          ref={cardRef}
          className="campus-building-card absolute bottom-3 left-3 right-3 z-10 max-h-[46%] overflow-y-auto rounded-xl border border-border bg-popover/96 p-4 text-popover-foreground shadow-xl backdrop-blur sm:bottom-auto sm:right-auto sm:top-[4.75rem] sm:max-h-[calc(100%-5.5rem)] sm:w-[min(23rem,calc(100%-1.5rem))]"
          aria-labelledby="selected-building-title"
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

          <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-background/50 p-2.5 text-xs">
            <DoorOpen className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
            <span className="font-semibold">
              {details.campus?.entrances.length ?? 0} mapped entrances
            </span>
            <span className="ml-auto flex items-center gap-1 text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {confidenceLabel(details.verifiedEntrances, details.inferredApproaches)}
            </span>
          </div>

          <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
            <span>
              {verificationLabel(details.verifiedEntrances, details.inferredApproaches)}. Indoor
              room paths are not currently mapped.
            </span>
          </p>

          <ul
            className="mt-3 space-y-1.5 border-t border-border pt-3 text-xs"
            aria-label="Mapped entrances"
          >
            {(details.campus?.entrances ?? []).map((entrance) => {
              const active = entrance.id === activeEntranceId;
              return (
                <li key={entrance.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setActiveEntranceId(entrance.id)}
                    onMouseLeave={() => setActiveEntranceId(null)}
                    onFocus={() => setActiveEntranceId(entrance.id)}
                    onBlur={() => setActiveEntranceId(null)}
                    onClick={() => setActiveEntranceId(entrance.id)}
                    className={`w-full rounded-lg border p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                      active
                        ? "border-accent/60 bg-accent/10"
                        : "border-transparent hover:bg-secondary"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="font-semibold">{entrance.label}</span>
                      <span className="shrink-0 text-[0.68rem] font-semibold text-muted-foreground">
                        {entrance.accessibility === "accessible"
                          ? "Accessible"
                          : entrance.accessibility === "not_accessible"
                            ? "Not accessible"
                            : "Access unknown"}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-muted-foreground">
                      {entrance.kind === "entrance" ? "Mapped entrance" : "Mapped approach"}
                      {entrance.metadata.verificationStatus === "inferred" ? " · inferred" : ""}
                    </span>
                    {entrance.notes ? (
                      <span className="mt-0.5 block leading-5 text-muted-foreground">
                        {entrance.notes}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
