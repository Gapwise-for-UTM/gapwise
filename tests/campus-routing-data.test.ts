import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { DEFAULT_ROUTE_PREFERENCES, ROUTING_DEFAULTS } from "@/config/routing";
import { getCampusBuildingFootprint } from "@/data/utm/building-footprints";
import { UTM_BUILDINGS, UTM_RESIDENCES } from "@/data/utm/building-registry";
import { CAMPUS_BUILDINGS, RESIDENCE_BUILDINGS, UTM_ROUTING_GRAPH } from "@/data/utm/campus";
import { findRoute } from "@/features/routing/engine";
import type { RoutingGraph } from "@/features/routing/types";

function dijkstraFastestSeconds(graph: RoutingGraph, startId: string, endId: string): number {
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const adjacency = new Map<
    string,
    Array<{ edge: RoutingGraph["edges"][number]; from: string; to: string }>
  >();
  const add = (edge: RoutingGraph["edges"][number], from: string, to: string) => {
    const traversals = adjacency.get(from) ?? [];
    traversals.push({ edge, from, to });
    adjacency.set(from, traversals);
  };
  for (const edge of graph.edges) {
    add(edge, edge.from, edge.to);
    if (edge.bidirectional) add(edge, edge.to, edge.from);
  }

  const distances = new Map([[startId, 0]]);
  const queue = [{ id: startId, cost: 0 }];
  while (queue.length > 0) {
    queue.sort((a, b) => b.cost - a.cost || b.id.localeCompare(a.id));
    const current = queue.pop()!;
    if (current.cost !== distances.get(current.id)) continue;
    if (current.id === endId) return current.cost;
    for (const traversal of adjacency.get(current.id) ?? []) {
      const from = nodes.get(traversal.from)!;
      const to = nodes.get(traversal.to)!;
      let cost = traversal.edge.distanceMeters / DEFAULT_ROUTE_PREFERENCES.walkingSpeedMps;
      if (from.buildingCode !== to.buildingCode && (!from.buildingCode || !to.buildingCode)) {
        cost += ROUTING_DEFAULTS.buildingEntryExitSeconds;
      }
      if (from.kind === "crosswalk" || to.kind === "crosswalk") {
        cost += ROUTING_DEFAULTS.crosswalkDelaySeconds;
      }
      cost += traversal.edge.estimatedDelaySeconds ?? 0;
      const candidate = current.cost + cost;
      if (candidate >= (distances.get(traversal.to) ?? Number.POSITIVE_INFINITY)) continue;
      distances.set(traversal.to, candidate);
      queue.push({ id: traversal.to, cost: candidate });
    }
  }
  return Number.POSITIVE_INFINITY;
}

