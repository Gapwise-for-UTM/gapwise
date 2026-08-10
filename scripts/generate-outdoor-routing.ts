import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import entranceDataRaw from "../src/data/utm/entrances.geojson?raw";
import { assertRoutingGraphIntegrity } from "../src/features/routing/graph-integrity";
import type {
  AccessibilityStatus,
  RoutingEdge,
  RoutingGraph,
  RoutingNode,
  SourceMetadata,
  VerificationStatus,
} from "../src/features/routing/types";

const OSM_MAP_ENDPOINT = "https://api.openstreetmap.org/api/0.6/map";
const CAMPUS_BOUNDS = "-79.6715,43.5450,-79.6600,43.5524";
const VERIFIED_AT = "2026-08-10";
const MAX_ENTRANCE_CONNECTOR_METERS = 80;
const MAX_TOPOLOGY_CONNECTOR_METERS = 20;
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nodesOutput = resolve(repositoryRoot, "src/data/utm/outdoor-nodes.geojson");
const edgesOutput = resolve(repositoryRoot, "src/data/utm/outdoor-edges.json");

type OsmTags = Record<string, string | undefined>;
type OsmNode = { type: "node"; id: number; lat: number; lon: number; tags?: OsmTags };
type OsmWay = { type: "way"; id: number; nodes: number[]; tags?: OsmTags };
type TaggedOsmWay = OsmWay & { tags: OsmTags };
type OsmPayload = { elements: Array<OsmNode | OsmWay | { type: string }> };
type EntranceFeature = {
  id: string;
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: {
    buildingCode: string;
    label: string;
    kind: "entrance" | "approach";
    osmNodeId: number;
    accessibility: AccessibilityStatus;
    notes?: string;
    source: string;
    sourceUrl: string;
    lastVerified: string;
    verificationStatus: VerificationStatus;
  };
};

const entrances = (JSON.parse(entranceDataRaw) as { features: EntranceFeature[] }).features;

function sourceMetadata(url: string): SourceMetadata {
  return {
    source: "OpenStreetMap",
    sourceUrl: url,
    lastVerified: VERIFIED_AT,
    verificationStatus: "verified",
  };
}

function accessibility(tags: OsmTags | undefined, stairs = false): AccessibilityStatus {
  if (stairs || tags?.["wheelchair"] === "no") return "not_accessible";
  if (tags?.["wheelchair"] === "yes") return "accessible";
  return "unknown";
}

function haversineMeters(a: [number, number], b: [number, number]): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadius = 6_371_000;
  const dLat = radians(b[1] - a[1]);
  const dLon = radians(b[0] - a[0]);
  const lat1 = radians(a[1]);
  const lat2 = radians(b[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(h));
}

async function fetchOsmSnapshot(): Promise<OsmPayload> {
  const url = new URL(OSM_MAP_ENDPOINT);
  url.searchParams.set("bbox", CAMPUS_BOUNDS);
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Gapwise-UTM routing data generator",
    },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`OpenStreetMap map API returned HTTP ${response.status}.`);
  const payload = (await response.json()) as OsmPayload;
  if (!Array.isArray(payload.elements))
    throw new Error("OpenStreetMap response is missing elements.");
  return payload;
}

function isWalkableWay(way: OsmWay): way is TaggedOsmWay {
  if (!way.tags) return false;
  return (
    /^(footway|path|pedestrian|steps|living_street|residential|service)$/.test(
      way.tags["highway"] ?? "",
    ) &&
    way.tags["access"] !== "no" &&
    way.tags["foot"] !== "no"
  );
}

