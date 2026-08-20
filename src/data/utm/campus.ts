import type { RoutingGraph, RoutingNode } from "@/features/routing/types";
import { assertRoutingGraphIntegrity } from "@/features/routing/graph-integrity";
import surveyRoutingData from "./generated/survey-routing.json";
import outdoorEdgesData from "./outdoor-edges.json";
import outdoorNodesRaw from "./outdoor-nodes.geojson?raw";
import {
  CAMPUS_BUILDINGS,
  RESIDENCE_BUILDINGS,
  assertCampusBuildingRoutingIntegrity,
  getCampusBuilding,
  getResidenceBuilding,
} from "./routing-buildings";

export { CAMPUS_BUILDINGS, RESIDENCE_BUILDINGS, getCampusBuilding, getResidenceBuilding };

type OutdoorNodeFeature = {
  id: string;
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: Omit<RoutingNode, "id" | "longitude" | "latitude">;
};

const outdoorNodeFeatures = (JSON.parse(outdoorNodesRaw) as { features: OutdoorNodeFeature[] })
  .features;
const outdoorNodes: RoutingNode[] = outdoorNodeFeatures.map((feature) => ({
  id: feature.id,
  ...feature.properties,
  longitude: feature.geometry.coordinates[0],
  latitude: feature.geometry.coordinates[1],
}));

/** Base navigation points plus deterministic, validated field-survey records. */
const importedSurveyGraph = surveyRoutingData as RoutingGraph;
const importedOutdoorEdges = outdoorEdgesData.edges as RoutingGraph["edges"];

export const UTM_ROUTING_GRAPH: RoutingGraph = {
  nodes: [...outdoorNodes, ...importedSurveyGraph.nodes],
  edges: [...importedOutdoorEdges, ...importedSurveyGraph.edges],
};

assertRoutingGraphIntegrity(UTM_ROUTING_GRAPH);
assertCampusBuildingRoutingIntegrity(
  CAMPUS_BUILDINGS,
  new Set(UTM_ROUTING_GRAPH.nodes.map((node) => node.id)),
);
