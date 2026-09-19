import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/gaps")({
  head: () => ({
    meta: [
      { title: "Gap Plan — Gapwise for UofT" },
      {
        name: "description",
        content: "Plan useful time between UTM classes with route-aware gap guidance.",
      },
    ],
  }),
  component: RouteBoundary,
});

function RouteBoundary() {
  return null;
}
