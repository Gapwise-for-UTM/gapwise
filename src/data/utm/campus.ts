import type { RoutingGraph, RoutingNode } from "@/features/routing/types";
import { assertRoutingGraphIntegrity } from "@/features/routing/graph-integrity";
import { CAMPUS_BUILDINGS } from "./routing-buildings";
import surveyRoutingData from "./generated/survey-routing.json";

export { CAMPUS_BUILDINGS, getCampusBuilding } from "./routing-buildings";

const ENTRANCE_NODES: RoutingNode[] = CAMPUS_BUILDINGS.map((building) => ({
  id: building.entranceNodeId,
  kind: "building-entrance",
  buildingCode: building.code,
  floor: null,
  accessibility: "unknown",
  longitude: building.navigationPoint[0],
  latitude: building.navigationPoint[1],
  label: `${building.code} mapped entrance`,
  metadata: building.metadata,
}));

/** Base navigation points plus deterministic, validated field-survey records. */
const importedSurveyGraph = surveyRoutingData as RoutingGraph;

export const UTM_ROUTING_GRAPH: RoutingGraph = {
  nodes: [...ENTRANCE_NODES, ...importedSurveyGraph.nodes],
  edges: importedSurveyGraph.edges,
};

assertRoutingGraphIntegrity(UTM_ROUTING_GRAPH);
