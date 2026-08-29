import { createFileRoute } from "@tanstack/react-router";

const TITLE = "Gapwise UTM — Timetable, Gaps & Campus Routes";
const DESCRIPTION =
  "Free UTM timetable, gap-planning, and campus-routing tools with private browser-based ACORN calendar parsing. Gapwise is independent from the University of Toronto.";
const CANONICAL_URL = "https://gapwise.ca/";
const SOFTWARE_APPLICATION = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Gapwise UTM",
  url: CANONICAL_URL,
  applicationCategory: "EducationalApplication",
  operatingSystem: "Web",
  isAccessibleForFree: true,
  description: DESCRIPTION,
  creator: {
    "@type": "Person",
    name: "Andrew Muratov",
  },
};

export const Route = createFileRoute("/_app/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: CANONICAL_URL },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: CANONICAL_URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(SOFTWARE_APPLICATION),
      },
    ],
  }),
  component: RouteBoundary,
});

function RouteBoundary() {
  return null;
}
