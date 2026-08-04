import { getRecognizedBuilding } from "./building-registry";
import { CAMPUS_BUILDINGS } from "./routing-buildings";
import { routingGraphIssues } from "@/features/routing/graph-integrity";
import type {
  AccessibilityStatus,
  RoutingEdge,
  RoutingGraph,
  RoutingNode,
  SourceMetadata,
} from "@/features/routing/types";

export const SURVEY_NODE_KINDS = [
  "entrance",
  "hallway",
  "junction",
  "room",
  "stairs",
  "elevator",
  "door",
  "outdoor_path",
] as const;
export type SurveyNodeKind = (typeof SURVEY_NODE_KINDS)[number];

export const SURVEY_ENVIRONMENTS = ["indoor", "outdoor", "covered"] as const;
export type SurveyEnvironment = (typeof SURVEY_ENVIRONMENTS)[number];

export const ACCESSIBILITY_STATES = [
  "accessible",
  "not_accessible",
  "unknown",
] as const satisfies readonly AccessibilityStatus[];

export type CampusSurvey = {
  schemaVersion: 1;
  survey: {
    date: string;
    source: string;
    sourceUrl: string;
    notes: string;
  };
  buildings: Array<{
    code: string;
    floors: string[];
  }>;
  nodes: SurveyNode[];
  edges: SurveyEdge[];
};

export type SurveyNode = {
  id: string;
  building: string | null;
  floor: string | null;
  kind: SurveyNodeKind;
  labelOrRoom: string;
  accessibility: AccessibilityStatus;
  longitude?: number;
  latitude?: number;
  indoorX?: number;
  indoorY?: number;
  photoReference?: string;
  notes?: string;
};

export type SurveyEdge = {
  id: string;
  connectedFrom: string;
  connectedTo: string;
  distanceMeters: number;
  environment: SurveyEnvironment;
  stairs: boolean;
  accessibility: AccessibilityStatus;
  bidirectional: boolean;
  photoReference?: string;
  notes?: string;
};

export type SurveyRoutingData = RoutingGraph & {
  schemaVersion: 1;
  surveyDate: string;
};

export class SurveyValidationError extends Error {
  constructor(readonly issues: string[]) {
    super(`Campus survey validation failed:\n- ${issues.join("\n- ")}`);
    this.name = "SurveyValidationError";
  }
}

type UnknownRecord = Record<string, unknown>;

const ID_PATTERN = /^[a-z0-9][a-z0-9._:-]*$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ACCESSIBILITY = new Set<string>(ACCESSIBILITY_STATES);
const NODE_KINDS = new Set<string>(SURVEY_NODE_KINDS);
const ENVIRONMENTS = new Set<string>(SURVEY_ENVIRONMENTS);

const BASE_NODES = new Map(
  CAMPUS_BUILDINGS.map((building) => [
    building.entranceNodeId,
    {
      id: building.entranceNodeId,
      kind: "building-entrance" as const,
      buildingCode: building.code,
      floor: null,
      accessibility: "unknown" as const,
      longitude: building.navigationPoint[0],
      latitude: building.navigationPoint[1],
    },
  ]),
);

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(
  value: UnknownRecord,
  allowed: readonly string[],
  path: string,
  issues: string[],
) {
  const allowedKeys = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) issues.push(`${path}.${key} is not a supported field.`);
  }
}

function isValidDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function optionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

function pairIsPresent(a: unknown, b: unknown): boolean {
  return a !== undefined && b !== undefined;
}

function validateNodeShape(value: unknown, index: number, issues: string[]): value is SurveyNode {
  const path = `nodes[${index}]`;
  if (!isRecord(value)) {
    issues.push(`${path} must be an object.`);
    return false;
  }
  const initialIssueCount = issues.length;
  hasOnlyKeys(
    value,
    [
      "id",
      "building",
      "floor",
      "kind",
      "labelOrRoom",
      "accessibility",
      "longitude",
      "latitude",
      "indoorX",
      "indoorY",
      "photoReference",
      "notes",
    ],
    path,
    issues,
  );
  if (typeof value["id"] !== "string" || !ID_PATTERN.test(value["id"])) {
    issues.push(
      `${path}.id must use lowercase letters, numbers, dots, colons, underscores, or hyphens.`,
    );
  }
  if (value["building"] !== null && typeof value["building"] !== "string") {
    issues.push(`${path}.building must be an uppercase building code or null.`);
  }
  if (value["floor"] !== null && typeof value["floor"] !== "string") {
    issues.push(`${path}.floor must be a declared floor or null.`);
  }
  if (typeof value["kind"] !== "string" || !NODE_KINDS.has(value["kind"])) {
    issues.push(`${path}.kind is not a supported node kind.`);
  }
  if (typeof value["labelOrRoom"] !== "string" || !value["labelOrRoom"].trim()) {
    issues.push(`${path}.labelOrRoom must not be empty.`);
  }
  if (typeof value["accessibility"] !== "string" || !ACCESSIBILITY.has(value["accessibility"])) {
    issues.push(`${path}.accessibility must be accessible, not_accessible, or unknown.`);
  }
  for (const coordinate of ["longitude", "latitude", "indoorX", "indoorY"] as const) {
    if (value[coordinate] !== undefined && !isFiniteNumber(value[coordinate])) {
      issues.push(`${path}.${coordinate} must be a finite number when provided.`);
    }
  }
  if (!optionalString(value["photoReference"])) {
    issues.push(`${path}.photoReference must be a string when provided.`);
  }
  if (!optionalString(value["notes"])) issues.push(`${path}.notes must be a string when provided.`);
  return issues.length === initialIssueCount;
}

