import { getRecognizedBuilding } from "@/data/utm/building-registry";
import { getCampusBuilding } from "@/data/utm/campus";
import type { TransitionPlanner } from "@/features/routing/transition";
import type { RouteAccuracy, TransitionRoute } from "@/features/routing/types";
import type { UserPreferences } from "@/features/sync/preferences";
import type { Gap, Meeting } from "@/lib/timetable-types";
import { assessGap } from "./assess-gap";
import type { GapConfidence, GapPreferences } from "./types";

export type DestinationLegStatus = "routed" | "approximate" | "same-building" | "unavailable";

export type DestinationLeg = {
  status: DestinationLegStatus;
  route: TransitionRoute | null;
  travelMinutes: number | null;
  accuracy: RouteAccuracy | "Same building; room-to-room indoor travel not mapped";
  warnings: string[];
};

export type GapDestinationFeasibility = {
  status: "feasible" | "tight" | "unavailable";
  destination: { code: string; name: string };
  outbound: DestinationLeg;
  inbound: DestinationLeg;
  totalTravelMinutes: number | null;
  bufferMinutes: number;
  setupMinutes: number;
  packUpMinutes: number;
  activityMinutes: number;
  leaveDestinationByMinutes: number | null;
  arrivalNextClassMinutes: number | null;
  confidence: number;
  confidenceLabel: GapConfidence;
  warnings: string[];
};

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function travelMinutes(route: TransitionRoute) {
  const seconds = route.result?.estimatedSeconds ?? route.approximateSeconds;
  return seconds === null ? null : Math.ceil(seconds / 60);
}

function sameBuildingLeg(): DestinationLeg {
  return {
    status: "same-building",
    route: null,
    travelMinutes: 0,
    accuracy: "Same building; room-to-room indoor travel not mapped",
    warnings: [
      "Same building selected; Gapwise is not claiming room-to-room indoor travel for this leg.",
    ],
  };
}

function unavailableIdentityLeg(warning: string): DestinationLeg {
  return {
    status: "unavailable",
    route: null,
    travelMinutes: null,
    accuracy: "Location unavailable",
    warnings: [warning],
  };
}

function plannedLeg(route: TransitionRoute): DestinationLeg {
  return {
    status: route.status === "same-room" ? "same-building" : route.status,
    route,
    travelMinutes: route.status === "unavailable" ? null : travelMinutes(route),
    accuracy: route.accuracy,
    warnings: route.warnings,
  };
}

function destinationMeeting(gap: Gap, buildingCode: string, buildingName: string): Meeting {
  return {
    id: `gap-destination-${gap.id}-${buildingCode}`,
    courseCode: buildingCode,
    activityType: "OTHER",
    sectionCode: "",
    courseName: buildingName,
    startTime: gap.startTime,
    endTime: gap.endTime,
    weekday: gap.weekday,
    buildingCode,
    room: null,
    term: gap.term,
    locationUnknown: false,
    locationType: "physical",
  };
}

function legConfidence(leg: DestinationLeg) {
  if (leg.status === "unavailable") return 0.2;
  if (leg.status === "same-building") return 0.88;
  if (leg.status === "approximate") return 0.62;

  let value = 0.94;
  if (
    leg.accuracy === "Verified outdoor route, indoor estimate" ||
    leg.accuracy === "Mapped campus path, indoor estimate"
  ) {
    value -= 0.08;
  }
  if (leg.warnings.length > 0) value -= 0.04;
  return value;
}

function confidenceLabel(value: number): GapConfidence {
  if (value >= 0.8) return "high";
  if (value >= 0.55) return "medium";
  return "low";
}

function unavailableResult(
  destination: { code: string; name: string },
  outbound: DestinationLeg,
  inbound: DestinationLeg,
  bufferMinutes: number,
): GapDestinationFeasibility {
  const confidence = Math.min(legConfidence(outbound), legConfidence(inbound));
  return {
    status: "unavailable",
    destination,
    outbound,
    inbound,
    totalTravelMinutes: null,
    bufferMinutes,
    setupMinutes: 0,
    packUpMinutes: 0,
    activityMinutes: 0,
    leaveDestinationByMinutes: null,
    arrivalNextClassMinutes: null,
    confidence,
    confidenceLabel: confidenceLabel(confidence),
    warnings: unique([...outbound.warnings, ...inbound.warnings]),
  };
}

