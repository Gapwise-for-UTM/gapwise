import type { CampusSourceId } from "./provenance";

export type FieldSurveyTargetKind =
  | "official_entrance"
  | "perimeter_completion"
  | "building_connection";

export type FieldSurveyGeometryCandidate = {
  id: string;
  kind: "physical_door_unreconciled" | "approach_only";
  coordinates: readonly [number, number];
  osmNodeId: number;
  notes: string;
};

export type FieldSurveyTarget = {
  id: string;
  buildingCodes: readonly string[];
  label: string;
  targetKind: FieldSurveyTargetKind;
  officialCandidateId?: string;
  officialIdentityId?: string;
  instance?: number;
  levelContext?: string;
  sourceIds: readonly CampusSourceId[];
  geometryCandidates?: readonly FieldSurveyGeometryCandidate[];
  instructions: string;
};

const MN_GEOMETRY_CANDIDATES = [
  {
    id: "mn-osm-13738201127",
    kind: "physical_door_unreconciled",
    coordinates: [-79.6654141, 43.5513221],
    osmNodeId: 13738201127,
    notes:
      "Confirmed physical MN door geometry. Its exact official identity is still unknown because the current OSM tag is entrance=yes, not an official UTM label.",
  },
  {
    id: "mn-osm-13736687034",
    kind: "physical_door_unreconciled",
    coordinates: [-79.6656006, 43.5509053],
    osmNodeId: 13736687034,
    notes:
      "Current OSM entrance=main node near MN. It is not a member of MN's named building way, so field observation is required before assigning it to MN or to an official identity.",
  },
  {
    id: "mn-osm-13736687041",
    kind: "physical_door_unreconciled",
    coordinates: [-79.6662061, 43.5510741],
    osmNodeId: 13736687041,
    notes:
      "Current OSM entrance=main node near MN. It is not a member of MN's named building way, so field observation is required before assigning it to MN or to an official identity.",
  },
] as const satisfies readonly FieldSurveyGeometryCandidate[];

const OPH_GEOMETRY_CANDIDATES = [
  {
    id: "oph-osm-13738728068",
    kind: "physical_door_unreconciled",
    coordinates: [-79.6659355, 43.5486076],
    osmNodeId: 13738728068,
    notes:
      "Mapped physical OPH exterior door. Gapwise must not decide whether this is Main or Rear until a field observation or stronger source closes the identity gap.",
  },
  {
    id: "oph-osm-1728224590",
    kind: "physical_door_unreconciled",
    coordinates: [-79.6656991, 43.548785],
    osmNodeId: 1728224590,
    notes:
      "Mapped physical OPH exterior door. Gapwise must not decide whether this is Main or Rear until a field observation or stronger source closes the identity gap.",
  },
] as const satisfies readonly FieldSurveyGeometryCandidate[];

const EH_APPROACH = [
  {
    id: "eh-osm-1312381405",
    kind: "approach_only",
    coordinates: [-79.665827, 43.5496711],
    osmNodeId: 1312381405,
    notes:
      "Mapped residence approach only. This is not evidence of a physical door and must never be promoted to an entrance by proximity alone.",
  },
] as const satisfies readonly FieldSurveyGeometryCandidate[];

const RIH_APPROACH = [
  {
    id: "rih-osm-1312390438",
    kind: "approach_only",
    coordinates: [-79.6669481, 43.5483514],
    osmNodeId: 1312390438,
    notes:
      "Mapped residence approach only. This is not evidence of a physical door and must never be promoted to an entrance by proximity alone.",
  },
] as const satisfies readonly FieldSurveyGeometryCandidate[];

