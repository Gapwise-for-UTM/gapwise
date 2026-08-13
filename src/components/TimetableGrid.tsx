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
import {
  firstOccurrenceForMeeting,
  lastOccurrenceForMeeting,
  nextOccurrenceForMeeting,
  termStatus,
} from "@/lib/calendar-awareness";
import { detectConflicts, moveItem, resizeItem, snapToIncrement } from "@/lib/personal-scheduler";
import type { ActivityType, Gap, Meeting } from "@/lib/timetable-types";
import type { PersonalItem } from "@/lib/personal-types";
import {
  formatCompactDuration,
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

function CalendarLegend({
  activityTypes,
  gapCount,
}: {
  activityTypes: ActivityType[];
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
  onEdit,
  onDelete,
}: {
  meeting: Meeting;
  compact?: boolean;
  onSelect: (meeting: Meeting) => void;
  onEdit?: ((meetingId: string) => void) | undefined;
  onDelete?: ((meetingId: string) => void) | undefined;
}) {
  const isPersonal = meeting.sectionCode === "PERSONAL";
  return (
    <div
      role="button"
      onClick={() => onSelect(meeting)}
      tabIndex={0}
      aria-haspopup="dialog"
      aria-label={`View details for ${meeting.courseCode}, ${meeting.courseName}`}
      title={`${meeting.courseCode} · ${meeting.courseName}`}
      data-activity={meeting.activityType}
      style={meeting.color ? ({ "--meeting-accent": meeting.color } as CSSProperties) : undefined}
      className={`meeting-card group relative flex h-full w-full touch-manipulation flex-col items-stretch justify-start overflow-hidden rounded-lg px-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-0 active:scale-[0.99] ${
        compact ? "py-1.5" : "py-2"
      }`}
    >
      {isPersonal ? (
        <div className="absolute right-2 top-2 z-10 flex gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onEdit?.(meeting.id);
            }}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-background/90 text-xs font-semibold text-foreground shadow-sm ring-1 ring-border hover:bg-secondary"
            aria-label="Edit personal item"
          >
            ✎
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDelete?.(meeting.id);
            }}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-background/90 text-xs font-semibold text-destructive shadow-sm ring-1 ring-border hover:bg-destructive/10"
            aria-label="Delete personal item"
          >
            ×
          </button>
        </div>
      ) : null}
      <div className="flex min-w-0 items-center gap-1.5">
        <MapPin
          className="card-pin h-3.5 w-3.5 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
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
    </div>
  );
}

