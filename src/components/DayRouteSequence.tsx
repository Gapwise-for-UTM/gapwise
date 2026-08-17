import {
  BusFront,
  CarFront,
  ChevronRight,
  Home,
  MapPin,
  type LucideIcon,
} from "lucide-react";
import { campusDayAnchorPresentation } from "@/features/routing/campus-day";
import { getLocationPresentation } from "@/features/routing/location-presentation";
import type { TransitionRoute } from "@/features/routing/types";
import type { Meeting } from "@/lib/timetable-types";
import { formatDuration, formatTime } from "@/lib/timetable-types";
import "./day-route-map.css";

export type DayRouteSequenceSegment = {
  id: string;
  from: Meeting;
  to: Meeting;
  route: TransitionRoute;
};

function anchorIcon(kind: "residence" | "transit" | "parking" | "pickup"): LucideIcon {
  if (kind === "residence") return Home;
  if (kind === "transit") return BusFront;
  if (kind === "parking") return CarFront;
  return MapPin;
}

function segmentDurationLabel(segment: DayRouteSequenceSegment) {
  const seconds = segment.route.result?.estimatedSeconds ?? segment.route.approximateSeconds;
  return seconds === null ? null : formatDuration(Math.max(1, Math.ceil(seconds / 60)));
}

export function DayRouteSequence({
  routeStops,
  segments,
  selectedMeetingId,
  selectedSegmentId,
  onSelectMeeting,
  onSelectSegment,
}: {
  routeStops: Meeting[];
  segments: DayRouteSequenceSegment[];
  selectedMeetingId: string | null;
  selectedSegmentId: string | null;
  onSelectMeeting: (id: string) => void;
  onSelectSegment: (id: string) => void;
}) {
  if (routeStops.length === 0) return null;

  return (
    <section className="day-route-sequence" aria-labelledby="day-route-sequence-title">
      <div className="flex items-center justify-between gap-4 px-1">
        <div>
          <p id="day-route-sequence-title" className="eyebrow text-accent">
            Day order
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Times on the map match this left-to-right sequence.
          </p>
        </div>
      </div>

      <div
        className="mt-3 flex snap-x snap-mandatory items-stretch gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Classes and transitions in chronological order"
      >
        {routeStops.map((meeting, index) => {
          const anchor = campusDayAnchorPresentation(meeting);
          const location = getLocationPresentation({ meeting });
          const before = index > 0 ? (segments[index - 1] ?? null) : null;
          const after = segments[index] ?? null;
          const anchorSegment = index === 0 ? after : before;
          const selected = anchor
            ? Boolean(anchorSegment && selectedSegmentId === anchorSegment.id)
            : selectedMeetingId === meeting.id;
          const AnchorIcon = anchor ? anchorIcon(anchor.kind) : null;
          const duration = after ? segmentDurationLabel(after) : null;
          const segmentPresentation = after
            ? getLocationPresentation({ from: after.from, to: after.to, route: after.route })
            : null;
          const selectStop = () => {
            if (anchor) {
              if (anchorSegment) onSelectSegment(anchorSegment.id);
              return;
            }
            onSelectMeeting(meeting.id);
          };

          return (
            <div key={meeting.id} className="flex shrink-0 snap-start items-stretch gap-2">
              <button
                type="button"
                onClick={selectStop}
                aria-pressed={selected}
                className={`day-route-stop-card min-w-[9.75rem] rounded-xl border px-3 py-2.5 text-left transition-colors ${
                  selected
                    ? "border-accent/60 bg-accent/10"
                    : "border-border bg-card/76 hover:border-accent/35 hover:bg-secondary/70"
                }`}
              >
                {anchor && AnchorIcon ? (
                  <>
                    <span className="flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-accent">
                      <AnchorIcon className="h-3.5 w-3.5" aria-hidden="true" />
                      {index === 0 ? "Start" : "End"}
                    </span>
                    <span className="mt-1.5 block text-sm font-semibold">{anchor.title}</span>
                    <span className="mt-0.5 block max-w-[13rem] truncate text-xs text-muted-foreground">
                      {anchor.label}
                    </span>
                  </>
                ) : (
                  <>
                    <time className="block font-mono text-sm font-bold tabular-nums text-accent">
                      {formatTime(meeting.startTime)}
                    </time>
                    <span className="mt-1 block text-sm font-semibold">
                      {meeting.courseCode} {meeting.activityType}
                    </span>
                    <span className="mt-0.5 block max-w-[13rem] truncate text-xs text-muted-foreground">
                      {location.label}
                    </span>
                  </>
                )}
              </button>

              {after ? (
                <button
                  type="button"
                  onClick={() => onSelectSegment(after.id)}
                  aria-label={`Select transition from ${anchor?.title ?? meeting.courseCode} to ${campusDayAnchorPresentation(after.to)?.title ?? after.to.courseCode}. ${segmentPresentation?.label ?? ""}`}
                  aria-pressed={selectedSegmentId === after.id}
                  className={`day-route-transition inline-flex min-w-14 flex-col items-center justify-center rounded-xl border px-2 text-center text-[0.65rem] font-semibold transition-colors ${
                    selectedSegmentId === after.id
                      ? "border-accent/55 bg-accent/10 text-accent"
                      : "border-border/70 bg-background/45 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  <span className="mt-1 whitespace-nowrap">
                    {duration ?? segmentPresentation?.label ?? "Route"}
                  </span>
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
