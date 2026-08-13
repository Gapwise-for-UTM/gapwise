import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/timetable")({
  head: () => ({
    meta: [
      { title: "Timetable — Gapwise for UTM" },
      {
        name: "description",
        content: "View a private weekly UTM timetable parsed locally from an ACORN calendar.",
      },
    ],
  }),
  component: RouteBoundary,
});

function RouteBoundary() {
  return null;
}
