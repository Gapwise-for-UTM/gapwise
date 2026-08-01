import { useMemo, useState } from "react";
import { resolveMeetingLocation } from "@/features/routing/location-resolver";
import type { TransitionRoute } from "@/features/routing/types";
import type { Meeting } from "@/lib/timetable-types";
import { UTM_ROUTING_GRAPH } from "@/data/utm/campus";

function routeSteps(route: TransitionRoute, from: Meeting, to: Meeting): string[] {
  if (route.status === "same-room") return ["Stay in the current room for your next class."];
  const result = route.result;
  if (!result || result.nodes.length === 0) {
    const destination = resolveMeetingLocation(to);
    const steps = [`Travel to the mapped entrance of ${to.buildingCode ?? "the destination"}.`];
    if (destination.floor && destination.floorVerification === "inferred") {
      steps.push(
        `Room numbering suggests floor ${destination.floor}, but that floor has not been independently verified.`,
      );
    }
    steps.push(
      `Indoor hallway directions are not yet mapped for ${to.buildingCode ?? "this building"}.`,
    );
    return steps;
  }

  const steps: string[] = [];
  const first = result.nodes[0]!;
  if (first.kind === "room") steps.push(`Leave ${first.buildingCode} ${first.room}.`);
  result.nodes.slice(1).forEach((node, index) => {
    const previous = result.nodes[index]!;
    if (node.kind === "hallway" && previous.kind !== "hallway") {
      steps.push(`Continue along the verified ${node.floor ?? "current"}-floor hallway.`);
    } else if (node.kind === "stairs") {
      steps.push(`Take the verified stairs to floor ${node.floor ?? "shown"}.`);
    } else if (node.kind === "elevator") {
      steps.push(`Take the verified elevator to floor ${node.floor ?? "shown"}.`);
    } else if (node.kind === "building-entrance") {
      const leaving =
        previous.buildingCode === node.buildingCode &&
        result.nodes[index + 2]?.buildingCode !== node.buildingCode;
      steps.push(
        leaving
          ? `Exit ${node.buildingCode} through the mapped entrance.`
          : `Enter ${node.buildingCode} through the mapped entrance.`,
      );
    } else if (node.kind === "room") {
      steps.push(`Continue to ${node.buildingCode} ${node.room}.`);
    }
  });
  return steps;
}

export function IndoorFloorViewer({
  route,
  from,
  to,
}: {
  route: TransitionRoute;
  from: Meeting;
  to: Meeting;
}) {
  const mappedFloors = useMemo(
    () =>
      [...new Set(route.result?.nodes.map((node) => node.floor).filter(Boolean) ?? [])] as string[],
    [route],
  );
  const [floor, setFloor] = useState(mappedFloors[0] ?? "");
  const buildingCode = to.buildingCode ?? from.buildingCode;
  const nodes = UTM_ROUTING_GRAPH.nodes.filter(
    (node) =>
      node.buildingCode === buildingCode &&
      node.floor === floor &&
      typeof node.indoorX === "number" &&
      typeof node.indoorY === "number",
  );
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const routeEdgeIds = new Set(route.result?.edges.map((edge) => edge.id) ?? []);
  const edges = UTM_ROUTING_GRAPH.edges.filter(
    (edge) => edge.environment !== "outdoor" && nodeById.has(edge.from) && nodeById.has(edge.to),
  );
  const steps = routeSteps(route, from, to);

  return (
    <section className="surface p-4" aria-labelledby="indoor-viewer-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 id="indoor-viewer-title" className="text-base font-semibold">
            Indoor detail · {to.buildingCode ?? from.buildingCode ?? "Unknown building"}
          </h3>
          <p className="text-xs text-muted-foreground">
            Indoor coordinates use a separate local floor layer, never geographic map coordinates.
          </p>
        </div>
        {mappedFloors.length > 0 ? (
          <label className="text-xs font-semibold">
            Floor
            <select
              value={floor}
              onChange={(event) => setFloor(event.target.value)}
              className="ml-2 rounded-md border border-input bg-card px-2 py-1"
            >
              {mappedFloors.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {nodes.length > 0 ? (
        <svg
          viewBox="0 0 1000 700"
          role="img"
          aria-label={`Verified indoor floor ${floor} route layer`}
          className="mt-4 h-auto w-full rounded-lg border border-border bg-muted/30"
        >
          {edges.map((edge) => {
            const start = nodeById.get(edge.from)!;
            const end = nodeById.get(edge.to)!;
            return (
              <line
                key={edge.id}
                x1={start.indoorX}
                y1={start.indoorY}
                x2={end.indoorX}
                y2={end.indoorY}
                stroke={edge.accessible ? "#3568a8" : "#b2573d"}
                strokeWidth={routeEdgeIds.has(edge.id) ? 10 : 5}
                strokeDasharray={edge.accessible ? undefined : "12 8"}
              />
            );
          })}
          {nodes.map((node) => (
            <g key={node.id}>
              <circle cx={node.indoorX} cy={node.indoorY} r="12" fill="#203b62" />
              <text x={(node.indoorX ?? 0) + 18} y={(node.indoorY ?? 0) + 5} fontSize="24">
                {node.room ?? node.label ?? node.kind}
              </text>
            </g>
          ))}
        </svg>
      ) : (
        <p className="mt-4 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
          Indoor room routing not yet mapped for this building. No hallway geometry is drawn.
        </p>
      )}

      <h4 className="mt-4 text-sm font-semibold">Supported directions</h4>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </section>
  );
}
