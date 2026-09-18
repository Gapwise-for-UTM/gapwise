import { Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CampusMap, type CampusMapProps, type MapFocusPadding } from "./CampusMap";
import {
  getBuildingExplorerDetails,
  searchCampusBuildings,
  type BuildingSearchResult,
} from "@/features/routing/building-explorer";
import { getCampusLocationDisplay } from "@/features/routing/location-presentation";
import {
  CAMPUS_SHORT_LABELS,
  gapwiseCampusIdForCampus,
  type GapwiseCampusId,
} from "@/data/campuses";
import { formatTime, locationLabel, meetingCampus } from "@/lib/timetable-types";

type CampusExplorerProps = Omit<CampusMapProps, "selectedBuildingCode" | "onSelectBuilding"> & {
  selectedBuildingCode: string | null;
  onSelectBuilding: (code: string | null) => void;
};

const CAMPUS_IDS: GapwiseCampusId[] = ["utm", "utsg", "utsc"];

function meetingGapwiseCampus(meeting: CampusMapProps["meetings"][number]): GapwiseCampusId | null {
  return gapwiseCampusIdForCampus(meetingCampus(meeting));
}

function inferredCampusForMeetings(
  meetings: CampusMapProps["meetings"],
): GapwiseCampusId {
  const counts = new Map<GapwiseCampusId, number>(CAMPUS_IDS.map((campus) => [campus, 0]));
  for (const meeting of meetings) {
    const campus = meetingGapwiseCampus(meeting);
    if (campus) counts.set(campus, (counts.get(campus) ?? 0) + 1);
  }
  return [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || CAMPUS_IDS.indexOf(a[0]) - CAMPUS_IDS.indexOf(b[0]),
  )[0]?.[0] ?? "utm";
}

function floorStatusLabel(result: BuildingSearchResult) {
  if (result.floorVerification === "verified") return "verified";
  if (result.floorVerification === "inferred") return "inferred";
  return "floor status unknown";
}