function validateEdgeShape(value: unknown, index: number, issues: string[]): value is SurveyEdge {
  const path = `edges[${index}]`;
  if (!isRecord(value)) {
    issues.push(`${path} must be an object.`);
    return false;
  }
  const initialIssueCount = issues.length;
  hasOnlyKeys(
    value,
    [
      "id",
      "connectedFrom",
      "connectedTo",
      "distanceMeters",
      "environment",
      "stairs",
      "accessibility",
      "bidirectional",
      "photoReference",
      "notes",
    ],
    path,
    issues,
  );
  if (typeof value["id"] !== "string" || !ID_PATTERN.test(value["id"])) {
    issues.push(
      `${path}.id must use lowercase letters, numbers, dots, colons, underscores, or hyphens.`,
    );
  }
  for (const endpoint of ["connectedFrom", "connectedTo"] as const) {
    if (typeof value[endpoint] !== "string" || !value[endpoint]) {
      issues.push(`${path}.${endpoint} must name a node ID.`);
    }
  }
  if (
    !isFiniteNumber(value["distanceMeters"]) ||
    value["distanceMeters"] <= 0 ||
    value["distanceMeters"] > 5_000
  ) {
    issues.push(`${path}.distanceMeters must be greater than 0 and at most 5000.`);
  }
  if (typeof value["environment"] !== "string" || !ENVIRONMENTS.has(value["environment"])) {
    issues.push(`${path}.environment must be indoor, outdoor, or covered.`);
  }
  if (typeof value["stairs"] !== "boolean") issues.push(`${path}.stairs must be true or false.`);
  if (typeof value["accessibility"] !== "string" || !ACCESSIBILITY.has(value["accessibility"])) {
    issues.push(`${path}.accessibility must be accessible, not_accessible, or unknown.`);
  }
  if (typeof value["bidirectional"] !== "boolean") {
    issues.push(`${path}.bidirectional must be true or false.`);
  }
  if (!optionalString(value["photoReference"])) {
    issues.push(`${path}.photoReference must be a string when provided.`);
  }
  if (!optionalString(value["notes"])) issues.push(`${path}.notes must be a string when provided.`);
  return issues.length === initialIssueCount;
}

