export const FIELD_SURVEY_SOURCE_RECORDS = {
  openstreetmap: {
    url: "https://www.openstreetmap.org/copyright",
    note: "Current source-backed physical entrance geometry. Door geometry does not establish an official UTM identity, public access, or accessibility by itself.",
  },
  "utm-facilities-snow-ice": {
    url: "https://www.utm.utoronto.ca/facilities/utm-strategy-snow-and-ice-removal",
    note: "Official UTM barrier-free entrance identities; exact door coordinates are not published by this source.",
  },
  "utm-library-cct-entrance": {
    url: "https://utm.library.utoronto.ca/content/entrance-closure-advisory",
    note: "First-party UTM Library evidence for an entrance from CCT into the library/HMALC connection.",
  },
  "utm-main-news-cct-hmalc-link": {
    url: "https://www.utm.utoronto.ca/main-news/inside-blackwood-gallerys-award-winning-exhibition",
    note: "First-party UTM reporting identifies a doorway joining CCT to HMALC and refers to the CCT Link.",
  },
  "utm-procurement-oph-main-lobby-2026": {
    url: "https://www.merx.com/uoft/solicitations/open-bids/Laundry-Vending-Services-and-Equipment/0000319578",
    note: "Corroborates the OPH Main entrance/lobby identity without selecting an exact exterior door.",
  },
  "utoronto-robotics-2025-conference": {
    url: "https://robotics.utoronto.ca/2025-toronto-robotics-conference/",
    note: "First-party U of T evidence for an MN North entrance with second-floor level context.",
  },
} as const;

export type FieldSurveySourceId = keyof typeof FIELD_SURVEY_SOURCE_RECORDS;

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
  targetKind: "official_entrance" | "perimeter_completion" | "building_connection";
  officialCandidateId?: string;
  officialIdentityId?: string;
  instance?: number;
  levelContext?: string;
  sourceIds: readonly FieldSurveySourceId[];
  geometryCandidates?: readonly FieldSurveyGeometryCandidate[];
  instructions: string;
};

const MN_GEOMETRY_CANDIDATES: readonly FieldSurveyGeometryCandidate[] = [
  {
    id: "mn-osm-13738201127",
    kind: "physical_door_unreconciled",
    coordinates: [-79.6654141, 43.5513221],
    osmNodeId: 13738201127,
    notes: "Confirmed physical MN door geometry; exact official identity remains unresolved.",
  },
  {
    id: "mn-osm-13736687034",
    kind: "physical_door_unreconciled",
    coordinates: [-79.6656006, 43.5509053],
    osmNodeId: 13736687034,
    notes: "OSM entrance=main near MN, but the node lacks strong MN building identity. Field reconciliation is required.",
  },
  {
    id: "mn-osm-13736687041",
    kind: "physical_door_unreconciled",
    coordinates: [-79.6662061, 43.5510741],
    osmNodeId: 13736687041,
    notes: "OSM entrance=main near MN, but the node lacks strong MN building identity. Field reconciliation is required.",
  },
];

const OPH_GEOMETRY_CANDIDATES: readonly FieldSurveyGeometryCandidate[] = [
  {
    id: "oph-osm-13738728068",
    kind: "physical_door_unreconciled",
    coordinates: [-79.6659355, 43.5486076],
    osmNodeId: 13738728068,
    notes: "Mapped physical OPH exterior door; Main versus Rear is unresolved.",
  },
  {
    id: "oph-osm-1728224590",
    kind: "physical_door_unreconciled",
    coordinates: [-79.6656991, 43.548785],
    osmNodeId: 1728224590,
    notes: "Mapped physical OPH exterior door; Main versus Rear is unresolved.",
  },
];

const EH_APPROACH: readonly FieldSurveyGeometryCandidate[] = [
  {
    id: "eh-osm-1312381405",
    kind: "approach_only",
    coordinates: [-79.665827, 43.5496711],
    osmNodeId: 1312381405,
    notes: "Mapped residence approach only; this is not a physical door coordinate.",
  },
];

const RIH_APPROACH: readonly FieldSurveyGeometryCandidate[] = [
  {
    id: "rih-osm-1312390438",
    kind: "approach_only",
    coordinates: [-79.6669481, 43.5483514],
    osmNodeId: 1312390438,
    notes: "Mapped residence approach only; this is not a physical door coordinate.",
  },
];

