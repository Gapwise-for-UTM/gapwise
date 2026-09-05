import { createFileRoute } from "@tanstack/react-router";
import { PublicFeaturePage } from "@/components/PublicFeaturePage";
import { PUBLIC_FEATURE_PAGES } from "@/content/public-feature-pages";

const page = PUBLIC_FEATURE_PAGES.gaps;

export const Route = createFileRoute("/gap-planner")({
  head: () => ({
    meta: [{ title: page.seoTitle }, { name: "description", content: page.description }],
  }),
  component: () => <PublicFeaturePage page={page} />,
});
