import { createFileRoute } from "@tanstack/react-router";

const TITLE = "Gapwise for U of T";
const DESCRIPTION =
  "Plan U of T timetables across UTM, UTSG, and UTSC, with UTM-focused gap and campus-route intelligence.";

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
