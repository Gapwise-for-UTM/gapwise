import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  Clock3,
  MapPin,
  Navigation,
  Plus,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ActivityBadge } from "@/components/TimetableGrid";
import { useMobileRouteTarget } from "@/components/mobile/MobileShell";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  firstOccurrenceForMeeting,
  lastOccurrenceForMeeting,
  nextOccurrenceForMeeting,
} from "@/lib/calendar-awareness";
import type { Gap, Meeting, Term, Weekday } from "@/lib/timetable-types";
import {
  formatCompactDuration,
  formatTime,
  locationLabel,
  meetingLocationType,
  WEEKDAYS,
} from "@/lib/timetable-types";

const DAY_SHORT: Record<Weekday, string> = {
  Monday: "Mon",
  Tuesday: "Tue",
  Wednesday: "Wed",
  Thursday: "Thu",
  Friday: "Fri",
};

function initialDay(meetings: Meeting[]): Weekday {
  const now = new Date();
  const today = WEEKDAYS[now.getDay() - 1];
  if (today && meetings.some((meeting) => meeting.weekday === today)) return today;
  return WEEKDAYS.find((day) => meetings.some((meeting) => meeting.weekday === day)) ?? "Monday";
}

function MeetingDetailsSheet({
  meeting,
  onClose,
  onRoute,
  onEditPersonal,
  onDeletePersonal,
}: {
  meeting: Meeting | null;
  onClose: () => void;
  onRoute: (meeting: Meeting) => void;
  onEditPersonal: (meetingId: string) => void;
  onDeletePersonal: (meetingId: string) => void;
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
    Boolean(meeting.buildingCode);
  const isPersonal = meeting?.sectionCode === "PERSONAL";

  return (
    <Drawer open={meeting !== null} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-h-[88dvh]">
        {meeting ? (
          <div className="overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <DrawerHeader className="px-0 text-left">
              <div className="flex flex-wrap items-center gap-2">
                <DrawerTitle className="font-display text-xl font-semibold tracking-tight">
                  {meeting.courseCode}
                </DrawerTitle>
                <ActivityBadge type={meeting.activityType} />
                {meeting.sectionCode && !isPersonal ? (
                  <span className="text-xs font-medium text-muted-foreground">
                    {meeting.sectionCode}
                  </span>
                ) : null}
              </div>
              <DrawerDescription className="text-left text-sm leading-6">
                {meeting.courseName || "Course name unavailable"}
              </DrawerDescription>
            </DrawerHeader>

            <dl className="grid gap-2.5">
              <div className="rounded-xl border border-border bg-background/45 p-3.5">
                <dt className="flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                  Day and term
                </dt>
                <dd className="mt-1.5 text-sm font-medium">
                  {meeting.weekday} · {meeting.term} · {dateRange}
                </dd>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-xl border border-border bg-background/45 p-3.5">
                  <dt className="flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                    Time
                  </dt>
                  <dd className="mt-1.5 text-sm font-medium tabular-nums">
                    {formatTime(meeting.startTime)} – {formatTime(meeting.endTime)}
                  </dd>
                </div>
                <div className="rounded-xl border border-border bg-background/45 p-3.5">
                  <dt className="flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                    Location
                  </dt>
                  <dd className="mt-1.5 text-sm font-medium">{locationLabel(meeting)}</dd>
                </div>
              </div>
              <div className="rounded-xl border border-border bg-background/45 p-3.5">
                <dt className="flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                  Next occurrence
                </dt>
                <dd className="mt-1.5 text-sm font-medium">
                  {next
                    ? `${new Intl.DateTimeFormat("en-CA", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      }).format(next)} at ${formatTime(meeting.startTime)}`
                    : "No later occurrence in this timetable"}
                </dd>
              </div>
            </dl>

            {meeting.notes ? (
              <div className="mt-3 rounded-xl border border-border bg-background/45 p-3.5 text-sm">
                <p className="font-semibold">Notes</p>
                <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{meeting.notes}</p>
              </div>
            ) : null}

            <div className="mt-4 space-y-2">
              {canRoute ? (
                <button
                  type="button"
                  onClick={() => {
                    onRoute(meeting);
                    onClose();
                  }}
                  className="button-primary inline-flex min-h-12 w-full items-center justify-center gap-2 px-4 text-sm font-semibold"
                >
                  <Navigation className="h-4 w-4" aria-hidden="true" />
                  Route to this class
                </button>
              ) : null}
              {isPersonal ? (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onEditPersonal(meeting.id);
                    }}
                    className="button-secondary min-h-11 px-4 text-sm font-semibold"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onDeletePersonal(meeting.id);
                    }}
                    className="min-h-11 rounded-xl border border-destructive/40 bg-destructive/10 px-4 text-sm font-semibold text-destructive"
                  >
                    Delete
                  </button>
                </div>
              ) : null}
            </div>

            <p className="mt-4 text-xs leading-5 text-muted-foreground">
              Course information comes from the ACORN calendar you imported. Opening details does
              not contact ACORN or upload anything new.
            </p>
          </div>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}