function buildGraph(payload: OsmPayload): RoutingGraph {
  const osmNodes = new Map(
    payload.elements
      .filter((item): item is OsmNode => item.type === "node")
      .map((node) => [node.id, node]),
  );
  const ways = payload.elements
    .filter((item): item is OsmWay => item.type === "way" && "nodes" in item)
    .filter(isWalkableWay)
    .sort((a, b) => a.id - b.id);
  const includedNodeIds = new Set(ways.flatMap((way) => way.nodes));
  const entranceByOsmNode = new Map(
    entrances.map((entrance) => [entrance.properties.osmNodeId, entrance]),
  );
  const wayTagsByNode = new Map<number, OsmTags[]>();

  for (const way of ways) {
    for (const nodeId of way.nodes) {
      const values = wayTagsByNode.get(nodeId) ?? [];
      values.push(way.tags);
      wayTagsByNode.set(nodeId, values);
    }
  }

  const nodes: RoutingNode[] = [...includedNodeIds]
    .sort((a, b) => a - b)
    .map((nodeId) => {
      const node = osmNodes.get(nodeId);
      if (!node) throw new Error(`OSM way references missing node ${nodeId}.`);
      const entrance = entranceByOsmNode.get(nodeId);
      const memberships = wayTagsByNode.get(nodeId) ?? [];
      const onSteps = memberships.some((tags) => tags["highway"] === "steps");
      const atCrossing =
        node.tags?.["highway"] === "crossing" ||
        memberships.some((tags) => tags["footway"] === "crossing");
      const routingNode: RoutingNode = {
        id: `osm-node-${node.id}`,
        kind: entrance
          ? "building-entrance"
          : onSteps
            ? "stairs"
            : atCrossing
              ? "crosswalk"
              : "path-intersection",
        buildingCode: entrance?.properties.buildingCode ?? null,
        floor: null,
        accessibility: entrance?.properties.accessibility ?? accessibility(node.tags, onSteps),
        longitude: node.lon,
        latitude: node.lat,
        metadata: entrance
          ? {
              source: entrance.properties.source,
              sourceUrl: entrance.properties.sourceUrl,
              lastVerified: entrance.properties.lastVerified,
              verificationStatus: entrance.properties.verificationStatus,
            }
          : sourceMetadata(`https://www.openstreetmap.org/node/${node.id}`),
      };
      if (entrance?.properties.label) routingNode.label = entrance.properties.label;
      if (entrance?.properties.notes) routingNode.notes = entrance.properties.notes;
      return routingNode;
    });

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const edges: RoutingEdge[] = [];
  for (const way of ways) {
    const stairs = way.tags["highway"] === "steps";
    for (let index = 0; index < way.nodes.length - 1; index += 1) {
      const from = nodeById.get(`osm-node-${way.nodes[index]!}`);
      const to = nodeById.get(`osm-node-${way.nodes[index + 1]!}`);
      if (
        !from ||
        !to ||
        from.longitude === undefined ||
        from.latitude === undefined ||
        to.longitude === undefined ||
        to.latitude === undefined
      ) {
        throw new Error(`OSM way ${way.id} has an incomplete node pair at index ${index}.`);
      }
      const edge: RoutingEdge = {
        id: `osm-way-${way.id}-${index}`,
        from: from.id,
        to: to.id,
        distanceMeters: haversineMeters(
          [from.longitude, from.latitude],
          [to.longitude, to.latitude],
        ),
        environment: "outdoor",
        stairs,
        bidirectional: way.tags["oneway"] !== "yes",
        accessibility: accessibility(way.tags, stairs),
        metadata: sourceMetadata(`https://www.openstreetmap.org/way/${way.id}`),
      };
      if (way.tags["name"]) edge.notes = way.tags["name"];
      edges.push(edge);
    }
  }

  for (const entrance of entrances) {
    const entranceId = `osm-node-${entrance.properties.osmNodeId}`;
    if (nodeById.has(entranceId)) continue;
    const [longitude, latitude] = entrance.geometry.coordinates;
    const entranceNode: RoutingNode = {
      id: entranceId,
      kind: "building-entrance",
      buildingCode: entrance.properties.buildingCode,
      floor: null,
      accessibility: entrance.properties.accessibility,
      longitude,
      latitude,
      label: entrance.properties.label,
      metadata: {
        source: entrance.properties.source,
        sourceUrl: entrance.properties.sourceUrl,
        lastVerified: entrance.properties.lastVerified,
        verificationStatus: entrance.properties.verificationStatus,
      },
    };
    if (entrance.properties.notes) entranceNode.notes = entrance.properties.notes;
    const nearest = nodes
      .filter((node) => node.longitude !== undefined && node.latitude !== undefined)
      .map((node) => ({
        node,
        distance: haversineMeters([longitude, latitude], [node.longitude!, node.latitude!]),
      }))
      .sort((a, b) => a.distance - b.distance || a.node.id.localeCompare(b.node.id))[0];
    if (!nearest || nearest.distance > MAX_ENTRANCE_CONNECTOR_METERS) {
      throw new Error(
        `${entrance.properties.buildingCode} entrance ${entrance.id} is not within ${MAX_ENTRANCE_CONNECTOR_METERS}m of the pedestrian graph.`,
      );
    }
    nodes.push(entranceNode);
    nodeById.set(entranceNode.id, entranceNode);
    edges.push({
      id: `entrance-connector-${entrance.id}`,
      from: entranceNode.id,
      to: nearest.node.id,
      distanceMeters: Math.max(0.1, nearest.distance),
      environment: "outdoor",
      stairs: false,
      bidirectional: true,
      accessibility:
        entranceNode.accessibility === "accessible" && nearest.node.accessibility === "accessible"
          ? "accessible"
          : "unknown",
      notes: "Short connector from the mapped building point to the nearest pedestrian path.",
      metadata: {
        source: "Gapwise derivation from OpenStreetMap geometry",
        sourceUrl: entrance.properties.sourceUrl,
        lastVerified: VERIFIED_AT,
        verificationStatus: "inferred",
      },
    });
  }

  const adjacency = new Map<string, Set<string>>();
  const addNeighbor = (from: string, to: string) => {
    const neighbors = adjacency.get(from) ?? new Set<string>();
    neighbors.add(to);
    adjacency.set(from, neighbors);
  };
  for (const edge of edges) {
    addNeighbor(edge.from, edge.to);
    addNeighbor(edge.to, edge.from);
  }
  const unvisited = new Set(nodes.map((node) => node.id));
  const components: Set<string>[] = [];
  while (unvisited.size > 0) {
    const first = unvisited.values().next().value as string;
    const component = new Set([first]);
    const queue = [first];
    unvisited.delete(first);
    while (queue.length > 0) {
      for (const neighbor of adjacency.get(queue.pop()!) ?? []) {
        if (!unvisited.delete(neighbor)) continue;
        component.add(neighbor);
        queue.push(neighbor);
      }
    }
    components.push(component);
  }
  components.sort((a, b) => b.size - a.size);
  const mainComponent = components[0] ?? new Set<string>();
  const componentByNode = new Map<string, Set<string>>();
  for (const component of components) {
    for (const nodeId of component) componentByNode.set(nodeId, component);
  }
  const disconnectedEntranceComponents = new Set(
    entrances
      .map((entrance) => componentByNode.get(`osm-node-${entrance.properties.osmNodeId}`))
      .filter((component): component is Set<string> =>
        Boolean(component && component !== mainComponent),
      ),
  );
  for (const component of disconnectedEntranceComponents) {
    let nearest: { from: RoutingNode; to: RoutingNode; distanceMeters: number } | undefined;
    for (const fromId of component) {
      const from = nodeById.get(fromId);
      if (from?.longitude === undefined || from.latitude === undefined) continue;
      for (const toId of mainComponent) {
        const to = nodeById.get(toId);
        if (to?.longitude === undefined || to.latitude === undefined) continue;
        const distanceMeters = haversineMeters(
          [from.longitude, from.latitude],
          [to.longitude, to.latitude],
        );
        if (!nearest || distanceMeters < nearest.distanceMeters) {
          nearest = { from, to, distanceMeters };
        }
      }
    }
    if (!nearest || nearest.distanceMeters > MAX_TOPOLOGY_CONNECTOR_METERS) continue;
    edges.push({
      id: `topology-connector-${nearest.from.id}-${nearest.to.id}`,
      from: nearest.from.id,
      to: nearest.to.id,
      distanceMeters: Math.max(0.1, nearest.distanceMeters),
      environment: "outdoor",
      stairs: false,
      bidirectional: true,
      accessibility: "unknown",
      notes:
        "Short inferred connector between nearby mapped pedestrian fragments; field verification is pending.",
      metadata: {
        source: "Gapwise derivation from OpenStreetMap geometry",
        sourceUrl: "https://www.openstreetmap.org/",
        lastVerified: VERIFIED_AT,
        verificationStatus: "inferred",
      },
    });
  }

  nodes.sort((a, b) => a.id.localeCompare(b.id));
  edges.sort((a, b) => a.id.localeCompare(b.id));
  return { nodes, edges };
}

