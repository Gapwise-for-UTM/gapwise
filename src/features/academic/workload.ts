import type {
  CourseWorkloadProfile,
  CourseworkItem,
  WorkEstimate,
  WorkCharacteristic,
} from "./types";

export interface WorkObservation {
  estimatedMinutes: number;
  actualMinutes: number;
  courseId: string;
  characteristics: readonly WorkCharacteristic[];
  completedAt: string;
}

export function resolveWorkEstimate(input: {
  genericMinutes: number;
  courseProfile?: CourseWorkloadProfile;
  analysisMinutes?: number;
  observations?: readonly WorkObservation[];
  userOverrideMinutes?: number;
}): WorkEstimate {
  if (input.userOverrideMinutes !== undefined)
    return estimate(input.userOverrideMinutes, "user_supplied", "high");
  if (input.observations?.length) {
    const ratios = input.observations.map((o) => o.actualMinutes / Math.max(1, o.estimatedMinutes));
    // Four prior observations prevent a small sample from causing a wild swing.
    const ratio = (4 + ratios.reduce((a, b) => a + b, 0)) / (4 + ratios.length);
    const base =
      input.analysisMinutes ?? profileMidpoint(input.courseProfile) ?? input.genericMinutes;
    return estimate(
      Math.round(base * Math.min(1.5, Math.max(0.75, ratio))),
      "observed_student_history",
      ratios.length >= 4 ? "high" : "medium",
    );
  }
  if (input.analysisMinutes !== undefined)
    return estimate(input.analysisMinutes, "assignment_analysis", "medium");
  const course = profileMidpoint(input.courseProfile);
  if (course !== undefined)
    return estimate(course, "course_prior", input.courseProfile!.confidence);
  return estimate(input.genericMinutes, "generic_fallback", "low");
}

function profileMidpoint(profile?: CourseWorkloadProfile) {
  return profile?.typicalMinutes
    ? Math.round((profile.typicalMinutes.min + profile.typicalMinutes.max) / 2)
    : undefined;
}
function estimate(
  minutes: number,
  provenance: WorkEstimate["provenance"],
  confidence: WorkEstimate["confidence"],
): WorkEstimate {
  const safe = Math.max(0, Math.round(minutes));
  return { estimatedTotalMinutes: safe, remainingMinutes: safe, provenance, confidence };
}

export function withRemainingWork(item: CourseworkItem, completedMinutes: number): CourseworkItem {
  return {
    ...item,
    workEstimate: {
      ...item.workEstimate,
      remainingMinutes: Math.max(0, item.workEstimate.estimatedTotalMinutes - completedMinutes),
    },
  };
}
