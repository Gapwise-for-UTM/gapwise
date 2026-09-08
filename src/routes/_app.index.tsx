import { createFileRoute } from "@tanstack/react-router";

const TITLE = "Gapwise for UTM";
const DESCRIPTION = "Plan UTM timetables, useful gaps, and campus routes in one precise workspace.";

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