export const UTM_FIELD_SURVEY_TARGETS = [
  {
    id: "mn-perimeter-completeness",
    buildingCodes: ["MN"],
    label: "MN complete exterior-door perimeter",
    targetKind: "perimeter_completion",
    sourceIds: ["openstreetmap", "utm-facilities-snow-ice"],
    geometryCandidates: MN_GEOMETRY_CANDIDATES,
    instructions:
      "Walk the full exterior perimeter and record every physical exterior door separately, including doors that are locked, service-only, emergency-only, or unlabeled. Record observed restrictions instead of assuming ordinary access.",
  },
  {
    id: "mn-main",
    buildingCodes: ["MN"],
    label: "Main",
    targetKind: "official_entrance",
    officialCandidateId: "utm:entrance-candidate:mn:main",
    sourceIds: ["utm-facilities-snow-ice"],
    geometryCandidates: MN_GEOMETRY_CANDIDATES,
    instructions:
      "Identify the exact physical door corresponding to UTM Facilities' Main barrier-free identity. Do not assign a candidate solely because OSM calls it entrance=main.",
  },
  {
    id: "mn-field-side",
    buildingCodes: ["MN"],
    label: "Field side",
    targetKind: "official_entrance",
    officialCandidateId: "utm:entrance-candidate:mn:field-side",
    sourceIds: ["utm-facilities-snow-ice"],
    geometryCandidates: MN_GEOMETRY_CANDIDATES,
    instructions:
      "Identify the exact exterior door UTM calls Field side and record the route from the adjacent pedestrian path to the threshold.",
  },
  {
    id: "mn-lot-1",
    buildingCodes: ["MN"],
    label: "Lot #1",
    targetKind: "official_entrance",
    officialCandidateId: "utm:entrance-candidate:mn:lot-1",
    sourceIds: ["utm-facilities-snow-ice"],
    geometryCandidates: MN_GEOMETRY_CANDIDATES,
    instructions:
      "Identify the exact exterior door UTM calls Lot #1 and record the route from the adjacent pedestrian path to the threshold.",
  },
  {
    id: "mn-north-2f",
    buildingCodes: ["MN"],
    label: "North entrance",
    targetKind: "official_entrance",
    officialIdentityId: "utm:entrance-identity:mn:north-2f",
    levelContext: "2nd floor",
    sourceIds: ["utoronto-robotics-2025-conference"],
    geometryCandidates: MN_GEOMETRY_CANDIDATES,
    instructions:
      "Find the north exterior entrance named by U of T Robotics, verify its second-floor level context on site, and keep it separate from Facilities' Main/Field side/Lot #1 identities unless the site evidence explicitly links them.",
  },
  {
    id: "cct-hm-link",
    buildingCodes: ["CCT", "HM"],
    label: "CCT / HMALC Link",
    targetKind: "building_connection",
    sourceIds: ["utm-library-cct-entrance", "utm-main-news-cct-hmalc-link"],
    instructions:
      "Walk the complete public connection from CCT to the library/HMALC. Record each door, junction, level change, stairs/elevator choice, segment distance, access restriction, and accessibility observation. Do not use indoor GPS as route geometry; convert the walkthrough into the indoor local-coordinate graph only after the geometry is defensible.",
  },
  {
    id: "eh-main",
    buildingCodes: ["EH"],
    label: "Main",
    targetKind: "official_entrance",
    officialCandidateId: "utm:entrance-candidate:eh:main",
    sourceIds: ["utm-facilities-snow-ice"],
    geometryCandidates: EH_APPROACH,
    instructions:
      "Locate and record the physical Erindale Hall Main entrance. The currently mapped point is only an approach and is not a door coordinate.",
  },
  {
    id: "eh-rear-1",
    buildingCodes: ["EH"],
    label: "Rear 1 of 2",
    targetKind: "official_entrance",
    officialCandidateId: "utm:entrance-candidate:eh:rear",
    instance: 1,
    sourceIds: ["utm-facilities-snow-ice"],
    geometryCandidates: EH_APPROACH,
    instructions:
      "Locate one of the two physical Rear entrances named by UTM Facilities and distinguish it from the second Rear instance with a stable field description.",
  },
  {
    id: "eh-rear-2",
    buildingCodes: ["EH"],
    label: "Rear 2 of 2",
    targetKind: "official_entrance",
    officialCandidateId: "utm:entrance-candidate:eh:rear",
    instance: 2,
    sourceIds: ["utm-facilities-snow-ice"],
    geometryCandidates: EH_APPROACH,
    instructions:
      "Locate the second physical Rear entrance named by UTM Facilities and distinguish it from the first Rear instance with a stable field description.",
  },
  {
    id: "oph-main",
    buildingCodes: ["OPH"],
    label: "Main",
    targetKind: "official_entrance",
    officialCandidateId: "utm:entrance-candidate:oph:main",
    sourceIds: ["utm-facilities-snow-ice", "utm-procurement-oph-main-lobby-2026"],
    geometryCandidates: OPH_GEOMETRY_CANDIDATES,
    instructions:
      "Reconcile the official Main identity to one exact OPH physical door. Two mapped OSM doors are available as candidates, but neither may be selected from proximity alone.",
  },
  {
    id: "oph-rear",
    buildingCodes: ["OPH"],
    label: "Rear",
    targetKind: "official_entrance",
    officialCandidateId: "utm:entrance-candidate:oph:rear",
    sourceIds: ["utm-facilities-snow-ice"],
    geometryCandidates: OPH_GEOMETRY_CANDIDATES,
    instructions:
      "Reconcile the official Rear identity to one exact OPH physical door and record any observed access restriction separately from its barrier-free identity.",
  },
  {
    id: "rih-main",
    buildingCodes: ["RIH"],
    label: "Main",
    targetKind: "official_entrance",
    officialCandidateId: "utm:entrance-candidate:rih:main",
    sourceIds: ["utm-facilities-snow-ice"],
    geometryCandidates: RIH_APPROACH,
    instructions:
      "Locate and record the physical Roy Ivor Hall Main entrance. The currently mapped point is only an approach and is not a door coordinate.",
  },
] as const satisfies readonly FieldSurveyTarget[];

export function fieldSurveyTargetsForBuilding(buildingCode: string) {
  const normalized = buildingCode.trim().toUpperCase();
  return UTM_FIELD_SURVEY_TARGETS.filter((target) => target.buildingCodes.includes(normalized));
}
