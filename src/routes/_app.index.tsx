import { createFileRoute } from "@tanstack/react-router";

const TITLE = "Gapwise for UofT";
const DESCRIPTION =
  "Plan University of Toronto timetables, useful gaps, and source-backed campus routes in one precise workspace.";

export const Route = createFileRoute("/_app/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: RouteBoundary,
});

function RouteBoundary() {
  return null;
}
