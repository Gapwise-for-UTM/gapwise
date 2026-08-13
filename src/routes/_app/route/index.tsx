import { createFileRoute } from "@tanstack/react-router";
import { normalizePublicBuildingCode } from "@/data/utm/building-registry";

export function validateRouteSearch(search: Record<string, unknown>) {
  const rawBuilding = search["building"];
  const building = normalizePublicBuildingCode(rawBuilding) ?? undefined;
  return building ? { building } : {};
}

export const Route = createFileRoute("/_app/route/")({
  validateSearch: validateRouteSearch,
  head: () => ({
    meta: [
      { title: "Campus Route — Gapwise for UTM" },
      {
        name: "description",
        content: "Explore UTM buildings and review route-aware transitions between classes.",
      },
    ],
  }),
  component: RouteBoundary,
});

function RouteBoundary() {
  return null;
}