export function validateCampusSurvey(input: unknown): CampusSurvey {
  const issues: string[] = [];
  if (!isRecord(input)) throw new SurveyValidationError(["The survey root must be an object."]);
  hasOnlyKeys(
    input,
    ["$schema", "schemaVersion", "survey", "buildings", "nodes", "edges"],
    "survey",
    issues,
  );
  if (input["schemaVersion"] !== 1) issues.push("schemaVersion must be 1.");

  const surveyMetadata = input["survey"];
  if (!isRecord(surveyMetadata)) {
    issues.push("survey must be an object.");
  } else {
    hasOnlyKeys(surveyMetadata, ["date", "source", "sourceUrl", "notes"], "survey", issues);
    if (typeof surveyMetadata["date"] !== "string" || !isValidDate(surveyMetadata["date"])) {
      issues.push("survey.date must be a real date in YYYY-MM-DD format.");
    }
    if (typeof surveyMetadata["source"] !== "string" || !surveyMetadata["source"].trim()) {
      issues.push("survey.source must not be empty.");
    }
    for (const field of ["sourceUrl", "notes"] as const) {
      if (typeof surveyMetadata[field] !== "string")
        issues.push(`survey.${field} must be a string.`);
    }
  }

  const buildings = input["buildings"];
  const declaredBuildings = new Map<string, Set<string>>();
  if (!Array.isArray(buildings)) {
    issues.push("buildings must be an array.");
  } else {
    buildings.forEach((value, index) => {
      const path = `buildings[${index}]`;
      if (!isRecord(value)) {
        issues.push(`${path} must be an object.`);
        return;
      }
      hasOnlyKeys(value, ["code", "floors"], path, issues);
      const code = value["code"];
      if (typeof code !== "string" || code !== code.toUpperCase() || !getRecognizedBuilding(code)) {
        issues.push(`${path}.code must be a recognized uppercase UTM building code.`);
        return;
      }
      if (declaredBuildings.has(code)) issues.push(`Duplicate building code “${code}”.`);
      if (!Array.isArray(value["floors"])) {
        issues.push(`${path}.floors must be an array.`);
        return;
      }
      const floors = new Set<string>();
      value["floors"].forEach((floor, floorIndex) => {
        if (typeof floor !== "string" || !floor.trim()) {
          issues.push(`${path}.floors[${floorIndex}] must be a non-empty string.`);
        } else if (floors.has(floor)) {
          issues.push(`${path} contains duplicate floor “${floor}”.`);
        } else {
          floors.add(floor);
        }
      });
      declaredBuildings.set(code, floors);
    });
  }

  const rawNodes = input["nodes"];
  const nodes: SurveyNode[] = [];
  const entityIds = new Set<string>(BASE_NODES.keys());
  if (!Array.isArray(rawNodes)) {
    issues.push("nodes must be an array.");
  } else {
    rawNodes.forEach((value, index) => {
      if (!validateNodeShape(value, index, issues)) return;
      const node = value as SurveyNode;
      nodes.push(node);
      if (entityIds.has(node.id)) {
        issues.push(`Duplicate or reserved ID “${node.id}” at nodes[${index}].id.`);
      }
      entityIds.add(node.id);

      const buildingFloors = node.building ? declaredBuildings.get(node.building) : undefined;
      if (node.building && node.building !== node.building.toUpperCase()) {
        issues.push(`nodes[${index}].building must be uppercase.`);
      }
      if (node.building && !buildingFloors) {
        issues.push(`nodes[${index}].building “${node.building}” is not declared in buildings.`);
      }
      if (node.floor && (!buildingFloors || !buildingFloors.has(node.floor))) {
        issues.push(
          `nodes[${index}].floor “${node.floor}” is not declared for ${node.building ?? "an outdoor node"}.`,
        );
      }

      const hasGeo = pairIsPresent(node.longitude, node.latitude);
      const hasIndoor = pairIsPresent(node.indoorX, node.indoorY);
      if ((node.longitude === undefined) !== (node.latitude === undefined)) {
        issues.push(`nodes[${index}] must provide longitude and latitude together.`);
      }
      if ((node.indoorX === undefined) !== (node.indoorY === undefined)) {
        issues.push(`nodes[${index}] must provide indoorX and indoorY together.`);
      }
      if (isFiniteNumber(node.longitude) && (node.longitude < -180 || node.longitude > 180)) {
        issues.push(`nodes[${index}].longitude must be between -180 and 180.`);
      }
      if (isFiniteNumber(node.latitude) && (node.latitude < -90 || node.latitude > 90)) {
        issues.push(`nodes[${index}].latitude must be between -90 and 90.`);
      }
      if (node.kind === "outdoor_path") {
        if (node.building !== null || node.floor !== null) {
          issues.push(`nodes[${index}] outdoor_path nodes must use null building and floor.`);
        }
        if (!hasGeo)
          issues.push(`nodes[${index}] outdoor_path nodes require longitude and latitude.`);
      } else if (node.kind === "entrance") {
        if (!node.building) issues.push(`nodes[${index}] entrance nodes require a building.`);
        if (!hasGeo) issues.push(`nodes[${index}] entrance nodes require longitude and latitude.`);
      } else {
        if (!node.building || !node.floor) {
          issues.push(`nodes[${index}] ${node.kind} nodes require a building and floor.`);
        }
        if (!hasIndoor)
          issues.push(`nodes[${index}] ${node.kind} nodes require indoorX and indoorY.`);
      }
    });
  }

  const rawEdges = input["edges"];
  const edges: SurveyEdge[] = [];
  const nodeIds = new Set<string>([...BASE_NODES.keys(), ...nodes.map((node) => node.id)]);
  if (!Array.isArray(rawEdges)) {
    issues.push("edges must be an array.");
  } else {
    rawEdges.forEach((value, index) => {
      if (!validateEdgeShape(value, index, issues)) return;
      const edge = value as SurveyEdge;
      edges.push(edge);
      if (entityIds.has(edge.id)) issues.push(`Duplicate ID “${edge.id}” at edges[${index}].id.`);
      entityIds.add(edge.id);
      if (!nodeIds.has(edge.connectedFrom)) {
        issues.push(
          `edges[${index}].connectedFrom references missing node “${edge.connectedFrom}”.`,
        );
      }
      if (!nodeIds.has(edge.connectedTo)) {
        issues.push(`edges[${index}].connectedTo references missing node “${edge.connectedTo}”.`);
      }
      if (edge.connectedFrom === edge.connectedTo) {
        issues.push(`edges[${index}] cannot connect a node to itself.`);
      }
      if (edge.stairs && edge.accessibility === "accessible") {
        issues.push(`edges[${index}] cannot be both stairs and accessible.`);
      }
    });
  }

  const nodeLookup = new Map<
    string,
    Pick<RoutingNode, "id" | "buildingCode" | "floor" | "longitude" | "latitude">
  >(BASE_NODES);
  nodes.forEach((node) => {
    nodeLookup.set(node.id, {
      id: node.id,
      buildingCode: node.building,
      floor: node.floor,
      ...(node.longitude !== undefined ? { longitude: node.longitude } : {}),
      ...(node.latitude !== undefined ? { latitude: node.latitude } : {}),
    });
  });
  const connected = new Set<string>();
  const connections = new Set<string>();
  edges.forEach((edge, index) => {
    const from = nodeLookup.get(edge.connectedFrom);
    const to = nodeLookup.get(edge.connectedTo);
    if (!from || !to) return;
    connected.add(from.id);
    connected.add(to.id);
    const connectionKey = edge.bidirectional
      ? [from.id, to.id].sort().join("|")
      : `${from.id}>${to.id}`;
    if (connections.has(connectionKey)) {
      issues.push(`edges[${index}] duplicates the connection between “${from.id}” and “${to.id}”.`);
    }
    connections.add(connectionKey);
    if (
      edge.environment === "indoor" &&
      (!from.buildingCode || from.buildingCode !== to.buildingCode)
    ) {
      issues.push(`edges[${index}] indoor endpoints must belong to the same building.`);
    }
    if (
      edge.environment === "outdoor" &&
      (from.longitude === undefined ||
        from.latitude === undefined ||
        to.longitude === undefined ||
        to.latitude === undefined)
    ) {
      issues.push(`edges[${index}] outdoor endpoints require longitude and latitude.`);
    }
    const fromNode = nodes.find((node) => node.id === from.id);
    const toNode = nodes.find((node) => node.id === to.id);
    if (edge.stairs && fromNode?.kind !== "stairs" && toNode?.kind !== "stairs") {
      issues.push(`edges[${index}] has stairs=true but neither endpoint is a stairs node.`);
    }
  });
  nodes.forEach((node, index) => {
    if (!connected.has(node.id)) issues.push(`nodes[${index}] “${node.id}” is isolated.`);
  });

  if (issues.length > 0) throw new SurveyValidationError(issues);
  return input as CampusSurvey;
}

