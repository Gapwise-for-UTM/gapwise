import type { User } from "@supabase/supabase-js";
import { lazy, Suspense } from "react";
import type { GapPreferences } from "@/features/gaps/types";
import type { TransitionPlanner } from "@/features/routing/transition";
import type { UserPreferences } from "@/features/sync/preferences";
import type { Gap, Term } from "@/lib/timetable-types";
import "./gap-plan.css";

const GapPlanImpl = lazy(() =>
  import("./GapPlanImpl").then((module) => ({ default: module.GapPlan })),
);

export type GapPlanProps = {
  gaps: Gap[];
  preferences: UserPreferences;
  gapPreferences: GapPreferences;
  onGapPreferencesChange: (next: GapPreferences) => void;
  planTransition: TransitionPlanner;
  user: User | null;
  term: Term;
};

export function GapPlan(props: GapPlanProps) {
  return (
    <Suspense fallback={<div className="surface h-24" aria-hidden="true" />}>
      <GapPlanImpl {...props} />
    </Suspense>
  );
}
