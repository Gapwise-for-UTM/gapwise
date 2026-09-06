import { BookOpen, CalendarDays, Clock3, MapPin, Navigation } from "lucide-react";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getCampusLocationDisplay } from "@/features/routing/location-presentation";
import {
  firstOccurrenceForMeeting,
  lastOccurrenceForMeeting,
  nextOccurrenceForMeeting,
  termStatus,
} from "@/lib/calendar-awareness";
import type { ActivityType, Gap, Meeting } from "@/lib/timetable-types";
import {
  formatCompactDuration,
  formatTime,
  isAssessmentWindow,
  locationLabel,
  meetingLocationType,
  termForMonth,
  visibleWeekdaysForMeetings,
  weekdayForDate,
} from "@/lib/timetable-types";
import {
  buildTimetableModel,
  buildTimetableScale,
  isCompactMeetingCard,
} from "@/lib/timetable-layout";
import "./assessment-window.css";

const FULL_HOUR_HEIGHT = 66;
const COMPACT_HOUR_HEIGHT = 26;

type TimetableActivityLabel = ActivityType | "RES";

const ACTIVITY_LABELS: Record<TimetableActivityLabel, string> = {
  LEC: "Lecture",
  TUT: "Tutorial",
  PRA: "Practical",
  RES: "Reserved",
  OTHER: "Other",
};

function displayActivityType(meeting: Meeting): TimetableActivityLabel {
  return isAssessmentWindow(meeting) ? "RES" : meeting.activityType;
}

export function ActivityBadge({ type }: { type: TimetableActivityLabel }) {
  return (
    <span
      data-activity={type}
      className="activity-badge rounded-md px-1.5 py-0.5 text-[0.68rem] font-bold tracking-[0.08em]"
    >
      {type}
    </span>
  );
}

