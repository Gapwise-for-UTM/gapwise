import { performance } from "node:perf_hooks";
import { DEFAULT_ROUTE_PREFERENCES } from "../src/config/routing";
import { UTM_ROUTING_GRAPH, CAMPUS_BUILDINGS } from "../src/data/utm/campus";
import { findBestRoute } from "../src/features/routing/engine";

const ids = CAMPUS_BUILDINGS.map((building) => building.entranceNodeId);
const started = performance.now();
let routes = 0;
for (let iteration = 0; iteration < 20; iteration += 1) {
  for (const start of ids) {
    const result = findBestRoute(UTM_ROUTING_GRAPH, [start], ids, DEFAULT_ROUTE_PREFERENCES);
    if (result) routes += 1;
  }
}
const elapsed = performance.now() - started;
console.log(
  JSON.stringify({
    routes,
    elapsedMs: Number(elapsed.toFixed(2)),
    averageMs: Number((elapsed / routes).toFixed(4)),
  }),
);