export function CampusExplorer({
  selectedBuildingCode,
  onSelectBuilding,
  onSelectMeeting,
  ...mapProps
}: CampusExplorerProps) {
  const [query, setQuery] = useState("");
  const [campusOverride, setCampusOverride] = useState<GapwiseCampusId | null>(null);
  const [activeEntranceId, setActiveEntranceId] = useState<string | null>(null);
  const [mapDetailMeetingId, setMapDetailMeetingId] = useState<string | null>(null);
  const [focusPadding, setFocusPadding] = useState<MapFocusPadding>({
    top: 76,
    right: 24,
    bottom: 24,
    left: 24,
  });
  const explorerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const selectedMeeting = useMemo(
    () => mapProps.meetings.find((meeting) => meeting.id === mapProps.selectedMeetingId) ?? null,
    [mapProps.meetings, mapProps.selectedMeetingId],
  );
  const selectedMeetingCampus = selectedMeeting ? meetingGapwiseCampus(selectedMeeting) : null;
  const inferredCampusId = useMemo(
    () => inferredCampusForMeetings(mapProps.meetings),
    [mapProps.meetings],
  );
  const activeCampusId = campusOverride ?? selectedMeetingCampus ?? inferredCampusId;
  const activeMeetings = useMemo(
    () =>
      mapProps.meetings.filter(
        (meeting) => meetingGapwiseCampus(meeting) === activeCampusId,
      ),
    [activeCampusId, mapProps.meetings],
  );
  // UTSG/UTSC building maps are live before their pedestrian graphs are promoted
  // into the product route engine. Never reinterpret external-campus segments as UTM routes.
  const activeSegments = activeCampusId === "utm" ? mapProps.segments : [];

  const routeContentKey = useMemo(
    () =>
      activeMeetings
        .map((meeting) => `${meeting.term}:${meeting.weekday}:${meeting.id}`)
        .sort()
        .join("|"),
    [activeMeetings],
  );
  const previousRouteContentKeyRef = useRef(routeContentKey);
  const results = useMemo(
    () => searchCampusBuildings(query, 6, activeCampusId),
    [activeCampusId, query],
  );
  const details = useMemo(
    () => getBuildingExplorerDetails(selectedBuildingCode, activeCampusId),
    [activeCampusId, selectedBuildingCode],
  );
  const mapDetailMeeting = useMemo(
    () => mapProps.meetings.find((meeting) => meeting.id === mapDetailMeetingId) ?? null,
    [mapDetailMeetingId, mapProps.meetings],
  );
  const selectMeetingFromMap = useCallback(
    (id: string) => {
      setMapDetailMeetingId(id);
      onSelectBuilding(null);
      onSelectMeeting(id);
    },
    [onSelectBuilding, onSelectMeeting],
  );

  useEffect(() => {
    setActiveEntranceId(null);
  }, [selectedBuildingCode]);

  useEffect(() => {
    setCampusOverride(null);
  }, [mapProps.selectedMeetingId]);

  useEffect(() => {
    if (mapDetailMeetingId && !mapDetailMeeting) setMapDetailMeetingId(null);
  }, [mapDetailMeeting, mapDetailMeetingId]);

  useEffect(() => {
    const previousKey = previousRouteContentKeyRef.current;
    previousRouteContentKeyRef.current = routeContentKey;
    if (previousKey === routeContentKey) return;

    let firstFrame = 0;
    let secondFrame = 0;
    firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        const explorer = explorerRef.current;
        if (!explorer) return;
        const fitControl = explorer.querySelector<HTMLButtonElement>(
          'button[aria-label="Fit the active day route"], button[aria-label="Return to campus overview"]',
        );
        fitControl?.click();
      });
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
    };
  }, [routeContentKey]);

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
    return () => observer.disconnect();
  }, [details]);

  function selectResult(result: BuildingSearchResult) {
    setQuery("");
    setMapDetailMeetingId(null);
    onSelectBuilding(result.building.code);
  }

  function selectFromMap(code: string) {
    setMapDetailMeetingId(null);
    onSelectBuilding(code);
  }

  function clearSelection() {
    setQuery("");
    onSelectBuilding(null);
  }

  const mapDetailLocation = mapDetailMeeting ? getCampusLocationDisplay(mapDetailMeeting) : null;

  return (
    <div ref={explorerRef} className="campus-explorer relative">
      <CampusMap
        {...mapProps}
        campusId={activeCampusId}
        meetings={activeMeetings}
        segments={activeSegments}
        dayAnchor={activeCampusId === "utm" ? mapProps.dayAnchor : null}
        onSelectMeeting={selectMeetingFromMap}
        selectedBuildingCode={selectedBuildingCode}
        onSelectBuilding={selectFromMap}
        activeEntranceId={activeEntranceId}
        onActiveEntranceChange={setActiveEntranceId}
        focusPadding={focusPadding}
      />

      {mapDetailMeeting ? (
        <section
          data-testid="map-meeting-details"
          data-activity={mapDetailMeeting.activityType}
          className="absolute bottom-3 left-3 z-20 w-[min(19rem,calc(100%-1.5rem))] rounded-xl border border-border bg-popover/96 p-4 text-popover-foreground shadow-xl backdrop-blur"
          role="region"
          aria-label={`Timetable details for ${mapDetailMeeting.courseCode}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-display text-base font-semibold tracking-tight">
                  {mapDetailMeeting.courseCode}
                </p>
                <span
                  data-activity={mapDetailMeeting.activityType}
                  className="activity-badge rounded-md px-1.5 py-0.5 text-[0.65rem] font-bold tracking-[0.08em]"
                >
                  {mapDetailMeeting.activityType}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                {mapDetailMeeting.courseName || "Course name unavailable"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMapDetailMeetingId(null)}
              aria-label="Close class details"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <dl className="mt-3 grid gap-2 text-xs">
            <div className="grid grid-cols-[4.25rem_minmax(0,1fr)] gap-2">
              <dt className="font-mono font-semibold uppercase tracking-wide text-muted-foreground">
                Time
              </dt>
              <dd className="font-semibold tabular-nums">
                {formatTime(mapDetailMeeting.startTime)} – {formatTime(mapDetailMeeting.endTime)}
              </dd>
            </div>
            <div className="grid grid-cols-[4.25rem_minmax(0,1fr)] gap-2">
              <dt className="font-mono font-semibold uppercase tracking-wide text-muted-foreground">
                Location
              </dt>
              <dd>
                <span className="block font-semibold leading-tight">
                  {mapDetailLocation?.buildingName ?? locationLabel(mapDetailMeeting)}
                </span>
                {mapDetailLocation &&
                (mapDetailLocation.floorLabel || mapDetailLocation.roomLabel) ? (
                  <span className="mt-1 block font-medium leading-5 text-muted-foreground">
                    {[mapDetailLocation.floorLabel, mapDetailLocation.roomLabel]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                ) : null}
              </dd>
            </div>
            <div className="grid grid-cols-[4.25rem_minmax(0,1fr)] gap-2">
              <dt className="font-mono font-semibold uppercase tracking-wide text-muted-foreground">
                Component
              </dt>
              <dd className="font-semibold">
                {mapDetailMeeting.activityType}
                {mapDetailMeeting.sectionCode ? ` · ${mapDetailMeeting.sectionCode}` : ""}
              </dd>
            </div>
            <div className="grid grid-cols-[4.25rem_minmax(0,1fr)] gap-2">
              <dt className="font-mono font-semibold uppercase tracking-wide text-muted-foreground">
                Day
              </dt>
              <dd className="font-semibold">
                {mapDetailMeeting.weekday} · {mapDetailMeeting.term}
              </dd>
            </div>
          </dl>
        </section>
      ) : null}

      <div
        ref={searchRef}
        className="campus-explorer-search absolute left-3 top-3 z-20 w-[min(22rem,calc(100%-5.75rem))]"
      >
        <div
          className="mb-2 grid grid-cols-3 gap-1 rounded-xl border border-border bg-popover/96 p-1 shadow-lg backdrop-blur"
          aria-label="Campus map"
        >
          {CAMPUS_IDS.map((campus) => (
            <button
              key={campus}
              type="button"
              onClick={() => {
                setCampusOverride(campus);
                setMapDetailMeetingId(null);
                setQuery("");
                onSelectBuilding(null);
              }}
              aria-pressed={activeCampusId === campus}
              className={`min-h-9 rounded-lg px-2 font-mono text-[0.7rem] font-bold tracking-[0.08em] transition-colors ${
                activeCampusId === campus
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              {CAMPUS_SHORT_LABELS[campus]}
            </button>
          ))}
        </div>
        <label htmlFor="campus-building-search" className="sr-only">
          Search {CAMPUS_SHORT_LABELS[activeCampusId]} buildings
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
            placeholder={
              activeCampusId === "utm"
                ? "Search MN, Deerfield, Kaneff…"
                : activeCampusId === "utsg"
                  ? "Search BA, Bahen, Sidney Smith…"
                  : "Search AA, Highland, Kina Wiya…"
            }
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
              <ul
                aria-label={`${CAMPUS_SHORT_LABELS[activeCampusId]} building search results`}
                className="max-h-64 overflow-y-auto"
              >
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
                No mapped {CAMPUS_SHORT_LABELS[activeCampusId]} building matches that search.
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
          className="campus-building-card absolute bottom-3 left-3 right-3 z-10 max-h-[46%] overflow-y-auto rounded-xl border border-border bg-popover/96 p-4 text-popover-foreground shadow-xl backdrop-blur sm:bottom-auto sm:right-auto sm:top-[8rem] sm:max-h-[calc(100%-8.75rem)] sm:w-[min(23rem,calc(100%-1.5rem))]"
          aria-labelledby="selected-building-title"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.14em] text-accent">
                {details.building.code}
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
        </section>
      ) : null}
    </div>
  );
}
