import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/today")({
  head: () => ({
    meta: [
      { title: "Today — Gapwise for U of T" },
      {
        name: "description",
        content: "See today's U of T classes and gaps, with UTM route context where supported.",
      },
    ],
  }),
  component: RouteBoundary,
});

function RouteBoundary() {
  return null;
}