function productionKind(kind: SurveyNodeKind): RoutingNode["kind"] {
  if (kind === "entrance") return "building-entrance";
  if (kind === "junction" || kind === "outdoor_path") return "path-intersection";
  return kind;
}

export function convertSurveyToRoutingData(input: unknown): SurveyRoutingData {
  const survey = validateCampusSurvey(input);
  const metadata: SourceMetadata = {
    source: survey.survey.source,
    sourceUrl: survey.survey.sourceUrl,
    lastVerified: survey.survey.date,
    verificationStatus: "verified",
  };
  const nodes: RoutingNode[] = survey.nodes
    .map((node) => ({
      id: node.id,
      kind: productionKind(node.kind),
      buildingCode: node.building,
      floor: node.floor,
      accessibility: node.accessibility,
      ...(node.longitude !== undefined ? { longitude: node.longitude } : {}),
      ...(node.latitude !== undefined ? { latitude: node.latitude } : {}),
      ...(node.indoorX !== undefined ? { indoorX: node.indoorX } : {}),
      ...(node.indoorY !== undefined ? { indoorY: node.indoorY } : {}),
      ...(node.kind === "room" ? { room: node.labelOrRoom } : { label: node.labelOrRoom }),
      ...(node.photoReference ? { photoReference: node.photoReference } : {}),
      ...(node.notes ? { notes: node.notes } : {}),
      metadata,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const edges: RoutingEdge[] = survey.edges
    .map((edge) => ({
      id: edge.id,
      from: edge.connectedFrom,
      to: edge.connectedTo,
      distanceMeters: edge.distanceMeters,
      environment: edge.environment,
      stairs: edge.stairs,
      accessibility: edge.accessibility,
      bidirectional: edge.bidirectional,
      ...(edge.photoReference ? { photoReference: edge.photoReference } : {}),
      ...(edge.notes ? { notes: edge.notes } : {}),
      metadata,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const combinedGraph: RoutingGraph = { nodes: [...BASE_NODES.values(), ...nodes], edges };
  const graphIssues = routingGraphIssues(combinedGraph);
  if (graphIssues.length > 0) throw new SurveyValidationError(graphIssues);

  return { schemaVersion: 1, surveyDate: survey.survey.date, nodes, edges };
}
