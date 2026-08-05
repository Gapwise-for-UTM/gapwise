import { calculateGapTiming } from "@/lib/gaps";
import { formatDuration } from "@/lib/timetable-types";
import type {
  GapAction,
  GapAssessment,
  GapAssessmentInput,
  GapConfidence,
  GapRecommendation,
  GapTag,
  GapTimelineSegment,
} from "./types";

const SCORE = {
  locationDependent: 110,
  tightTransition: 99,
  quickReset: 78,
  focusSprint: 84,
  studyBlock: 89,
  deepWork: 94,
  flexibleLongGap: 91,
  mealWindow: 90,
  leaveCampus: 96,
  resetAlternative: 68,
} as const;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function overlaps(start: number, end: number, windowStart: number, windowEnd: number) {
  return start < windowEnd && end > windowStart;
}

function confidenceLabel(value: number): GapConfidence {
  if (value >= 0.8) return "high";
  if (value >= 0.55) return "medium";
  return "low";
}

function routeEstimate(input: GapAssessmentInput) {
  if (input.route.result) return { estimatedSeconds: input.route.result.estimatedSeconds };
  if (input.route.approximateSeconds !== null) {
    return { estimatedSeconds: input.route.approximateSeconds };
  }
  return null;
}

function computeConfidence(input: GapAssessmentInput) {
  let value = 0.95;

  if (input.route.status === "same-room") value = 0.99;
  else if (input.route.status === "approximate") value = 0.68;
  else if (input.route.status === "unavailable") value = 0.42;

  if (input.route.accuracy === "Verified outdoor route, indoor estimate") value -= 0.08;
  if (input.gap.previous.locationUnknown) value -= 0.18;
  if (input.gap.next.locationUnknown) value -= 0.18;
  if (input.route.warnings.length > 0) value -= 0.04;

  return Math.round(clamp(value, 0.15, 0.99) * 100) / 100;
}

function riskAdjustedBuffer(input: GapAssessmentInput) {
  const base = input.routePreferences.transitionBufferMinutes;
  if (input.route.status === "approximate") {
    if (input.gapPreferences.riskTolerance === "low") return base + 5;
    if (input.gapPreferences.riskTolerance === "medium") return base + 2;
  }
  if (
    input.route.status === "routed" &&
    input.route.warnings.length > 0 &&
    input.gapPreferences.riskTolerance === "low"
  ) {
    return base + 2;
  }
  return base;
}

function getBaseTags(input: GapAssessmentInput, travelMinutes: number | null): GapTag[] {
  const tags: GapTag[] = [];
  const previous = input.gap.previous;
  const next = input.gap.next;

  if (previous.buildingCode && next.buildingCode && previous.buildingCode === next.buildingCode) {
    tags.push("same-building");
  }
  if (input.route.status === "same-room") tags.push("same-room");
  if (input.route.status === "routed" || input.route.status === "same-room") {
    tags.push("route-verified");
  } else if (input.route.status === "approximate") {
    tags.push("route-estimated");
  } else {
    tags.push("route-unavailable");
  }
  if (previous.locationUnknown || next.locationUnknown) tags.push("location-unknown");
  if (travelMinutes !== null && travelMinutes <= 7) tags.push("nearby-route");
  if (
    input.route.result &&
    input.route.result.totalDistanceMeters > 0 &&
    input.route.result.outdoorDistanceMeters === 0
  ) {
    tags.push("indoor-route");
  }
  if (input.routePreferences.mode === "step-free" && input.route.status !== "unavailable") {
    tags.push("step-free-route");
  }

  return tags;
}

function applyActivityOverhead(usableMinutes: number, setupMinutes: number, packUpMinutes: number) {
  const setup = Math.min(setupMinutes, usableMinutes);
  const remainingAfterSetup = Math.max(0, usableMinutes - setup);
  const packUp = Math.min(packUpMinutes, remainingAfterSetup);
  return {
    setupMinutes: setup,
    packUpMinutes: packUp,
    activityMinutes: Math.max(0, usableMinutes - setup - packUp),
  };
}