function CalendarLegend({
  activityTypes,
  gapCount,
}: {
  activityTypes: TimetableActivityLabel[];
  gapCount: number;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5"
      role="group"
      aria-label="Timetable legend"
    >
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
      {gapCount > 0 ? (
        <span className="gap-legend">
          {gapCount} detected {gapCount === 1 ? "gap" : "gaps"}
        </span>
      ) : null}
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
  const isStudy = meeting.sectionCode === "STUDY";
  const reserved = isAssessmentWindow(meeting);
  const activityType = displayActivityType(meeting);
  const accessibleDescription = reserved ? "reserved assessment window" : meeting.courseName;

  return (
    <div
      role="button"
      onClick={() => onSelect(meeting)}
      tabIndex={0}
      aria-haspopup="dialog"
      aria-label={`View details for ${meeting.courseCode}, ${accessibleDescription}`}
      title={`${meeting.courseCode} · ${reserved ? "Reserved assessment window" : meeting.courseName}`}
      data-activity={activityType}
      data-assessment-window={reserved ? "true" : undefined}
      data-planned-work={isStudy ? "true" : undefined}
      style={meeting.color ? ({ "--meeting-accent": meeting.color } as CSSProperties) : undefined}
      className={`meeting-card group relative flex h-full w-full touch-manipulation flex-col items-stretch justify-start overflow-hidden rounded-lg px-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-0 active:scale-[0.99] ${
        compact ? "py-1.5" : "py-2"
      }`}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        {isStudy ? (
          <BookOpen className="card-pin h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
        ) : reserved ? (
          <Clock3 className="card-pin h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        ) : (
          <MapPin
            className="card-pin h-3.5 w-3.5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        )}
        <span className="truncate text-xs font-extrabold tracking-[-0.01em] text-foreground">
          {meeting.courseCode}
        </span>
        {isStudy ? (
          <span className="activity-badge rounded-md px-1.5 py-0.5 text-[0.6rem] font-bold">
            STUDY
          </span>
        ) : (
          <ActivityBadge type={activityType} />
        )}
      </div>
      <p
        className={`truncate text-[0.7rem] font-medium tabular-nums text-muted-foreground ${
          compact ? "" : "mt-0.5"
        }`}
      >
        {formatTime(meeting.startTime)} – {formatTime(meeting.endTime)}
      </p>
      <p className="truncate text-[0.7rem] font-semibold text-foreground">
        {isStudy ? meeting.notes : reserved ? "Reserved assessment window" : locationLabel(meeting)}
      </p>
      {!compact ? (
        <p
          className={`mt-0.5 line-clamp-2 text-[0.7rem] leading-[1.25] ${
            reserved ? "reserved-window-note" : "text-muted-foreground"
          }`}
        >
          {reserved ? "Only active when announced" : meeting.courseName}
        </p>
      ) : null}
    </div>
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
  const reserved = meeting ? isAssessmentWindow(meeting) : false;
  const dateFormat = new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric" });
  const dateRange = first
    ? last
      ? `${dateFormat.format(first)} – ${dateFormat.format(last)}`
      : `From ${dateFormat.format(first)}`
    : "Dates unavailable";
  const canRoute =
    meeting !== null &&
    !reserved &&
    meetingLocationType(meeting) === "physical" &&
    Boolean(meeting.buildingCode) &&
    Boolean(onRoute);
  const location = meeting && !reserved ? getCampusLocationDisplay(meeting) : null;

  return (
    <Dialog open={meeting !== null} onOpenChange={(open) => !open && onClose()}>
      {meeting ? (
        <DialogContent className="glass-panel max-h-[85vh] overflow-y-auto bg-card/75 sm:max-w-md">
          <DialogHeader className="pr-8">
            <div className="flex flex-wrap items-center gap-2">
              <DialogTitle>{meeting.courseCode}</DialogTitle>
              <ActivityBadge type={displayActivityType(meeting)} />
              {meeting.sectionCode ? (
                <span className="text-xs font-medium text-muted-foreground">
                  {meeting.sectionCode}
                </span>
              ) : null}
            </div>
            <DialogDescription className="text-left text-sm leading-relaxed">
              {reserved
                ? `Reserved assessment window · ${meeting.courseName || meeting.courseCode}`
                : meeting.courseName || "Course name unavailable"}
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
              <dd className="mt-2">
                <span className="block text-base font-semibold leading-tight text-foreground">
                  {reserved
                    ? "To be announced if this window is used"
                    : (location?.buildingName ?? locationLabel(meeting))}
                </span>
                {!reserved && location && (location.floorLabel || location.roomLabel) ? (
                  <span className="mt-1 block text-sm font-medium text-muted-foreground">
                    {[location.floorLabel, location.roomLabel].filter(Boolean).join(" · ")}
                  </span>
                ) : null}
              </dd>
            </div>
            <div className="rounded-lg border border-border bg-background/40 p-3 sm:col-span-2">
              <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                Component
              </dt>
              <dd className="mt-1 text-sm font-medium text-foreground">
                {reserved ? "RES" : meeting.activityType}
                {meeting.sectionCode ? ` · ${meeting.sectionCode}` : ""}
              </dd>
            </div>
          </dl>

          {reserved ? (
            <div className="rounded-lg border border-border bg-background/40 p-3 text-sm">
              <p className="font-medium text-foreground">Not a weekly class</p>
              <p className="mt-1 leading-relaxed text-muted-foreground">
                ACORN reserves this recurring window for possible assessments. It only becomes a
                real commitment when your course announces an assessment for a specific date.
              </p>
            </div>
          ) : (
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
          )}

          {canRoute ? (
            <button
              type="button"
              onClick={() => {
                onRoute?.(meeting);
                onClose();
              }}
              className="button-primary inline-flex w-full items-center justify-center gap-2 px-4 py-2 text-sm font-semibold"
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
  gaps,
  onRouteToMeeting,
  onOpenGap,
  headerAction,
}: {
  meetings: Meeting[];
  gaps: Gap[];
  onRouteToMeeting?: (meeting: Meeting) => void;
  onOpenGap?: (gap: Gap) => void;
  headerAction?: ReactNode;
}) {
  const visibleDays = useMemo(() => visibleWeekdaysForMeetings(meetings), [meetings]);
  const { startHour, hours, days } = useMemo(
    () => buildTimetableModel(meetings, visibleDays),
    [meetings, visibleDays],
  );
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [compactHours, setCompactHours] = useState(true);
  const now = useCurrentTime();
  const scale = useMemo(
    () => buildTimetableScale(hours, meetings, compactHours, FULL_HOUR_HEIGHT, COMPACT_HOUR_HEIGHT),
    [compactHours, hours, meetings],
  );

  const currentDay = now ? weekdayForDate(now) : null;
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
      (["LEC", "TUT", "PRA", "RES", "OTHER"] as const).filter((type) =>
        meetings.some((meeting) => displayActivityType(meeting) === type),
      ),
    [meetings],
  );
  const gapsByDay = useMemo(
    () => new Map(visibleDays.map((day) => [day, gaps.filter((gap) => gap.weekday === day)])),
    [gaps, visibleDays],
  );

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 px-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="timetable-toolbar-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <p className="font-display text-base font-semibold tracking-tight text-foreground">
              Week at a glance
            </p>
            <p className="text-xs text-muted-foreground">
              Classes stay solid; reserved windows are amber; usable gaps glow in blue
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {headerAction}
          <CalendarLegend activityTypes={visibleActivityTypes} gapCount={gaps.length} />
          {scale.compactableHours.size > 0 ? (
            <button
              type="button"
              aria-pressed={compactHours}
              onClick={() => setCompactHours((current) => !current)}
              className="button-secondary hidden min-w-36 items-center justify-center px-2.5 py-1 text-center text-xs font-semibold text-muted-foreground md:inline-flex"
            >
              {compactHours ? "Full spacing" : "Compact empty time"}
            </button>
          ) : null}
        </div>
      </div>

      {/* Desktop grid */}
      <div className="hidden md:block">
        <div className="timetable-shell surface overflow-hidden bg-card">
          <div
            className="timetable-day-header grid border-b border-border"
            style={{ gridTemplateColumns: `4.5rem repeat(${visibleDays.length}, minmax(0, 1fr))` }}
          >
            <div className="flex items-center px-2.5 py-3 text-xs font-semibold text-muted-foreground">
              Time
            </div>
            {visibleDays.map((day) => {
              const dayMeetings = days.get(day)!.sorted;
              const reservedCount = dayMeetings.filter(isAssessmentWindow).length;
              const meetingCount = dayMeetings.length - reservedCount;
              const isToday = termIsCurrent && day === currentDay;
              return (
                <div
                  key={day}
                  className={`flex min-w-0 items-center justify-between gap-1 border-l border-border px-2.5 py-3.5 ${isToday ? "bg-accent/8" : ""}`}
                >
                  <span className="truncate text-xs font-bold text-foreground">{day}</span>
                  <div className="flex shrink-0 items-center gap-1">
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[0.6rem] font-semibold ${
                        isToday
                          ? "bg-accent text-accent-foreground"
                          : "bg-background/65 text-muted-foreground"
                      }`}
                    >
                      {isToday ? "Today" : meetingCount}
                    </span>
                    {reservedCount > 0 ? (
                      <span className="reserved-count-pill inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[0.58rem] font-bold tracking-[0.04em]">
                        <Clock3 className="h-2.5 w-2.5" aria-hidden="true" />
                        {reservedCount} RES
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
          <div
            className="grid"
            style={{ gridTemplateColumns: `4.5rem repeat(${visibleDays.length}, minmax(0, 1fr))` }}
          >
            <div className="relative bg-secondary/14">
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
            {visibleDays.map((day) => {
              const { laneCount, placement, sorted } = days.get(day)!;
              return (
                <div
                  key={day}
                  data-weekday={day}
                  className={`weekday-column relative border-l border-border ${
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

                  {gapsByDay.get(day)?.map((gap) => {
                    const top = scale.minuteToTop(gap.startTime);
                    const height = Math.max(
                      12,
                      scale.minuteToTop(gap.endTime) - scale.minuteToTop(gap.startTime),
                    );
                    return (
                      <button
                        key={gap.id}
                        type="button"
                        className="gap-window"
                        data-testid="gap-window"
                        data-gap-interactive="true"
                        data-gap-id={gap.id}
                        aria-label={`${formatCompactDuration(gap.durationMinutes)} gap, ${formatTime(gap.startTime)} to ${formatTime(gap.endTime)}. Open gap plan.`}
                        style={{ top, height }}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={() => onOpenGap?.(gap)}
                      >
                        {height >= 28 ? (
                          <span className="gap-window-label">
                            {formatCompactDuration(gap.durationMinutes)} gap
                          </span>
                        ) : null}
                      </button>
                    );
                  })}

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
                        data-meeting-id={meeting.id}
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
        {visibleDays.map((day) => {
          const dayMeetings = days.get(day)!.sorted;
          const reservedCount = dayMeetings.filter(isAssessmentWindow).length;
          const classCount = dayMeetings.length - reservedCount;
          return (
            <section
              key={day}
              className="surface overflow-hidden p-0"
              aria-labelledby={`day-${day}`}
            >
              <div className="flex items-center justify-between border-b border-border bg-secondary/30 px-4 py-3">
                <h3 id={`day-${day}`} className="text-sm font-medium">
                  {day}
                </h3>
                <div className="flex items-center gap-1.5">
                  <span className="rounded-full bg-background/70 px-2 py-0.5 text-[0.65rem] font-semibold text-muted-foreground">
                    {classCount} {classCount === 1 ? "class" : "classes"}
                  </span>
                  {reservedCount > 0 ? (
                    <span className="reserved-count-pill inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.62rem] font-bold tracking-[0.04em]">
                      <Clock3 className="h-3 w-3" aria-hidden="true" />
                      {reservedCount} RES
                    </span>
                  ) : null}
                </div>
              </div>
              {dayMeetings.length === 0 ? (
                <p className="px-4 py-4 text-sm text-muted-foreground">No classes scheduled.</p>
              ) : (
                <ul className="space-y-2.5 p-3">
                  {dayMeetings.map((meeting) => {
                    const reserved = isAssessmentWindow(meeting);
                    const activityType = displayActivityType(meeting);
                    return (
                      <li key={meeting.id}>
                        <button
                          type="button"
                          onClick={() => selectMeeting(meeting)}
                          aria-haspopup="dialog"
                          aria-label={`View details for ${meeting.courseCode}, ${
                            reserved ? "reserved assessment window" : meeting.courseName
                          }`}
                          data-activity={activityType}
                          data-assessment-window={reserved ? "true" : undefined}
                          className="meeting-card group w-full touch-manipulation rounded-xl p-3.5 text-left focus-visible:outline-none active:translate-y-0 active:scale-[0.99]"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            {reserved ? (
                              <Clock3 className="card-pin h-4 w-4 shrink-0" aria-hidden="true" />
                            ) : (
                              <MapPin
                                className="card-pin h-4 w-4 shrink-0 text-muted-foreground"
                                aria-hidden="true"
                              />
                            )}
                            <span className="text-sm font-extrabold tracking-[-0.01em] text-foreground">
                              {meeting.courseCode}
                            </span>
                            <ActivityBadge type={activityType} />
                            {!reserved ? (
                              <span className="text-xs text-muted-foreground">
                                {meeting.sectionCode}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1.5 text-sm font-medium tabular-nums text-foreground">
                            {formatTime(meeting.startTime)} – {formatTime(meeting.endTime)}
                          </p>
                          <p className="mt-0.5 text-sm leading-snug text-muted-foreground">
                            {reserved
                              ? `Reserved assessment window · Only active when announced`
                              : `${locationLabel(meeting)} · ${meeting.courseName}`}
                          </p>
                        </button>
                      </li>
                    );
                  })}
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