/**
 * Deterministically checks whether a canonical UTM building fits inside an existing gap.
 * The calculation reuses the route planner for both legs and the existing gap engine for
 * its risk-adjusted transition-buffer policy. Recognized buildings without routing coverage
 * remain selectable and fail closed instead of being silently omitted or guessed.
 */
export function assessGapDestination(input: {
  gap: Gap;
  destinationBuildingCode: string;
  preferences: UserPreferences;
  gapPreferences: GapPreferences;
  planTransition: TransitionPlanner;
}): GapDestinationFeasibility | null {
  const { gap, preferences, gapPreferences, planTransition } = input;
  const destinationIdentity = getRecognizedBuilding(input.destinationBuildingCode);
  if (!destinationIdentity) return null;

  const destination = {
    code: destinationIdentity.code,
    name: destinationIdentity.name,
  };
  const routingDestination = getCampusBuilding(destination.code);
  if (!routingDestination) {
    const warning = `Gapwise recognizes ${destination.code}, but mapped routing coverage is unavailable; it will not guess either travel leg.`;
    const unavailable = unavailableIdentityLeg(warning);
    return unavailableResult(
      destination,
      unavailable,
      unavailable,
      preferences.transitionBufferMinutes,
    );
  }

  const syntheticDestination = destinationMeeting(gap, destination.code, destination.name);
  const outbound =
    gap.previous.buildingCode?.toUpperCase() === destination.code
      ? sameBuildingLeg()
      : plannedLeg(planTransition(gap.previous, syntheticDestination, preferences));
  const inbound =
    gap.next.buildingCode?.toUpperCase() === destination.code
      ? sameBuildingLeg()
      : plannedLeg(planTransition(syntheticDestination, gap.next, preferences));

  if (
    outbound.status === "unavailable" ||
    inbound.status === "unavailable" ||
    outbound.travelMinutes === null ||
    inbound.travelMinutes === null
  ) {
    return unavailableResult(destination, outbound, inbound, preferences.transitionBufferMinutes);
  }

  const bufferMinutes =
    inbound.status === "same-building" || !inbound.route
      ? preferences.transitionBufferMinutes
      : assessGap({
          gap,
          route: inbound.route,
          routePreferences: preferences,
          gapPreferences,
        }).bufferMinutes;
  const totalTravelMinutes = outbound.travelMinutes + inbound.travelMinutes;
  const availableAtDestination = Math.max(
    0,
    gap.durationMinutes - totalTravelMinutes - bufferMinutes,
  );
  const setupMinutes = Math.min(gapPreferences.setupMinutes, availableAtDestination);
  const afterSetup = Math.max(0, availableAtDestination - setupMinutes);
  const packUpMinutes = Math.min(gapPreferences.packUpMinutes, afterSetup);
  const activityMinutes = Math.max(0, availableAtDestination - setupMinutes - packUpMinutes);
  const leaveDestinationByMinutes = Math.max(
    0,
    gap.endTime - inbound.travelMinutes - bufferMinutes,
  );
  const arrivalNextClassMinutes = leaveDestinationByMinutes + inbound.travelMinutes;
  const status = activityMinutes > 0 ? "feasible" : "tight";
  let confidence = Math.min(legConfidence(outbound), legConfidence(inbound));
  if (status === "tight") confidence = Math.max(0.15, confidence - 0.08);
  confidence = Math.round(confidence * 100) / 100;

  return {
    status,
    destination,
    outbound,
    inbound,
    totalTravelMinutes,
    bufferMinutes,
    setupMinutes,
    packUpMinutes,
    activityMinutes,
    leaveDestinationByMinutes,
    arrivalNextClassMinutes,
    confidence,
    confidenceLabel: confidenceLabel(confidence),
    warnings: unique([...outbound.warnings, ...inbound.warnings]),
  };
}