describe("bundled UTM routing data", () => {
  test("keeps routing coverage explicit while canonical identity covers every recognized building", () => {
    const recognizedCodes = new Set(UTM_BUILDINGS.map((building) => building.code));
    for (const building of CAMPUS_BUILDINGS) {
      expect(recognizedCodes.has(building.code)).toBe(true);
    }
    for (const building of UTM_BUILDINGS) {
      expect(getCampusBuildingFootprint(building.code)).not.toBeNull();
    }

    // Every residence currently offered as a personalized home origin remains routable.
    expect(RESIDENCE_BUILDINGS.map((building) => building.code).sort()).toEqual(
      UTM_RESIDENCES.map((building) => building.code).sort(),
    );
    expect(RESIDENCE_BUILDINGS.map((building) => building.code).sort()).toEqual([
      "EH",
      "LL",
      "MC",
      "MV",
      "NRB",
      "OPH",
      "PP",
      "RIH",
      "SW",
    ]);
  });

  test("gives every mapped point explicit provenance and confidence", () => {
    for (const building of CAMPUS_BUILDINGS) {
      expect(building.entrances.length).toBeGreaterThan(0);
      for (const entrance of building.entrances) {
        expect(entrance.metadata.source.length).toBeGreaterThan(0);
        expect(entrance.metadata.sourceUrl).toStartWith("https://");
        expect(entrance.metadata.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(entrance.routingNodeId.length).toBeGreaterThan(0);
        expect(entrance.verificationMethod.length).toBeGreaterThan(0);
        expect(entrance.sourceIdentifier.length).toBeGreaterThan(0);
        if (entrance.kind === "approach") {
          expect(entrance.metadata.verificationStatus).toBe("inferred");
          expect(entrance.notes?.length).toBeGreaterThan(0);
        }
      }
    }
  });

  test("keeps disconnected entrance inventory explicit instead of pretending it is routable", () => {
    const origin = CAMPUS_BUILDINGS.find((building) => building.code === "MN")!;
    const disconnected = CAMPUS_BUILDINGS.filter(
      (building) =>
        !building.entrances.some((entrance) =>
          findRoute(
            UTM_ROUTING_GRAPH,
            origin.entranceNodeId,
            entrance.routingNodeId,
            DEFAULT_ROUTE_PREFERENCES,
          ),
        ),
    );

    expect(disconnected.map((building) => building.code).sort()).toEqual(["NSB"]);
    expect(disconnected[0]?.entrances.map((entrance) => entrance.osmNodeId).sort()).toEqual([
      13568522572, 13731083800,
    ]);
  });

  test("answers every pair inside the main campus routing component", () => {
    const origin = CAMPUS_BUILDINGS.find((building) => building.code === "MN")!;
    const connectedBuildings = CAMPUS_BUILDINGS.flatMap((building) => {
      const connectedEntrance = building.entrances.find((entrance) =>
        findRoute(
          UTM_ROUTING_GRAPH,
          origin.entranceNodeId,
          entrance.routingNodeId,
          DEFAULT_ROUTE_PREFERENCES,
        ),
      );
      return connectedEntrance ? [{ building, connectedEntrance }] : [];
    });

    for (const originBuilding of connectedBuildings) {
      expect(
        findRoute(
          UTM_ROUTING_GRAPH,
          origin.entranceNodeId,
          originBuilding.building.entranceNodeId,
          DEFAULT_ROUTE_PREFERENCES,
        ),
      ).not.toBeNull();
      for (const destinationBuilding of connectedBuildings) {
        const route = findRoute(
          UTM_ROUTING_GRAPH,
          originBuilding.connectedEntrance.routingNodeId,
          destinationBuilding.connectedEntrance.routingNodeId,
          DEFAULT_ROUTE_PREFERENCES,
        );
        expect(route).not.toBeNull();
        expect(route!.totalDistanceMeters).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test("keeps the reviewed Five Minute Walk shortcut explicit and sourced", () => {
    const connector = UTM_ROUTING_GRAPH.edges.find(
      (edge) => edge.id === "reviewed-topology-connector-five-minute-walk-east-link",
    );
    expect(connector).toMatchObject({
      from: "osm-node-10307668718",
      to: "osm-node-1728239086",
      bidirectional: true,
      metadata: {
        verificationStatus: "inferred",
        sourceUrl: "https://www.utm.utoronto.ca/visitors/maps-and-directions",
      },
    });
    expect(connector!.distanceMeters).toBeGreaterThan(8);
    expect(connector!.distanceMeters).toBeLessThan(9);
  });

  test("matches an independent Dijkstra baseline in fastest mode", () => {
    const pairs = [
      ["osm-node-1312381405", "osm-node-13568164844"], // Erindale Hall to Davis
      ["osm-node-2383650599", "osm-node-1728239148"], // Instructional Building to Alumni House
      ["osm-node-2105676602", "osm-node-13738956113"], // Recreation to Health Sciences
    ] as const;
    for (const [start, end] of pairs) {
      const route = findRoute(UTM_ROUTING_GRAPH, start, end, DEFAULT_ROUTE_PREFERENCES);
      expect(route).not.toBeNull();
      expect(route!.estimatedSeconds).toBeCloseTo(
        dijkstraFastestSeconds(UTM_ROUTING_GRAPH, start, end),
        8,
      );
    }
  });

  test("keeps route calculation offline at runtime", async () => {
    const files = await Array.fromAsync(
      new Bun.Glob("src/features/routing/**/*.{ts,tsx}").scan("."),
    );
    files.push("src/components/CampusMap.tsx");
    for (const file of files) {
      const source = await readFile(file, "utf8");
      expect(source).not.toContain("fetch(");
      expect(source.toLowerCase()).not.toContain("valhalla");
    }
  });
});
