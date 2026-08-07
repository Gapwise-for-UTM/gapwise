import { BookOpen, CalendarDays, Clock3, MapPin, Navigation } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  firstOccurrenceForMeeting,
  lastOccurrenceForMeeting,
  nextOccurrenceForMeeting,
  termStatus,
} from "@/lib/calendar-awareness";
import type { ActivityType, Meeting } from "@/lib/timetable-types";
import {
  formatTime,
  locationLabel,
  meetingLocationType,
  termForMonth,
  WEEKDAYS,
} from "@/lib/timetable-types";
import {
  buildTimetableModel,
  buildTimetableScale,
  isCompactMeetingCard,
} from "@/lib/timetable-layout";

const FULL_HOUR_HEIGHT = 66;
const COMPACT_HOUR_HEIGHT = 26;

const ACTIVITY_LABELS: Record<ActivityType, string> = {
  LEC: "Lecture",
  TUT: "Tutorial",
  PRA: "Practical",
  OTHER: "Other",
};

export function ActivityBadge({ type }: { type: ActivityType }) {
  return (
    <span
      data-activity={type}
      className="activity-badge rounded-md px-1.5 py-0.5 text-[0.68rem] font-bold tracking-[0.08em]"
    >
      {type}
    </span>
  );
}

function CalendarLegend({ activityTypes }: { activityTypes: ActivityType[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5" aria-label="Class components">
      {activityTypes.map((type) => (
        <span key={type} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            data-activity={type}
            className="activity-dot h-2 w-2 rounded-full"
            aria-hidden="true"
          />
          {ACTIVITY_LABELS[type]}
        </span>
      ))}
    </div>
  );
}

function useCurrentTime() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    let timer: number | undefined;

    const scheduleUpdate = () => {
      const current = new Date();
      setNow(current);

      const delayUntilNextSecond = 1_000 - current.getMilliseconds();
      timer = window.setTimeout(scheduleUpdate, delayUntilNextSecond);
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        setNow(new Date());
      }
    };

    scheduleUpdate();
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  return now;
}

function MeetingCard({
  meeting,
  compact,
  onSelect,
}: {
  meeting: Meeting;
  compact?: boolean;
  onSelect: (meeting: Meeting) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(meeting)}
      aria-haspopup="dialog"
      aria-label={`View details for ${meeting.courseCode}, ${meeting.courseName}`}
      title={`${meeting.courseCode} · ${meeting.courseName}`}
      data-activity={meeting.activityType}
      className={`meeting-card group flex h-full w-full touch-manipulation flex-col items-stretch justify-start overflow-hidden rounded-lg px-2.5 text-left focus-visible:outline-none active:translate-y-0 active:scale-[0.99] ${
        compact ? "py-1.5" : "py-2"
      }`}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="truncate text-xs font-extrabold tracking-[-0.01em] text-foreground">
          {meeting.courseCode}
        </span>
        <ActivityBadge type={meeting.activityType} />
      </div>
      <p
        className={`truncate text-[0.7rem] font-medium tabular-nums text-muted-foreground ${
          compact ? "" : "mt-0.5"
        }`}
      >
        {formatTime(meeting.startTime)} – {formatTime(meeting.endTime)}
      </p>
      <p className="truncate text-[0.7rem] font-semibold text-foreground">
        {locationLabel(meeting)}
      </p>
      {!compact ? (
        <p className="mt-0.5 line-clamp-2 text-[0.7rem] leading-[1.25] text-muted-foreground">
          {meeting.courseName}
        </p>
      ) : null}
    </button>
  );
}

