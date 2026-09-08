import { createFileRoute, redirect } from "@tanstack/react-router";

const GAPWISE_AI_URL = "https://ai.gapwise.ca";

export const Route = createFileRoute("/ai")({
  beforeLoad: () => {
    throw redirect({ href: GAPWISE_AI_URL });
  },
  component: () => null,
});
