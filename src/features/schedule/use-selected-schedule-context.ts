import { useEffect, useMemo, useState } from "react";
import { UTM_ROUTING_GRAPH } from "@/data/utm/campus";
import { createScheduleTransitionPlanner } from "@/features/routing/transition";
import { chooseDefaultTerm } from "@/lib/calendar-awareness";
import { findGaps } from "@/lib/gaps";
import { availableScheduleTerms, composeTermSchedule } from "@/lib/personal-scheduler";
import type { Meeting, Term } from "@/lib/timetable-types";

const EMPTY_MEETINGS: Meeting[] = [];

/** Owns the selected-term facts shared by responsive timetable, Today, and gap views. */
export function useSelectedScheduleContext(meetings: Meeting[] | null) {
  const [term, setTerm] = useState<Term>("Fall");
  const terms = useMemo(() => availableScheduleTerms(meetings ?? EMPTY_MEETINGS), [meetings]);

  useEffect(() => {
    if (terms.length > 0 && !terms.includes(term)) setTerm(terms[0]!);
  }, [terms, term]);

  useEffect(() => {
    if (meetings?.length) setTerm(chooseDefaultTerm(meetings, new Date()));
  }, [meetings]);

  const schedule = useMemo(
    () => composeTermSchedule(meetings ?? EMPTY_MEETINGS, [], term),
    [meetings, term],
  );
  const gaps = useMemo(() => findGaps(schedule, term), [schedule, term]);
  const planTransition = useMemo(
    () => createScheduleTransitionPlanner(UTM_ROUTING_GRAPH, meetings ?? EMPTY_MEETINGS),
    [meetings],
  );

  return { term, setTerm, terms, schedule, gaps, planTransition };
}