function standardTimeline(
  activityLabel: string,
  activityMinutes: number,
  setupMinutes: number,
  packUpMinutes: number,
  travelMinutes: number | null,
  bufferMinutes: number,
): GapTimelineSegment[] {
  const segments: GapTimelineSegment[] = [];
  if (setupMinutes > 0) segments.push({ kind: "setup", label: "Settle in", minutes: setupMinutes });
  if (activityMinutes > 0) {
    segments.push({ kind: "activity", label: activityLabel, minutes: activityMinutes });
  }
  if (packUpMinutes > 0) {
    segments.push({ kind: "setup", label: "Pack up", minutes: packUpMinutes });
  }
  if (travelMinutes === null) {
    if (bufferMinutes > 0) {
      segments.push({
        kind: "buffer",
        label: "Protected transition",
        minutes: bufferMinutes,
      });
    }
  } else {
    if (travelMinutes > 0)
      segments.push({ kind: "travel", label: "Travel", minutes: travelMinutes });
    if (bufferMinutes > 0)
      segments.push({ kind: "buffer", label: "Buffer", minutes: bufferMinutes });
  }
  return segments;
}

function productivityAction(activityMinutes: number): GapAction {
  if (activityMinutes < 10) return "tight-transition";
  if (activityMinutes < 25) return "quick-reset";
  if (activityMinutes < 50) return "focus-sprint";
  if (activityMinutes < 90) return "study-block";
  if (activityMinutes < 150) return "deep-work-block";
  return "flexible-long-gap";
}

function productivityScore(action: GapAction) {
  switch (action) {
    case "tight-transition":
      return SCORE.tightTransition;
    case "quick-reset":
      return SCORE.quickReset;
    case "focus-sprint":
      return SCORE.focusSprint;
    case "study-block":
      return SCORE.studyBlock;
    case "deep-work-block":
      return SCORE.deepWork;
    case "flexible-long-gap":
      return SCORE.flexibleLongGap;
    default:
      return 0;
  }
}

function productivityCopy(action: GapAction, activityMinutes: number) {
  const duration = formatDuration(activityMinutes);
  switch (action) {
    case "tight-transition":
      return {
        title: "Head to your next class",
        summary: "There is not enough dependable free time for a separate activity.",
        label: "Transition",
      };
    case "quick-reset":
      return {
        title: `${duration} quick reset`,
        summary: "Use this for water, the washroom, messages, or a brief mental reset.",
        label: "Quick reset",
      };
    case "focus-sprint":
      return {
        title: `${duration} focus sprint`,
        summary: "A good window for reviewing notes or completing one small, clearly scoped task.",
        label: "Focus sprint",
      };
    case "study-block":
      return {
        title: `${duration} focused study block`,
        summary:
          "Enough protected time for one meaningful study session without rushing the transition.",
        label: "Focused study",
      };
    case "deep-work-block":
      return {
        title: `${duration} deep-work block`,
        summary:
          "Long enough for substantial assignment work, difficult problems, or concentrated reading.",
        label: "Deep work",
      };
    case "flexible-long-gap":
      return {
        title: `${duration} flexible campus block`,
        summary: "Enough time to combine deep work, food, rest, or another substantial activity.",
        label: "Flexible time",
      };
    default:
      return {
        title: "Gap plan",
        summary: "A usable block between classes.",
        label: "Free time",
      };
  }
}

function makeProductivityCandidate(
  input: GapAssessmentInput,
  activityMinutes: number,
  setupMinutes: number,
  packUpMinutes: number,
  travelMinutes: number | null,
  bufferMinutes: number,
  baseTags: GapTag[],
): GapRecommendation {
  const action = productivityAction(activityMinutes);
  const copy = productivityCopy(action, activityMinutes);
  const protectedMinutes = (travelMinutes ?? 0) + bufferMinutes;
  const reasons = [
    protectedMinutes > 0
      ? `${formatDuration(protectedMinutes)} is protected for travel and transition risk.`
      : "Your next class is in the same room, so no walking time is required.",
    activityMinutes >= 25
      ? "Setup and pack-up time are removed before the activity recommendation is made."
      : "The recommendation stays conservative because the usable window is small.",
    input.route.accuracy,
  ];
  const tags = [...baseTags];
  if (action === "tight-transition") tags.push("high-transition-risk");

  return {
    id: `productivity-${action}`,
    action,
    title: copy.title,
    summary: copy.summary,
    score: productivityScore(action),
    activityMinutes,
    reasons,
    tags: unique(tags),
    timeline: standardTimeline(
      copy.label,
      activityMinutes,
      setupMinutes,
      packUpMinutes,
      travelMinutes,
      bufferMinutes,
    ),
  };
}

