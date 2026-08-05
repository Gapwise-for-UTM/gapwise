import type { TransitionRoute } from "@/features/routing/types";
import type { UserPreferences } from "@/features/sync/preferences";
import type { Gap } from "@/lib/timetable-types";

export type GapAction =
  | "tight-transition"
  | "quick-reset"
  | "focus-sprint"
  | "meal-window"
  | "study-block"
  | "deep-work-block"
  | "flexible-long-gap"
  | "leave-campus-candidate"
  | "location-dependent";

export type GapTag =
  | "same-room"
  | "same-building"
  | "nearby-route"
  | "lunch-time"
  | "route-verified"
  | "route-estimated"
  | "route-unavailable"
  | "location-unknown"
  | "high-transition-risk"
  | "indoor-route"
  | "step-free-route"
  | "good-for-commuting";

export type GapConfidence = "high" | "medium" | "low";

export type GapTimelineKind = "setup" | "activity" | "travel" | "buffer" | "flex";

export type GapTimelineSegment = {
  kind: GapTimelineKind;
  label: string;
  minutes: number;
};

export type GapRecommendation = {
  id: string;
  action: GapAction;
  title: string;
  summary: string;
  score: number;
  activityMinutes: number;
  reasons: string[];
  tags: GapTag[];
  timeline: GapTimelineSegment[];
};

export type GapAssessment = {
  primary: GapRecommendation;
  alternatives: GapRecommendation[];
  confidence: number;
  confidenceLabel: GapConfidence;
  travelMinutes: number | null;
  bufferMinutes: number;
  leaveByMinutes: number;
  arrivalMinutes: number | null;
  fallback: boolean;
  routeStatus: TransitionRoute["status"];
  routeAccuracy: TransitionRoute["accuracy"];
  warnings: string[];
};

export type RiskTolerance = "low" | "medium" | "high";

export type GapPreferences = {
  setupMinutes: number;
  packUpMinutes: number;
  lunchWindowStart: number;
  lunchWindowEnd: number;
  mealDurationMinutes: number;
  willingToLeaveCampus: boolean;
  oneWayHomeCommuteMinutes: number | null;
  minimumHomeStayMinutes: number;
  homeTurnaroundMinutes: number;
  riskTolerance: RiskTolerance;
};

export type GapAssessmentInput = {
  gap: Gap;
  route: TransitionRoute;
  routePreferences: UserPreferences;
  gapPreferences: GapPreferences;
};
