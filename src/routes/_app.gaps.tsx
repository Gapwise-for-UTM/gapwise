import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/gaps")({
  head: () => ({
    meta: [
      { title: "Gap Plan — Gapwise for UofT" },
      {
        name: "description",
        content: "Plan useful time between classes with route-aware gap guidance where available.",
      },
    ],
  }),
  component: RouteBoundary,
});

function RouteBoundary() {
  return null;
}