function MeetingDetailsDialog({
  meeting,
  onClose,
  onRoute,
  onEditPersonal,
  onDeletePersonal,
}: {
  meeting: Meeting | null;
  onClose: () => void;
  onRoute: ((meeting: Meeting) => void) | undefined;
  onEditPersonal: ((meetingId: string) => void) | undefined;
  onDeletePersonal: ((meetingId: string) => void) | undefined;
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
        <DialogContent className="glass-panel max-h-[85vh] overflow-y-auto bg-card/75 sm:max-w-md">
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
              className="button-primary inline-flex w-full items-center justify-center gap-2 px-4 py-2 text-sm font-semibold"
            >
              <Navigation className="h-4 w-4" aria-hidden="true" />
              Route to this class
            </button>
          ) : null}
          {/* Edit/Delete for personal items */}
          {meeting?.sectionCode === "PERSONAL" ? (
            <div className="mt-3 space-y-2">
              {meeting.notes ? (
                <div className="rounded-xl border border-border bg-background/40 p-3 text-sm text-muted-foreground">
                  <p className="font-semibold text-foreground">Notes</p>
                  <p className="mt-1 whitespace-pre-wrap">{meeting.notes}</p>
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEditPersonal?.(meeting.id);
                }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-input px-4 py-2 text-sm font-semibold"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onDeletePersonal?.(meeting.id);
                }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground"
              >
                Delete
              </button>
            </div>
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
  onEditPersonal,
  onDeletePersonal,
  onCreatePersonal,
  onMovePersonal,
  onResizePersonal,
  headerAction,
}: {
  meetings: Meeting[];
  gaps: Gap[];
  onRouteToMeeting?: (meeting: Meeting) => void;
  onEditPersonal?: (meetingId: string) => void;
  onDeletePersonal?: (meetingId: string) => void;
  onCreatePersonal?: (payload: { weekday: string; startTime: number; endTime: number }) => void;
  onMovePersonal?: (id: string, weekday: string, startTime: number, endTime: number) => void;
  onResizePersonal?: (id: string, startTime: number, endTime: number) => void;
  headerAction?: ReactNode;
}) {
  const { startHour, hours, days } = useMemo(() => buildTimetableModel(meetings), [meetings]);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [dragState, setDragState] = useState<null | {
    type: "create" | "move" | "resize";
    meetingId?: string;
    weekday: string;
    start: number;
    end: number;
    resizing?: "start" | "end";
  }>(null);
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
  const gapsByDay = useMemo(
    () => new Map(WEEKDAYS.map((day) => [day, gaps.filter((gap) => gap.weekday === day)])),
    [gaps],
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
              Classes stay solid; usable time between them glows in mint
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
              className="button-secondary hidden px-2.5 py-1 text-xs font-semibold text-muted-foreground md:inline-flex"
            >
              {compactHours ? "Full spacing" : "Compact empty time"}
            </button>
          ) : null}
        </div>
      </div>

      {/* Desktop grid */}
      <div className="hidden md:block">
        <div className="timetable-shell surface overflow-hidden bg-card">
          <div className="timetable-day-header grid grid-cols-[4.5rem_repeat(5,1fr)] border-b border-border">
            <div className="flex items-center px-2.5 py-3 text-xs font-semibold text-muted-foreground">
              Time
            </div>
            {WEEKDAYS.map((day) => {
              const meetingCount = days.get(day)!.sorted.length;
              const isToday = termIsCurrent && day === currentDay;
              return (
                <div
                  key={day}
                  className={`flex min-w-0 items-center justify-between gap-1 border-l border-border px-2.5 py-3.5 ${isToday ? "bg-accent/8" : ""}`}
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
            {WEEKDAYS.map((day) => {
              const { laneCount, placement, sorted } = days.get(day)!;
              return (
                <div
                  key={day}
                  data-weekday={day}
                  className={`weekday-column relative border-l border-border ${
                    termIsCurrent && day === currentDay ? "bg-accent/[0.035]" : ""
                  }`}
                  onPointerDown={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.closest(".meeting-card")) return;
                    const col = e.currentTarget as HTMLElement;
                    col.setPointerCapture(e.pointerId);
                    const rect = col.getBoundingClientRect();
                    const offsetY = e.clientY - rect.top;
                    let acc = 0;
                    let minute = gridStartMinute;
                    for (const hour of hours) {
                      const h = scale.hourHeights.get(hour) ?? FULL_HOUR_HEIGHT;
                      if (offsetY >= acc + h) {
                        acc += h;
                        minute = (hour + 1) * 60;
                        continue;
                      }
                      const within = offsetY - acc;
                      const fraction = Math.max(0, Math.min(1, within / h));
                      minute = hour * 60 + Math.round(fraction * 60);
                      break;
                    }
                    const snap = (m: number) => Math.round(m / 15) * 15;
                    const start = Math.max(gridStartMinute, Math.min(gridEndMinute, snap(minute)));
                    setDragState({ type: "create", weekday: day, start, end: start + 60 });
                    document.body.classList.add("user-select-none");
                  }}
                  onPointerMove={(e) => {
                    if (!dragState) return;
                    const col = e.currentTarget as HTMLElement;
                    const rect = col.getBoundingClientRect();
                    const offsetY = e.clientY - rect.top;
                    let acc = 0;
                    let minute = gridStartMinute;
                    for (const hour of hours) {
                      const h = scale.hourHeights.get(hour) ?? FULL_HOUR_HEIGHT;
                      if (offsetY >= acc + h) {
                        acc += h;
                        minute = (hour + 1) * 60;
                        continue;
                      }
                      const within = offsetY - acc;
                      const fraction = Math.max(0, Math.min(1, within / h));
                      minute = hour * 60 + Math.round(fraction * 60);
                      break;
                    }
                    const snap = (m: number) => Math.round(m / 15) * 15;
                    const cur = Math.max(gridStartMinute, Math.min(gridEndMinute, snap(minute)));
                    if (dragState.type === "create") {
                      setDragState({ ...dragState, end: Math.max(dragState.start + 15, cur) });
                    }
                  }}
                  onPointerUp={(e) => {
                    const col = e.currentTarget as HTMLElement;
                    col.releasePointerCapture?.(e.pointerId);
                    if (dragState?.type === "create") {
                      onCreatePersonal?.({
                        weekday: dragState.weekday,
                        startTime: dragState.start,
                        endTime: dragState.end,
                      });
                    }
                    setDragState(null);
                    document.body.classList.remove("user-select-none");
                  }}
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
                      <div
                        key={gap.id}
                        className="gap-window pointer-events-none"
                        data-testid="gap-window"
                        aria-hidden="true"
                        style={{ top, height }}
                      >
                        {height >= 28 ? (
                          <span className="gap-window-label">
                            {formatCompactDuration(gap.durationMinutes)} gap
                          </span>
                        ) : null}
                      </div>
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
                    const isPersonal = meeting.sectionCode === "PERSONAL";
                    return (
                      <div
                        key={meeting.id}
                        data-meeting-id={meeting.id}
                        className={`absolute z-10 px-1 py-0.5 ${
                          dragState?.meetingId === meeting.id &&
                          detectConflicts(
                            {
                              weekday: dragState.weekday,
                              startTime: dragState.start,
                              endTime: dragState.end,
                            },
                            meetings.filter((m) => m.id !== meeting.id),
                          ).length > 0
                            ? "ring-2 ring-destructive"
                            : ""
                        }`}
                        style={{
                          top: scale.minuteToTop(meeting.startTime),
                          height:
                            scale.minuteToTop(meeting.endTime) -
                            scale.minuteToTop(meeting.startTime),
                          left: `${(lane / laneCount) * 100}%`,
                          width: `${(1 / laneCount) * 100}%`,
                        }}
                        onPointerDown={(e) => {
                          if (!isPersonal) return;
                          const target = e.target as HTMLElement;
                          if (
                            target.closest("button, input, textarea, select, a, [role='button']")
                          ) {
                            return;
                          }
                          e.stopPropagation();
                          const col = (e.currentTarget as HTMLElement).closest(
                            "[data-weekday]",
                          ) as HTMLElement | null;
                          const weekday = col?.getAttribute("data-weekday") ?? meeting.weekday;
                          (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
                          setDragState({
                            type: "move",
                            meetingId: meeting.id,
                            weekday,
                            start: meeting.startTime,
                            end: meeting.endTime,
                          });
                          document.body.classList.add("user-select-none");
                        }}
                        onPointerMove={(e) => {
                          if (!dragState || dragState.meetingId !== meeting.id) return;
                          const rect =
                            (e.currentTarget as HTMLElement)
                              .closest("[data-weekday]")
                              ?.getBoundingClientRect() ??
                            (e.currentTarget as HTMLElement).getBoundingClientRect();
                          const offsetY = e.clientY - rect.top;
                          let acc = 0;
                          let minute = gridStartMinute;
                          for (const hour of hours) {
                            const h = scale.hourHeights.get(hour) ?? FULL_HOUR_HEIGHT;
                            if (offsetY >= acc + h) {
                              acc += h;
                              minute = (hour + 1) * 60;
                              continue;
                            }
                            const within = offsetY - acc;
                            const fraction = Math.max(0, Math.min(1, within / h));
                            minute = hour * 60 + Math.round(fraction * 60);
                            break;
                          }
                          const cur = Math.max(
                            gridStartMinute,
                            Math.min(gridEndMinute, snapToIncrement(minute)),
                          );
                          if (dragState.type === "move") {
                            const duration = meeting.endTime - meeting.startTime;
                            setDragState({
                              ...dragState,
                              weekday:
                                (e.currentTarget as HTMLElement)
                                  .closest("[data-weekday]")
                                  ?.getAttribute("data-weekday") ?? meeting.weekday,
                              start: cur,
                              end: Math.min(gridEndMinute, cur + duration),
                            });
                            return;
                          }
                          if (dragState.type === "resize") {
                            const next =
                              dragState.resizing === "start"
                                ? resizeItem(meeting, cur, dragState.end)
                                : resizeItem(meeting, dragState.start, cur);
                            setDragState({
                              ...dragState,
                              start: next.startTime ?? dragState.start,
                              end: next.endTime ?? dragState.end,
                            });
                          }
                        }}
                        onPointerUp={(e) => {
                          if (!dragState || dragState.meetingId !== meeting.id) return;
                          const candidate = {
                            weekday: dragState.weekday,
                            startTime: dragState.start,
                            endTime: dragState.end,
                          };
                          const conflicts = detectConflicts(
                            candidate,
                            meetings.filter((m) => m.id !== meeting.id),
                          );
                          if (conflicts.length === 0) {
                            if (dragState.type === "move") {
                              const moved = moveItem(meeting, dragState.weekday, dragState.start);
                              onMovePersonal?.(
                                meeting.id,
                                moved.weekday,
                                moved.startTime,
                                moved.endTime,
                              );
                            }
                            if (dragState.type === "resize") {
                              const resized = resizeItem(meeting, dragState.start, dragState.end);
                              onResizePersonal?.(meeting.id, resized.startTime, resized.endTime);
                            }
                          }
                          setDragState(null);
                          document.body.classList.remove("user-select-none");
                        }}
                      >
                        {isPersonal ? (
                          <>
                            <div
                              className="absolute left-0 right-0 top-0 h-2 cursor-ns-resize"
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                const target = e.target as HTMLElement;
                                if (
                                  target.closest(
                                    "button, input, textarea, select, a, [role='button']",
                                  )
                                ) {
                                  return;
                                }
                                const col = (e.currentTarget as HTMLElement).closest(
                                  "[data-weekday]",
                                ) as HTMLElement | null;
                                const weekday =
                                  col?.getAttribute("data-weekday") ?? meeting.weekday;
                                (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
                                setDragState({
                                  type: "resize",
                                  meetingId: meeting.id,
                                  weekday,
                                  start: meeting.startTime,
                                  end: meeting.endTime,
                                  resizing: "start",
                                });
                                document.body.classList.add("user-select-none");
                              }}
                            />
                            <div
                              className="absolute left-0 right-0 bottom-0 h-2 cursor-ns-resize"
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                const target = e.target as HTMLElement;
                                if (
                                  target.closest(
                                    "button, input, textarea, select, a, [role='button']",
                                  )
                                ) {
                                  return;
                                }
                                const col = (e.currentTarget as HTMLElement).closest(
                                  "[data-weekday]",
                                ) as HTMLElement | null;
                                const weekday =
                                  col?.getAttribute("data-weekday") ?? meeting.weekday;
                                (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
                                setDragState({
                                  type: "resize",
                                  meetingId: meeting.id,
                                  weekday,
                                  start: meeting.startTime,
                                  end: meeting.endTime,
                                  resizing: "end",
                                });
                                document.body.classList.add("user-select-none");
                              }}
                            />
                          </>
                        ) : null}
                        <MeetingCard
                          meeting={meeting}
                          compact={isCompactMeetingCard(meeting, laneCount)}
                          onSelect={selectMeeting}
                          onEdit={onEditPersonal}
                          onDelete={onDeletePersonal}
                        />
                      </div>
                    );
                  })}
                  {dragState && dragState.weekday === day ? (
                    <div
                      aria-hidden="true"
                      className="absolute z-20 px-1 py-0.5"
                      style={{
                        top: scale.minuteToTop(dragState.start),
                        height: Math.max(
                          12,
                          scale.minuteToTop(dragState.end) - scale.minuteToTop(dragState.start),
                        ),
                        left: 0,
                        right: 0,
                      }}
                    >
                      <div className="meeting-card pointer-events-none opacity-80">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold">New</span>
                          <span className="text-xs tabular-nums">
                            {formatTime(dragState.start)} – {formatTime(dragState.end)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : null}
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
              <div className="flex items-center justify-between border-b border-border bg-secondary/30 px-4 py-3">
                <h3 id={`day-${day}`} className="text-sm font-medium">
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
                        className="meeting-card group w-full touch-manipulation rounded-xl p-3.5 text-left focus-visible:outline-none active:translate-y-0 active:scale-[0.99]"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <MapPin
                            className="card-pin h-4 w-4 shrink-0 text-muted-foreground"
                            aria-hidden="true"
                          />
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
        onEditPersonal={onEditPersonal}
        onDeletePersonal={onDeletePersonal}
      />
    </div>
  );
});