function makeLocationDependentCandidate(
  input: GapAssessmentInput,
  activityMinutes: number,
  setupMinutes: number,
  packUpMinutes: number,
  travelMinutes: number | null,
  bufferMinutes: number,
  baseTags: GapTag[],
): GapRecommendation {
  const unknownCourses = [input.gap.previous, input.gap.next]
    .filter((meeting) => meeting.locationUnknown)
    .map((meeting) => meeting.courseCode);

  return {
    id: "location-dependent",
    action: "location-dependent",
    title: "Location-dependent gap",
    summary:
      "The available time changes materially depending on where the online, TBA, or unknown class is attended.",
    score: SCORE.locationDependent,
    activityMinutes,
    reasons: [
      `${unique(unknownCourses).join(" and ") || "A class"} does not have a dependable physical location.`,
      `The app is reserving ${formatDuration(bufferMinutes)} rather than inventing a route.`,
      "Treat the shown activity time as an upper-bound estimate until the location is known.",
    ],
    tags: unique([...baseTags, "location-unknown", "route-unavailable"]),
    timeline: standardTimeline(
      "Conditional free time",
      activityMinutes,
      setupMinutes,
      packUpMinutes,
      travelMinutes,
      bufferMinutes,
    ),
  };
}

function makeMealCandidate(
  input: GapAssessmentInput,
  activityMinutes: number,
  setupMinutes: number,
  packUpMinutes: number,
  travelMinutes: number | null,
  bufferMinutes: number,
  baseTags: GapTag[],
): GapRecommendation | null {
  const preferences = input.gapPreferences;
  if (
    !overlaps(
      input.gap.startTime,
      input.gap.endTime,
      preferences.lunchWindowStart,
      preferences.lunchWindowEnd,
    ) ||
    activityMinutes < preferences.mealDurationMinutes
  ) {
    return null;
  }

  const spareMinutes = Math.max(0, activityMinutes - preferences.mealDurationMinutes);
  const title =
    spareMinutes >= 20
      ? `Meal window + ${formatDuration(spareMinutes)} spare`
      : `${formatDuration(activityMinutes)} meal window`;
  const midpoint = (input.gap.startTime + input.gap.endTime) / 2;
  const lunchMidpoint = (preferences.lunchWindowStart + preferences.lunchWindowEnd) / 2;
  const midpointBonus = Math.max(0, 5 - Math.abs(midpoint - lunchMidpoint) / 30);

  return {
    id: "meal-window",
    action: "meal-window",
    title,
    summary:
      "This gap overlaps your lunch window and leaves enough protected time to eat without rushing.",
    score: SCORE.mealWindow + midpointBonus,
    activityMinutes,
    reasons: [
      `Your meal target is ${formatDuration(preferences.mealDurationMinutes)}.`,
      spareMinutes > 0
        ? `${formatDuration(spareMinutes)} remains for studying, resting, or getting food.`
        : "The recommendation uses nearly the full activity window, so choose something nearby.",
      input.route.accuracy,
    ],
    tags: unique([...baseTags, "lunch-time"]),
    timeline: standardTimeline(
      spareMinutes >= 20 ? "Meal + flexible time" : "Meal",
      activityMinutes,
      setupMinutes,
      packUpMinutes,
      travelMinutes,
      bufferMinutes,
    ),
  };
}

function makeHomeCandidate(
  input: GapAssessmentInput,
  bufferMinutes: number,
  baseTags: GapTag[],
): GapRecommendation | null {
  const preferences = input.gapPreferences;
  const commute = preferences.oneWayHomeCommuteMinutes;
  if (!preferences.willingToLeaveCampus || commute === null) return null;

  const homeMinutes =
    input.gap.durationMinutes - commute * 2 - bufferMinutes - preferences.homeTurnaroundMinutes;
  if (homeMinutes < preferences.minimumHomeStayMinutes) return null;

  const timeline: GapTimelineSegment[] = [
    { kind: "travel", label: "Travel home", minutes: commute },
  ];
  if (preferences.homeTurnaroundMinutes > 0) {
    timeline.push({
      kind: "setup",
      label: "Get settled",
      minutes: preferences.homeTurnaroundMinutes,
    });
  }
  timeline.push({ kind: "activity", label: "Time at home", minutes: homeMinutes });
  timeline.push({ kind: "travel", label: "Return to campus", minutes: commute });
  if (bufferMinutes > 0) timeline.push({ kind: "buffer", label: "Buffer", minutes: bufferMinutes });

  return {
    id: "leave-campus",
    action: "leave-campus-candidate",
    title: `${formatDuration(homeMinutes)} at home`,
    summary: "The round trip still leaves enough worthwhile time away from campus.",
    score: SCORE.leaveCampus + Math.min(4, homeMinutes / 120),
    activityMinutes: homeMinutes,
    reasons: [
      `Round-trip commute: ${formatDuration(commute * 2)}.`,
      `Your minimum worthwhile home stay is ${formatDuration(preferences.minimumHomeStayMinutes)}.`,
      `${formatDuration(bufferMinutes)} remains protected before the next class.`,
    ],
    tags: unique([...baseTags, "good-for-commuting"]),
    timeline,
  };
}

