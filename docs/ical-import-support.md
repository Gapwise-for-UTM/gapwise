# iCalendar import support

Gapwise reads the selected calendar entirely in the browser. The original `.ics` file is not
uploaded.

The importer supports ACORN-style timed course events, local or UTC date-times, `TZID` date-times,
folded lines, escaped text, weekly `RRULE` values (including multiple `BYDAY` weekdays and
intervals), `RDATE`, and `EXDATE`. Missing, empty, online, and unrecognized locations remain
explicit rather than being guessed. Duplicate normalized meetings are collapsed deterministically,
and cancelled events are ignored. Cancelled instances of a weekly series become explicit exclusions.

The normalized timetable model does not currently represent recurrence overrides
(`RECURRENCE-ID`), non-weekly recurrence patterns, all-day events, or meetings that cross midnight.
The importer skips recurrence overrides with a warning, shows only the first occurrence of a
non-weekly rule with a warning, and rejects unusable time ranges. If no valid course meetings remain,
the import fails with an actionable error instead of replacing the current timetable with an empty
one.

This support boundary is deliberately conservative: Gapwise does not invent occurrences or infer
campus locations from malformed or unsupported calendar data.
