import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/gaps")({
  head: () => ({
    meta: [
      { title: "Gap Plan — Gapwise for U of T" },
      {
        name: "description",
        content:
          "Plan useful time between U of T classes with UTM route-aware guidance where supported.",
      },
    ],
  }),
  component: RouteBoundary,
});

function RouteBoundary() {
  return null;
}
