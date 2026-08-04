import type { ActivityType, Meeting } from "@/lib/timetable-types";
import { formatTime, locationLabel, WEEKDAYS } from "@/lib/timetable-types";
import { buildTimetableModel, isCompactMeetingCard } from "@/lib/timetable-layout";
import { memo, useMemo } from "react";

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

function MeetingCard({ meeting, compact }: { meeting: Meeting; compact?: boolean }) {
  return (
    <div
      className={`h-full overflow-hidden rounded-md border border-border border-l-4 bg-card px-2 py-1.5 ${TYPE_STYLES[meeting.activityType]}`}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-bold text-foreground">{meeting.courseCode}</span>
        <ActivityBadge type={meeting.activityType} />
      </div>
      <p className="truncate text-[0.7rem] text-muted-foreground">
        {formatTime(meeting.startTime)} – {formatTime(meeting.endTime)}
      </p>
      <p className="truncate text-[0.7rem] font-medium text-foreground">{locationLabel(meeting)}</p>
      {!compact ? (
        <p className="truncate text-[0.7rem] text-muted-foreground">{meeting.courseName}</p>
      ) : null}
    </div>
  );
}

export const TimetableGrid = memo(function TimetableGrid({ meetings }: { meetings: Meeting[] }) {
  const { startHour, hours, days } = useMemo(() => buildTimetableModel(meetings), [meetings]);
  const pxPerMinute = 1.1;

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
            <div>
              {hours.map((hour) => (
                <div
                  key={hour}
                  style={{ height: 60 * pxPerMinute }}
                  className="border-b border-border pr-2 text-right text-[0.7rem] text-muted-foreground"
                >
                  {formatTime(hour * 60)}
                </div>
              ))}
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
                      <div
                        className={`rounded-lg border border-border border-l-4 bg-card p-3 ${TYPE_STYLES[meeting.activityType]}`}
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
                        <p className="text-sm text-muted-foreground">
                          {locationLabel(meeting)} · {meeting.courseName}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
});