export const UTM_FIELD_SURVEY_TARGETS: readonly FieldSurveyTarget[] = [
  {
    id: "mn-perimeter-completeness",
    buildingCodes: ["MN"],
    label: "MN complete exterior-door perimeter",
    targetKind: "perimeter_completion",
    sourceIds: ["openstreetmap", "utm-facilities-snow-ice"],
    geometryCandidates: MN_GEOMETRY_CANDIDATES,
    instructions: "Walk the full exterior perimeter and record every physical exterior door separately, including locked, service-only, emergency-only, and unlabeled doors. Record observed restrictions rather than assuming access.",
  },
  {
    id: "mn-main",
    buildingCodes: ["MN"],
    label: "Main",
    targetKind: "official_entrance",
    officialCandidateId: "utm:entrance-candidate:mn:main",
    sourceIds: ["utm-facilities-snow-ice"],
    geometryCandidates: MN_GEOMETRY_CANDIDATES,
    instructions: "Identify the exact physical door corresponding to UTM Facilities' Main identity. Do not assign a candidate solely because OSM calls it entrance=main.",
  },
  {
    id: "mn-field-side",
    buildingCodes: ["MN"],
    label: "Field side",
    targetKind: "official_entrance",
    officialCandidateId: "utm:entrance-candidate:mn:field-side",
    sourceIds: ["utm-facilities-snow-ice"],
    geometryCandidates: MN_GEOMETRY_CANDIDATES,
    instructions: "Identify the exact exterior door UTM calls Field side and record the route from the adjacent pedestrian path to the threshold.",
  },
  {
    id: "mn-lot-1",
    buildingCodes: ["MN"],
    label: "Lot #1",
    targetKind: "official_entrance",
    officialCandidateId: "utm:entrance-candidate:mn:lot-1",
    sourceIds: ["utm-facilities-snow-ice"],
    geometryCandidates: MN_GEOMETRY_CANDIDATES,
    instructions: "Identify the exact exterior door UTM calls Lot #1 and record the route from the adjacent pedestrian path to the threshold.",
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
    instructions: "Find the north exterior entrance named by U of T Robotics, verify its second-floor context, and keep it separate from Facilities' Main/Field side/Lot #1 identities unless site evidence explicitly links them.",
  },
  {
    id: "cct-hm-link",
    buildingCodes: ["CCT", "HM"],
    label: "CCT / HMALC Link",
    targetKind: "building_connection",
    sourceIds: ["utm-library-cct-entrance", "utm-main-news-cct-hmalc-link"],
    instructions: "Walk the complete public connection from CCT to the library/HMALC. Record each door, junction, level change, stairs/elevator choice, segment distance, access restriction, and accessibility observation. Do not use indoor GPS as route geometry.",
  },
  {
    id: "eh-main",
    buildingCodes: ["EH"],
    label: "Main",
    targetKind: "official_entrance",
    officialCandidateId: "utm:entrance-candidate:eh:main",
    sourceIds: ["utm-facilities-snow-ice"],
    geometryCandidates: EH_APPROACH,
    instructions: "Locate and record the physical Erindale Hall Main entrance. The currently mapped point is only an approach and is not a door coordinate.",
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
    instructions: "Locate one of the two Rear entrances and distinguish it from the second Rear instance with a stable field description.",
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
    instructions: "Locate the second Rear entrance and distinguish it from the first Rear instance with a stable field description.",
  },
  {
    id: "oph-main",
    buildingCodes: ["OPH"],
    label: "Main",
    targetKind: "official_entrance",
    officialCandidateId: "utm:entrance-candidate:oph:main",
    sourceIds: ["utm-facilities-snow-ice", "utm-procurement-oph-main-lobby-2026"],
    geometryCandidates: OPH_GEOMETRY_CANDIDATES,
    instructions: "Reconcile the official Main identity to one exact OPH physical door. Two mapped OSM doors are candidates, but neither may be selected from proximity alone.",
  },
  {
    id: "oph-rear",
    buildingCodes: ["OPH"],
    label: "Rear",
    targetKind: "official_entrance",
    officialCandidateId: "utm:entrance-candidate:oph:rear",
    sourceIds: ["utm-facilities-snow-ice"],
    geometryCandidates: OPH_GEOMETRY_CANDIDATES,
    instructions: "Reconcile the official Rear identity to one exact OPH physical door and record observed access restrictions separately from barrier-free identity evidence.",
  },
  {
    id: "rih-main",
    buildingCodes: ["RIH"],
    label: "Main",
    targetKind: "official_entrance",
    officialCandidateId: "utm:entrance-candidate:rih:main",
    sourceIds: ["utm-facilities-snow-ice"],
    geometryCandidates: RIH_APPROACH,
    instructions: "Locate and record the physical Roy Ivor Hall Main entrance. The currently mapped point is only an approach and is not a door coordinate.",
  },
];

export function fieldSurveyTargetsForBuilding(buildingCode: string) {
  const normalized = buildingCode.trim().toUpperCase();
  return UTM_FIELD_SURVEY_TARGETS.filter((target) => target.buildingCodes.includes(normalized));
}
