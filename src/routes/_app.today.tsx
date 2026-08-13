import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/today")({
  head: () => ({
    meta: [
      { title: "Today — Gapwise for UTM" },
      {
        name: "description",
        content: "See today's UTM classes, gaps, and next campus transition.",
      },
    ],
  }),
  component: RouteBoundary,
});

function RouteBoundary() {
  return null;
}
