import { DEFAULT_ROUTE_PREFERENCES } from "@/config/routing";
import { UTM_ROUTING_GRAPH } from "@/data/utm/campus";
import { findBestRoute, findRoute } from "@/features/routing/engine";
import type { RouteResult, RoutingGraph } from "@/features/routing/types";

const graph: RoutingGraph = {
  nodes: [
    {
      id: "a",
      kind: "path-intersection",
      buildingCode: null,
      floor: null,
      accessibility: "unknown",
      longitude: -79.0,
      latitude: 43.0,
    },
    {
      id: "b",
      kind: "path-intersection",
      buildingCode: null,
      floor: null,
      accessibility: "unknown",
      longitude: -79.001,
      latitude: 43.001,
    },
  ],
  edges: [
    {
      id: "ab",
      from: "a",
      to: "b",
      distanceMeters: 150,
      environment: "outdoor",
      stairs: false,
      bidirectional: true,
      accessibility: "unknown",
    },
  ],
};

function expectCoordinatesFollowNodes(route: RouteResult) {
  let coordinateIndex = 0;
  for (const node of route.nodes) {
    if (node.longitude === undefined || node.latitude === undefined) continue;
    const nextIndex = route.coordinates.findIndex(
      (coordinate, index) =>
        index >= coordinateIndex &&
        coordinate[0] === node.longitude &&
        coordinate[1] === node.latitude,
    );
    expect(nextIndex).toBeGreaterThanOrEqual(coordinateIndex);
    coordinateIndex = nextIndex;
  }
}

const endpoints = (code: string) =>
  UTM_ROUTING_GRAPH.nodes
    .filter((node) => node.kind === "building-entrance" && node.buildingCode === code)
    .map((node) => node.id);

test("reverse traversal fallback coordinates follow the selected direction", () => {
  const route = findRoute(graph, "b", "a", DEFAULT_ROUTE_PREFERENCES);
  expect(route?.nodes.map((node) => node.id)).toEqual(["b", "a"]);
  expect(route?.coordinates).toEqual([
    [-79.001, 43.001],
    [-79.0, 43.0],
  ]);
});

test("explicit edge geometry is reversed exactly once", () => {
  const shaped: RoutingGraph = {
    nodes: graph.nodes,
    edges: [
      {
        ...graph.edges[0]!,
        geometry: [
          [-79.0, 43.0],
          [-79.0005, 43.0005],
          [-79.001, 43.001],
        ],
      },
    ],
  };
  expect(findRoute(shaped, "b", "a", DEFAULT_ROUTE_PREFERENCES)?.coordinates).toEqual([
    [-79.001, 43.001],
    [-79.0005, 43.0005],
    [-79.0, 43.0],
  ]);
});

test("IB and DV use a short optimizer-selected route whose drawing follows every route node", () => {
  for (const [from, to] of [
    ["IB", "DV"],
    ["DV", "IB"],
  ] as const) {
    const route = findBestRoute(
      UTM_ROUTING_GRAPH,
      endpoints(from),
      endpoints(to),
      DEFAULT_ROUTE_PREFERENCES,
    );
    expect(route).not.toBeNull();
    expect(route!.totalDistanceMeters).toBeLessThan(500);
    const first = route!.nodes[0]!;
    const last = route!.nodes.at(-1)!;
    expect(route!.coordinates[0]).toEqual([first.longitude, first.latitude]);
    expect(route!.coordinates.at(-1)).toEqual([last.longitude, last.latitude]);
    expectCoordinatesFollowNodes(route!);
  }
});
