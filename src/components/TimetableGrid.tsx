import { BookOpen, CalendarDays, Clock3, MapPin } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ActivityType, Meeting } from "@/lib/timetable-types";
import { formatTime, locationLabel, WEEKDAYS } from "@/lib/timetable-types";
import { buildTimetableModel, isCompactMeetingCard } from "@/lib/timetable-layout";

const TYPE_STYLES: Record<ActivityType, string> = {
  LEC: "border-l-lec text-lec",
  TUT: "border-l-tut text-tut",
  PRA: "border-l-pra text-pra",
  OTHER: "border-l-muted-foreground text-muted-foreground",
};

const TYPE_BADGE_STYLES: Record<ActivityType, string> = {
  LEC: "bg-lec/10 text-lec",
  TUT: "bg-tut/10 text-tut",
  PRA: "bg-pra/10 text-pra",
  OTHER: "bg-muted text-muted-foreground",
};

export function ActivityBadge({ type }: { type: ActivityType }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[0.7rem] font-bold tracking-wide ${TYPE_BADGE_STYLES[type]}`}
    >
      {type}
    </span>
  );
}

function useCurrentTime() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const update = () => setNow(new Date());

    update();
    const timer = window.setInterval(update, 30_000);

    return () => window.clearInterval(timer);
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
      className={`group flex h-full w-full touch-manipulation flex-col items-stretch justify-start overflow-hidden rounded-md border border-border border-l-4 bg-card px-2 py-1.5 text-left transition-[border-color,background-color,box-shadow,transform] duration-150 ease-out hover:border-accent/60 hover:bg-secondary/45 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.99] ${TYPE_STYLES[meeting.activityType]}`}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="truncate text-xs font-bold text-foreground">{meeting.courseCode}</span>
        <ActivityBadge type={meeting.activityType} />
      </div>
      <p className="truncate text-[0.7rem] text-muted-foreground">
        {formatTime(meeting.startTime)} – {formatTime(meeting.endTime)}
      </p>
      <p className="truncate text-[0.7rem] font-medium text-foreground">{locationLabel(meeting)}</p>
      {!compact ? (
        <p className="mt-0.5 line-clamp-2 text-[0.7rem] leading-tight text-muted-foreground">
          {meeting.courseName}
        </p>
      ) : null}
    </button>
  );
}

function MeetingDetailsDialog({
  meeting,
  onClose,
}: {
  meeting: Meeting | null;
  onClose: () => void;
}) {
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
                {meeting.weekday} · {meeting.term}
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

          <p className="text-xs leading-relaxed text-muted-foreground">
            This information comes from the ACORN calendar file you imported. Opening a class card
            does not contact ACORN or upload anything new.
          </p>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

export const TimetableGrid = memo(function TimetableGrid({ meetings }: { meetings: Meeting[] }) {
  const { startHour, hours, days } = useMemo(() => buildTimetableModel(meetings), [meetings]);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const now = useCurrentTime();
  const pxPerMinute = 1.1;

  const currentDay = now ? (WEEKDAYS[now.getDay() - 1] ?? null) : null;
  const currentMinute = now ? now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60 : null;
  const gridStartMinute = startHour * 60;
  const gridEndMinute = (startHour + hours.length) * 60;
  const showCurrentTime =
    currentDay !== null &&
    currentMinute !== null &&
    hours.length > 0 &&
    currentMinute >= gridStartMinute &&
    currentMinute < gridEndMinute;
  const currentTop = showCurrentTime ? (currentMinute - gridStartMinute) * pxPerMinute : 0;
  const currentTimeLabel = currentMinute === null ? "" : formatTime(Math.floor(currentMinute));

  const selectMeeting = useCallback((meeting: Meeting) => setSelectedMeeting(meeting), []);
  const closeMeeting = useCallback(() => setSelectedMeeting(null), []);

  return (
    <div>
      {/* Desktop grid */}
      <div className="hidden md:block">
        <div className="surface overflow-hidden">
          <div className="grid grid-cols-[4rem_repeat(5,1fr)] border-b border-border bg-secondary/60">
            <div className="p-2 text-xs font-semibold text-muted-foreground">Time</div>
            {WEEKDAYS.map((day) => (
              <div key={day} className="p-2 text-xs font-semibold">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-[4rem_repeat(5,1fr)]">
            <div className="relative">
              {hours.map((hour) => (
                <div
                  key={hour}
                  style={{ height: 60 * pxPerMinute }}
                  className="border-b border-border pr-2 text-right text-[0.7rem] text-muted-foreground"
                >
                  {formatTime(hour * 60)}
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
                <div key={day} className="relative border-l border-border">
                  {hours.map((hour) => (
                    <div
                      key={hour}
                      style={{ height: 60 * pxPerMinute }}
                      className="border-b border-border"
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
                        className="absolute px-1"
                        style={{
                          top: (meeting.startTime - startHour * 60) * pxPerMinute,
                          height: (meeting.endTime - meeting.startTime) * pxPerMinute,
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
            <section key={day} className="surface p-4" aria-labelledby={`day-${day}`}>
              <h3 id={`day-${day}`} className="text-sm font-semibold">
                {day}
              </h3>
              {dayMeetings.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No classes scheduled.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {dayMeetings.map((meeting) => (
                    <li key={meeting.id}>
                      <button
                        type="button"
                        onClick={() => selectMeeting(meeting)}
                        aria-haspopup="dialog"
                        aria-label={`View details for ${meeting.courseCode}, ${meeting.courseName}`}
                        className={`w-full touch-manipulation rounded-lg border border-border border-l-4 bg-card p-3 text-left transition-[border-color,background-color,box-shadow,transform] duration-150 hover:border-accent/60 hover:bg-secondary/45 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.99] ${TYPE_STYLES[meeting.activityType]}`}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-foreground">
                            {meeting.courseCode}
                          </span>
                          <ActivityBadge type={meeting.activityType} />
                          <span className="text-xs text-muted-foreground">
                            {meeting.sectionCode}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-foreground">
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

      <MeetingDetailsDialog meeting={selectedMeeting} onClose={closeMeeting} />
    </div>
  );
});