async function run() {
  const payload = await fetchOsmSnapshot();
  const graph = buildGraph(payload);
  assertRoutingGraphIntegrity(graph);
  const metadata = {
    description:
      "Build-time OpenStreetMap snapshot of UTM pedestrian paths and walkable campus access roads. The application never calls a routing provider at runtime.",
    source: "OpenStreetMap",
    sourceUrl: "https://www.openstreetmap.org/",
    lastVerified: VERIFIED_AT,
    verificationStatus: "verified",
  } as const;
  const nodeGeoJson = {
    type: "FeatureCollection",
    metadata,
    features: graph.nodes.map((node) => ({
      type: "Feature",
      id: node.id,
      geometry: {
        type: "Point",
        coordinates: [node.longitude, node.latitude],
      },
      properties: {
        kind: node.kind,
        buildingCode: node.buildingCode,
        floor: node.floor,
        accessibility: node.accessibility,
        label: node.label,
        notes: node.notes,
        metadata: node.metadata,
      },
    })),
  };
  await writeFile(nodesOutput, `${JSON.stringify(nodeGeoJson)}\n`, "utf8");
  await writeFile(edgesOutput, `${JSON.stringify({ metadata, edges: graph.edges })}\n`, "utf8");
  process.stdout.write(
    `Wrote ${graph.nodes.length} pedestrian nodes and ${graph.edges.length} edges from the ${VERIFIED_AT} OSM snapshot.\n`,
  );
}

run().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
