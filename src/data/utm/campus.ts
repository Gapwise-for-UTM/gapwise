import type { RoutingGraph, RoutingNode } from "@/features/routing/types";
import { assertRoutingGraphIntegrity } from "@/features/routing/graph-integrity";
import surveyRoutingData from "./generated/survey-routing.json";
import entranceDataRaw from "./entrances.geojson?raw";
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

type EntranceSemanticsFeature = {
  properties: {
    osmNodeId?: number;
    routingNodeId?: string;
    access?: NonNullable<RoutingNode["access"]>;
    direction?: NonNullable<RoutingNode["direction"]>;
  };
};

const entranceSemanticsFeatures = (
  JSON.parse(entranceDataRaw) as { features: EntranceSemanticsFeature[] }
).features;
const entranceSemanticsByNodeId = new Map<string, EntranceSemanticsFeature["properties"]>();
for (const feature of entranceSemanticsFeatures) {
  const explicitId = feature.properties.routingNodeId?.trim();
  const nodeId =
    explicitId ||
    (feature.properties.osmNodeId !== undefined
      ? `osm-node-${feature.properties.osmNodeId}`
      : null);
  if (nodeId) entranceSemanticsByNodeId.set(nodeId, feature.properties);
}

const outdoorNodeFeatures = (JSON.parse(outdoorNodesRaw) as { features: OutdoorNodeFeature[] })
  .features;
const outdoorNodes: RoutingNode[] = outdoorNodeFeatures.map((feature) => {
  const semantics = entranceSemanticsByNodeId.get(feature.id);
  const isEntrance = feature.properties.kind === "building-entrance";
  return {
    id: feature.id,
    ...feature.properties,
    longitude: feature.geometry.coordinates[0],
    latitude: feature.geometry.coordinates[1],
    ...(isEntrance
      ? {
          access: feature.properties.access ?? semantics?.access ?? "unknown",
          direction: feature.properties.direction ?? semantics?.direction ?? "unknown",
        }
      : {}),
  };
});

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