function MeetingDetailsDialog({
  meeting,
  onClose,
  onRoute,
}: {
  meeting: Meeting | null;
  onClose: () => void;
  onRoute: ((meeting: Meeting) => void) | undefined;
}) {
  const first = meeting ? firstOccurrenceForMeeting(meeting) : null;
  const last = meeting ? lastOccurrenceForMeeting(meeting) : null;
  const next = meeting ? nextOccurrenceForMeeting(meeting, new Date()) : null;
  const dateFormat = new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric" });
  const dateRange = first
    ? last
      ? `${dateFormat.format(first)} – ${dateFormat.format(last)}`
      : `From ${dateFormat.format(first)}`
    : "Dates unavailable";
  const canRoute =
    meeting !== null &&
    meetingLocationType(meeting) === "physical" &&
    Boolean(meeting.buildingCode) &&
    Boolean(onRoute);

  return (
    <Dialog open={meeting !== null} onOpenChange={(open) => !open && onClose()}>
      {meeting ? (
        <DialogContent className="max-h-[85vh] overflow-y-auto border-border bg-card sm:max-w-md">
          <DialogHeader className="pr-8">
            <div className="flex flex-wrap items-center gap-2">
              <DialogTitle>{meeting.courseCode}</DialogTitle>
              <ActivityBadge type={meeting.activityType} />
              {meeting.sectionCode ? (
                <span className="text-xs font-medium text-muted-foreground">
                  {meeting.sectionCode}
                </span>
              ) : null}
            </div>
            <DialogDescription className="text-left text-sm leading-relaxed">
              {meeting.courseName || "Course name unavailable"}
            </DialogDescription>
          </DialogHeader>

          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-background/40 p-3">
              <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                Day and term
              </dt>
              <dd className="mt-1 text-sm font-medium text-foreground">
                {meeting.weekday} · {meeting.term} · {dateRange}
              </dd>
            </div>
            <div className="rounded-lg border border-border bg-background/40 p-3">
              <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                Time
              </dt>
              <dd className="mt-1 text-sm font-medium text-foreground">
                {formatTime(meeting.startTime)} – {formatTime(meeting.endTime)}
              </dd>
            </div>
            <div className="rounded-lg border border-border bg-background/40 p-3 sm:col-span-2">
              <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                Location
              </dt>
              <dd className="mt-1 text-sm font-medium text-foreground">{locationLabel(meeting)}</dd>
            </div>
            <div className="rounded-lg border border-border bg-background/40 p-3 sm:col-span-2">
              <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                Component
              </dt>
              <dd className="mt-1 text-sm font-medium text-foreground">
                {meeting.activityType}
                {meeting.sectionCode ? ` · ${meeting.sectionCode}` : ""}
              </dd>
            </div>
          </dl>

          <div className="rounded-lg border border-border bg-background/40 p-3 text-sm">
            <p className="font-medium text-foreground">Next occurrence</p>
            <p className="mt-1 text-muted-foreground">
              {next
                ? `${new Intl.DateTimeFormat("en-CA", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  }).format(next)} at ${formatTime(meeting.startTime)}`
                : "No later occurrence in this timetable"}
            </p>
          </div>

          {canRoute ? (
            <button
              type="button"
              onClick={() => {
                onRoute?.(meeting);
                onClose();
              }}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Navigation className="h-4 w-4" aria-hidden="true" />
              Route to this class
            </button>
          ) : null}

          <p className="text-xs leading-relaxed text-muted-foreground">
            This information comes from the ACORN calendar file you imported. Opening a class card
            does not contact ACORN or upload anything new.
          </p>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

export const TimetableGrid = memo(function TimetableGrid({
  meetings,
  onRouteToMeeting,
}: {
  meetings: Meeting[];
  onRouteToMeeting?: (meeting: Meeting) => void;
}) {
  const { startHour, hours, days } = useMemo(() => buildTimetableModel(meetings), [meetings]);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [compactHours, setCompactHours] = useState(true);
  const now = useCurrentTime();
  const scale = useMemo(
    () => buildTimetableScale(hours, meetings, compactHours, FULL_HOUR_HEIGHT, COMPACT_HOUR_HEIGHT),
    [compactHours, hours, meetings],
  );

  const currentDay = now ? (WEEKDAYS[now.getDay() - 1] ?? null) : null;
  const currentMinute = now ? now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60 : null;
  const selectedTerm = meetings[0]?.term ?? null;
  const selectedTermStatus =
    now && selectedTerm ? termStatus(meetings, selectedTerm, now) : "unknown";
  const termIsCurrent =
    now !== null &&
    selectedTerm !== null &&
    (selectedTermStatus === "active" ||
      (selectedTermStatus === "unknown" && termForMonth(now.getMonth() + 1) === selectedTerm));
  const gridStartMinute = startHour * 60;
  const gridEndMinute = (startHour + hours.length) * 60;
  const showCurrentTime =
    currentDay !== null &&
    currentMinute !== null &&
    termIsCurrent &&
    hours.length > 0 &&
    currentMinute >= gridStartMinute &&
    currentMinute < gridEndMinute;
  const currentTop = showCurrentTime ? scale.minuteToTop(currentMinute) : 0;
  const currentTimeLabel = currentMinute === null ? "" : formatTime(Math.floor(currentMinute));

  const selectMeeting = useCallback((meeting: Meeting) => setSelectedMeeting(meeting), []);
  const closeMeeting = useCallback(() => setSelectedMeeting(null), []);
  const visibleActivityTypes = useMemo(
    () =>
      (["LEC", "TUT", "PRA", "OTHER"] as const).filter((type) =>
        meetings.some((meeting) => meeting.activityType === type),
      ),
    [meetings],
  );

  return (
    <div>
      <div className="mb-3 flex flex-col gap-2 px-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-secondary text-accent">
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Week at a glance</p>
            <p className="text-xs text-muted-foreground">Select a class to view its details</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <CalendarLegend activityTypes={visibleActivityTypes} />
          {scale.compactableHours.size > 0 ? (
            <button
              type="button"
              aria-pressed={compactHours}
              onClick={() => setCompactHours((current) => !current)}
              className="hidden rounded-full border border-input px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:border-accent/60 hover:text-foreground md:inline-flex"
            >
              {compactHours ? "Full spacing" : "Compact empty time"}
            </button>
          ) : null}
        </div>
      </div>

      {/* Desktop grid */}
      <div className="hidden md:block">
        <div className="surface overflow-hidden bg-card">
          <div className="grid grid-cols-[4.5rem_repeat(5,1fr)] border-b border-border bg-secondary/70 shadow-[0_1px_0_color-mix(in_oklab,var(--color-border)_65%,transparent)]">
            <div className="flex items-center px-2.5 py-3 text-xs font-semibold text-muted-foreground">
              Time
            </div>
            {WEEKDAYS.map((day) => {
              const meetingCount = days.get(day)!.sorted.length;
              const isToday = termIsCurrent && day === currentDay;
              return (
                <div
                  key={day}
                  className={`flex min-w-0 items-center justify-between gap-1 border-l border-border px-2.5 py-3 ${isToday ? "bg-accent/10" : ""}`}
                >
                  <span className="truncate text-xs font-bold text-foreground">{day}</span>
                  <span
                    className={`shrink-0 rounded-full px-1.5 py-0.5 text-[0.6rem] font-semibold ${
                      isToday
                        ? "bg-accent text-accent-foreground"
                        : "bg-background/65 text-muted-foreground"
                    }`}
                  >
                    {isToday ? "Today" : meetingCount}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-[4.5rem_repeat(5,1fr)]">
            <div className="relative bg-secondary/20">
              {hours.map((hour) => (
                <div
                  key={hour}
                  style={{ height: scale.hourHeights.get(hour) }}
                  className="relative border-b border-border"
                >
                  <span className="calendar-time-label absolute right-2 top-1 z-10 rounded-sm px-0.5 text-[0.67rem] font-medium tabular-nums text-muted-foreground">
                    {formatTime(hour * 60)}
                  </span>
                </div>
              ))}

              {showCurrentTime ? (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute right-1 z-30 -translate-y-1/2 rounded-full bg-accent px-1.5 py-0.5 text-[0.625rem] font-bold tabular-nums text-accent-foreground shadow-sm"
                  style={{ top: currentTop }}
                >
                  {currentTimeLabel}
                </span>
              ) : null}
            </div>
            {WEEKDAYS.map((day) => {
              const { laneCount, placement, sorted } = days.get(day)!;
              return (
                <div
                  key={day}
                  className={`relative border-l border-border ${
                    termIsCurrent && day === currentDay ? "bg-accent/[0.035]" : ""
                  }`}
                >
                  {hours.map((hour) => (
                    <div
                      key={hour}
                      style={{ height: scale.hourHeights.get(hour) }}
                      className={
                        compactHours && scale.compactableHours.has(hour)
                          ? "border-b border-border bg-secondary/20"
                          : "calendar-hour-cell border-b border-border"
                      }
                    />
                  ))}

                  {showCurrentTime && day === currentDay ? (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 z-20 flex -translate-y-1/2 items-center"
                      style={{ top: currentTop }}
                    >
                      <span className="h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-accent shadow-sm ring-2 ring-background" />
                      <span className="-ml-1 h-0.5 flex-1 bg-accent shadow-sm" />
                    </div>
                  ) : null}

                  {sorted.map((meeting) => {
                    const lane = placement.get(meeting.id) ?? 0;
                    return (
                      <div
                        key={meeting.id}
                        className="absolute z-10 px-1 py-0.5"
                        style={{
                          top: scale.minuteToTop(meeting.startTime),
                          height:
                            scale.minuteToTop(meeting.endTime) -
                            scale.minuteToTop(meeting.startTime),
                          left: `${(lane / laneCount) * 100}%`,
                          width: `${(1 / laneCount) * 100}%`,
                        }}
                      >
                        <MeetingCard
                          meeting={meeting}
                          compact={isCompactMeetingCard(meeting, laneCount)}
                          onSelect={selectMeeting}
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mobile day list */}
      <div className="space-y-4 md:hidden">
        {WEEKDAYS.map((day) => {
          const dayMeetings = days.get(day)!.sorted;
          return (
            <section
              key={day}
              className="surface overflow-hidden p-0"
              aria-labelledby={`day-${day}`}
            >
              <div className="flex items-center justify-between border-b border-border bg-secondary/55 px-4 py-3">
                <h3 id={`day-${day}`} className="text-sm font-bold">
                  {day}
                </h3>
                <span className="rounded-full bg-background/70 px-2 py-0.5 text-[0.65rem] font-semibold text-muted-foreground">
                  {dayMeetings.length} {dayMeetings.length === 1 ? "class" : "classes"}
                </span>
              </div>
              {dayMeetings.length === 0 ? (
                <p className="px-4 py-4 text-sm text-muted-foreground">No classes scheduled.</p>
              ) : (
                <ul className="space-y-2.5 p-3">
                  {dayMeetings.map((meeting) => (
                    <li key={meeting.id}>
                      <button
                        type="button"
                        onClick={() => selectMeeting(meeting)}
                        aria-haspopup="dialog"
                        aria-label={`View details for ${meeting.courseCode}, ${meeting.courseName}`}
                        data-activity={meeting.activityType}
                        className="meeting-card w-full touch-manipulation rounded-xl p-3.5 text-left focus-visible:outline-none active:translate-y-0 active:scale-[0.99]"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-extrabold tracking-[-0.01em] text-foreground">
                            {meeting.courseCode}
                          </span>
                          <ActivityBadge type={meeting.activityType} />
                          <span className="text-xs text-muted-foreground">
                            {meeting.sectionCode}
                          </span>
                        </div>
                        <p className="mt-1.5 text-sm font-medium tabular-nums text-foreground">
                          {formatTime(meeting.startTime)} – {formatTime(meeting.endTime)}
                        </p>
                        <p className="mt-0.5 text-sm leading-snug text-muted-foreground">
                          {locationLabel(meeting)} · {meeting.courseName}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <MeetingDetailsDialog
        meeting={selectedMeeting}
        onClose={closeMeeting}
        onRoute={onRouteToMeeting}
      />
    </div>
  );
});