function makeResetAlternative(
  activityMinutes: number,
  setupMinutes: number,
  packUpMinutes: number,
  travelMinutes: number | null,
  bufferMinutes: number,
  baseTags: GapTag[],
): GapRecommendation | null {
  if (activityMinutes < 10) return null;
  return {
    id: "reset-alternative",
    action: "quick-reset",
    title: "Low-effort reset",
    summary: "Use the window for food, water, a short walk, or doing nothing on purpose.",
    score: SCORE.resetAlternative,
    activityMinutes,
    reasons: [
      "A lower-intensity option can be more useful than forcing another study session.",
      "Travel and transition protection stay unchanged.",
    ],
    tags: baseTags,
    timeline: standardTimeline(
      "Rest and reset",
      activityMinutes,
      setupMinutes,
      packUpMinutes,
      travelMinutes,
      bufferMinutes,
    ),
  };
}

export function assessGap(input: GapAssessmentInput): GapAssessment {
  const estimate = routeEstimate(input);
  const timing = calculateGapTiming(input.gap, estimate, riskAdjustedBuffer(input));
  const travelMinutes = timing.travelSeconds === null ? null : Math.ceil(timing.travelSeconds / 60);
  const overhead = applyActivityOverhead(
    timing.usableMinutes,
    input.gapPreferences.setupMinutes,
    input.gapPreferences.packUpMinutes,
  );
  const baseTags = getBaseTags(input, travelMinutes);
  const candidates: GapRecommendation[] = [];

  const locationUnknown = input.gap.previous.locationUnknown || input.gap.next.locationUnknown;
  if (locationUnknown && input.gap.durationMinutes < 150) {
    candidates.push(
      makeLocationDependentCandidate(
        input,
        overhead.activityMinutes,
        overhead.setupMinutes,
        overhead.packUpMinutes,
        travelMinutes,
        timing.bufferMinutes,
        baseTags,
      ),
    );
  }

  candidates.push(
    makeProductivityCandidate(
      input,
      overhead.activityMinutes,
      overhead.setupMinutes,
      overhead.packUpMinutes,
      travelMinutes,
      timing.bufferMinutes,
      baseTags,
    ),
  );

  const meal = makeMealCandidate(
    input,
    overhead.activityMinutes,
    overhead.setupMinutes,
    overhead.packUpMinutes,
    travelMinutes,
    timing.bufferMinutes,
    baseTags,
  );
  if (meal) candidates.push(meal);

  const home = makeHomeCandidate(input, timing.bufferMinutes, baseTags);
  if (home) candidates.push(home);

  const reset = makeResetAlternative(
    overhead.activityMinutes,
    overhead.setupMinutes,
    overhead.packUpMinutes,
    travelMinutes,
    timing.bufferMinutes,
    baseTags,
  );
  if (reset) candidates.push(reset);

  const ranked = candidates.sort((a, b) => b.score - a.score);
  const primary = ranked[0]!;
  const alternatives = ranked
    .slice(1)
    .filter((candidate) => candidate.action !== primary.action || candidate.id !== primary.id)
    .slice(0, 2);
  const confidence = computeConfidence(input);
  const warnings = unique([
    ...input.route.warnings,
    ...(locationUnknown
      ? [
          "One or both class locations are online, TBA, or unknown, so the recommendation is conservative.",
        ]
      : []),
    ...(input.route.status === "approximate"
      ? ["Travel time is an approximate building-to-building estimate."]
      : []),
  ]);

  return {
    primary,
    alternatives,
    confidence,
    confidenceLabel: confidenceLabel(confidence),
    travelMinutes,
    bufferMinutes: timing.bufferMinutes,
    leaveByMinutes: timing.leaveByMinutes,
    arrivalMinutes: timing.arrivalMinutes,
    fallback: timing.fallback,
    routeStatus: input.route.status,
    routeAccuracy: input.route.accuracy,
    warnings,
  };
}
