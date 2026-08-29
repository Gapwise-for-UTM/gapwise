import type { Meeting } from "@/lib/timetable-types";

export const CAMPUS_TIME_ZONE = "America/Toronto" as const;

export type Confidence = "low" | "medium" | "high";
export type CourseworkKind =
  "assignment" | "quiz" | "exam" | "reading" | "lab" | "project" | "discussion" | "other";
export type SubmissionState =
  "unknown" | "unsubmitted" | "submitted" | "graded" | "missing" | "late";
export type LocalProgress = "not_started" | "in_progress" | "completed_manually";
export type EstimateProvenance =
  | "user_supplied"
  | "assignment_analysis"
  | "course_prior"
  | "observed_student_history"
  | "generic_fallback";
export type WorkCharacteristic =
  | "proof_heavy"
  | "coding_heavy"
  | "reading_heavy"
  | "writing_heavy"
  | "lab_based"
  | "collaboration_required"
  | "high_cognitive_load"
  | "prefers_long_sessions"
  | "easy_to_split";

export interface WorkEstimate {
  estimatedTotalMinutes: number;
  remainingMinutes: number;
  confidence: Confidence;
  provenance: EstimateProvenance;
  components?: ReadonlyArray<{ label: string; minutes: number }>;
  observedActualMinutes?: number;
}

export interface CourseWorkloadProfile {
  courseId: string;
  characteristics: readonly WorkCharacteristic[];
  typicalMinutes?: { min: number; max: number };
  confidence: Confidence;
  provenance: Exclude<EstimateProvenance, "user_supplied">;
}

export interface CourseworkItem {
  id: string;
  provider: { provider: "other"; courseRef: string; itemRef: string };
  courseId: string;
  courseCode: string;
  title: string;
  kind: CourseworkKind;
  availableAt: string | null;
  dueAt: string | null;
  providerUpdatedAt: string;
  pointsPossible: number | null;
  weightPercent: number | null;
  content: { plainTextSummary?: string; taskCount?: number; submissionTypes?: readonly string[] };
  workEstimate: WorkEstimate;
  priority: "low" | "normal" | "high";
  submissionState: SubmissionState;
  localProgress: LocalProgress;
  provenance: { source: string; confidence: Confidence };
  requiresAnotherAttempt?: boolean;
}

/**
 * Provider-confirmed states that mean the current attempt no longer needs work scheduled.
 * `late` is complete only when it represents an already-submitted attempt after the due time.
 * A reopened or new attempt is represented separately.
 */
export function isProviderSubmissionComplete(state: SubmissionState): boolean {
  return state === "submitted" || state === "graded" || state === "late";
}

export function needsScheduledWork(item: CourseworkItem): boolean {
  if (item.requiresAnotherAttempt) return true;
  if (item.localProgress === "completed_manually") return false;
  return !isProviderSubmissionComplete(item.submissionState);
}

export type BlockStatus = "proposed" | "accepted" | "completed" | "missed" | "cancelled";
export interface PlannedWorkBlock {
  id: string;
  courseworkId: string;
  start: string;
  end: string;
  allocatedMinutes: number;
  status: BlockStatus;
  origin: "deterministic_planner" | "user";
  locked: boolean;
  revision: string;
  reasons: readonly string[];
}

export interface AcademicPlanningContext {
  horizon: {
    startDate: string;
    endDate: string;
    dayStartMinute: number;
    dayEndMinute: number;
    timeZone: typeof CAMPUS_TIME_ZONE;
    /** Earliest instant that may receive new work. Used to avoid proposing blocks in the past. */
    notBefore?: string;
  };
  /** Stable key for route preferences that affect usable time, without exposing planner internals. */
  routingRevision?: string;
  academicMeetings: readonly Meeting[];
  fixedPersonalCommitments: readonly Meeting[];
  coursework: readonly CourseworkItem[];
  courseProfiles: readonly CourseWorkloadProfile[];
  existingBlocks: readonly PlannedWorkBlock[];
  preferences: {
    minimumBlockMinutes: number;
    maximumBlockMinutes: number;
    setupMinutes: number;
    packUpMinutes: number;
    maxDailyMinutes: number;
  };
}
