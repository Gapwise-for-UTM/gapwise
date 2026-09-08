import { lazy, Suspense } from "react";
import type { AcademicState } from "./state";
import type { Meeting } from "@/lib/timetable-types";

const AcademicWorkDialogImpl = lazy(() =>
  import("./AcademicWorkDialogImpl").then((module) => ({ default: module.AcademicWorkDialog })),
);

type AcademicWorkDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: AcademicState;
  onChange: (state: AcademicState) => void;
  meetings: Meeting[];
  routeMinutes?: ((from: Meeting, to: Meeting) => number | null) | undefined;
  routingRevision?: string | undefined;
};

export function AcademicWorkDialog(props: AcademicWorkDialogProps) {
  if (!props.open) return null;

  return (
    <Suspense fallback={null}>
      <AcademicWorkDialogImpl {...props} />
    </Suspense>
  );
}
