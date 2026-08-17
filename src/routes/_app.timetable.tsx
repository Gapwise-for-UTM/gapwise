import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { hasPendingFirstValue } from "@/features/onboarding/first-value";

export const Route = createFileRoute("/_app/timetable")({
  head: () => ({ meta: [{ title: "Timetable — Gapwise for UTM" }] }),
  component: RouteBoundary,
});

function RouteBoundary() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!hasPendingFirstValue()) return;
    void navigate({ to: "/today", replace: true });
  }, [navigate]);

  return null;
}