export function MobileTimetable({
  meetings,
  term,
  terms,
  gaps,
  onTermChange,
  onOpenGapPlan,
  onRouteToMeeting,
  onAddPersonal,
  onEditPersonal,
  onDeletePersonal,
}: {
  meetings: Meeting[];
  term: Term;
  terms: Term[];
  gaps: Gap[];
  onTermChange: (term: Term) => void;
  onOpenGapPlan: () => void;
  onRouteToMeeting: (meeting: Meeting) => void;
  onAddPersonal: () => void;
  onEditPersonal: (meetingId: string) => void;
  onDeletePersonal: (meetingId: string) => void;
}) {
  const [selectedDay, setSelectedDay] = useState<Weekday>(() => initialDay(meetings));
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const { setRouteTargetId } = useMobileRouteTarget();

  useEffect(() => {
    setSelectedDay((currentDay) =>
      meetings.some((meeting) => meeting.weekday === currentDay)
        ? currentDay
        : initialDay(meetings),
    );
  }, [meetings]);

  const dayMeetings = useMemo(
    () =>
      meetings
        .filter((meeting) => meeting.weekday === selectedDay)
        .sort((a, b) => a.startTime - b.startTime || a.endTime - b.endTime),
    [meetings, selectedDay],
  );
  const dayGaps = useMemo(
    () => gaps.filter((gap) => gap.weekday === selectedDay),
    [gaps, selectedDay],
  );
  const gapByTransition = useMemo(
    () => new Map(dayGaps.map((gap) => [`${gap.previous.id}:${gap.next.id}`, gap])),
    [dayGaps],
  );
  const firstTime = dayMeetings[0]?.startTime ?? null;
  const lastTime = dayMeetings[dayMeetings.length - 1]?.endTime ?? null;

  return (
    <div className="rise-in space-y-4">
      <section className="today-signal surface overflow-hidden p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow text-accent">Day timetable</p>
            <h1 className="mt-1.5 font-display text-2xl font-semibold tracking-[-0.035em]">
              {selectedDay}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {dayMeetings.length === 0
                ? `Nothing scheduled in ${term}`
                : `${dayMeetings.length} ${dayMeetings.length === 1 ? "event" : "events"} · ${formatTime(
                    firstTime!,
                  )} – ${formatTime(lastTime!)}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onAddPersonal}
            className="button-primary inline-flex min-h-11 shrink-0 items-center gap-1.5 px-3 text-xs font-semibold"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add
          </button>
        </div>

        {terms.length > 1 ? (
          <div className="mt-4 grid grid-cols-2 rounded-xl border border-border bg-background/45 p-1">
            {terms.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => onTermChange(item)}
                aria-pressed={term === item}
                className={`min-h-10 rounded-lg px-3 text-sm font-semibold transition-colors ${
                  term === item
                    ? "bg-primary text-primary-foreground shadow-[var(--accent-glow)]"
                    : "text-muted-foreground"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        ) : null}

        <div
          className="mobile-day-tabs mt-4 grid grid-cols-5 gap-1"
          role="group"
          aria-label="Weekday"
        >
          {WEEKDAYS.map((day) => {
            const active = day === selectedDay;
            const count = meetings.filter((meeting) => meeting.weekday === day).length;
            return (
              <button
                key={day}
                type="button"
                aria-pressed={active}
                onClick={() => setSelectedDay(day)}
                className={`mobile-day-tab flex min-h-12 flex-col items-center justify-center rounded-lg border px-1 text-xs font-semibold ${
                  active
                    ? "border-accent/45 bg-accent/12 text-accent"
                    : "border-transparent text-muted-foreground"
                }`}
              >
                <span>{DAY_SHORT[day]}</span>
                <span className="mt-0.5 text-[0.62rem] font-medium opacity-70">{count || "–"}</span>
              </button>
            );
          })}
        </div>
      </section>

      {dayMeetings.length === 0 ? (
        <section className="empty-state surface flex min-h-52 flex-col items-center justify-center p-8 text-center">
          <span className="empty-state-icon flex h-11 w-11 items-center justify-center rounded-xl border border-accent/20 bg-accent/8 text-accent">
            <CalendarDays className="h-5 w-5" aria-hidden="true" />
          </span>
          <h2 className="mt-4 font-display text-lg font-semibold">Your {selectedDay} is clear</h2>
          <p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">
            Pick another day or add a personal item to plan time outside your ACORN schedule.
          </p>
          <button
            type="button"
            onClick={onAddPersonal}
            className="button-secondary mt-5 min-h-11 px-4 text-sm font-semibold"
          >
            Add personal item
          </button>
        </section>
      ) : (
        <section className="surface overflow-hidden p-4" aria-label={`${selectedDay} schedule`}>
          <div className="relative">
            <div
              className="absolute bottom-5 left-[0.7rem] top-5 w-px bg-border"
              aria-hidden="true"
            />
            <ol className="relative space-y-0">
              {dayMeetings.map((meeting, index) => {
                const next = dayMeetings[index + 1] ?? null;
                const gap = next ? gapByTransition.get(`${meeting.id}:${next.id}`) : null;
                const isPersonal = meeting.sectionCode === "PERSONAL";
                return (
                  <li key={meeting.id}>
                    <div className="relative flex gap-3 pb-3">
                      <span
                        className="relative z-10 mt-5 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-background bg-accent ring-1 ring-accent/40"
                        aria-hidden="true"
                      />
                      <button
                        type="button"
                        onClick={() => setSelectedMeeting(meeting)}
                        data-activity={meeting.activityType}
                        style={
                          meeting.color
                            ? ({ "--meeting-accent": meeting.color } as CSSProperties)
                            : undefined
                        }
                        className="meeting-card min-w-0 flex-1 rounded-xl p-4 text-left outline-none transition-transform active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate font-display text-[0.95rem] font-bold tracking-tight">
                            {meeting.courseCode}
                          </span>
                          <ActivityBadge type={meeting.activityType} />
                          {isPersonal ? (
                            <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[0.62rem] font-semibold text-muted-foreground">
                              Personal
                            </span>
                          ) : null}
                          <ChevronRight
                            className="ml-auto h-4 w-4 shrink-0 text-muted-foreground"
                            aria-hidden="true"
                          />
                        </div>
                        <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold tabular-nums text-foreground">
                          <Clock3 className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                          {formatTime(meeting.startTime)} – {formatTime(meeting.endTime)}
                        </p>
                        <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                          <MapPin className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                          {locationLabel(meeting)}
                        </p>
                        {meeting.courseName ? (
                          <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                            {meeting.courseName}
                          </p>
                        ) : null}
                      </button>
                    </div>

                    {gap ? (
                      <div className="relative flex gap-3 pb-3">
                        <span
                          className="relative z-10 mt-4 h-3.5 w-3.5 shrink-0 rounded-full border border-accent/35 bg-background"
                          aria-hidden="true"
                        />
                        <button
                          type="button"
                          onClick={onOpenGapPlan}
                          className="mobile-gap-card min-w-0 flex-1 rounded-xl border border-dashed px-4 py-3 text-left transition-colors active:bg-gap/10"
                        >
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-3.5 w-3.5 text-gap" aria-hidden="true" />
                            <span className="text-xs font-semibold text-foreground">
                              {formatCompactDuration(gap.durationMinutes)} gap
                            </span>
                            <span className="ml-auto text-[0.68rem] font-semibold text-gap-text">
                              View gap plan
                            </span>
                          </div>
                          <p className="mt-1 text-[0.7rem] text-muted-foreground">
                            {formatTime(gap.startTime)} – {formatTime(gap.endTime)}
                          </p>
                        </button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </div>
        </section>
      )}

      <MeetingDetailsSheet
        meeting={selectedMeeting}
        onClose={() => setSelectedMeeting(null)}
        onRoute={(meeting) => {
          setRouteTargetId(meeting.id);
          onRouteToMeeting(meeting);
        }}
        onEditPersonal={onEditPersonal}
        onDeletePersonal={onDeletePersonal}
      />
    </div>
  );
}
