import { performance } from "node:perf_hooks";
import { DEFAULT_ROUTE_PREFERENCES } from "../src/config/routing";
import { UTM_ROUTING_GRAPH, CAMPUS_BUILDINGS } from "../src/data/utm/campus";
import { findBestRoute } from "../src/features/routing/engine";

const ids = CAMPUS_BUILDINGS.map((building) => building.entranceNodeId);
const targetsByStart = new Map(ids.map((start) => [start, ids.filter((id) => id !== start)]));
const started = performance.now();
let attempts = 0;
let routes = 0;
for (let iteration = 0; iteration < 20; iteration += 1) {
  for (const start of ids) {
    const targets = targetsByStart.get(start) ?? [];
    attempts += 1;
    const result = findBestRoute(
      UTM_ROUTING_GRAPH,
      [start],
      targets,
      DEFAULT_ROUTE_PREFERENCES,
    );
    if (result) routes += 1;
  }
}
const elapsed = performance.now() - started;
console.log(
  JSON.stringify({
    attempts,
    routes,
    elapsedMs: Number(elapsed.toFixed(2)),
    averageMs: attempts > 0 ? Number((elapsed / attempts).toFixed(4)) : null,
  }),
);
