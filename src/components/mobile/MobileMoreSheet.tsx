import { lazy, Suspense, type ReactNode } from "react";

const MobileMoreSheetImpl = lazy(() =>
  import("./MobileMoreSheetImpl").then((module) => ({ default: module.MobileMoreSheet })),
);

type MobileMoreSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  onUpdateTimetable: () => void;
  onRemoveTimetable: () => void;
  canRemove?: boolean;
  children: ReactNode;
  syncControls?: ReactNode;
};

export function MobileMoreSheet(props: MobileMoreSheetProps) {
  if (!props.open) return null;

  return (
    <Suspense fallback={null}>
      <MobileMoreSheetImpl {...props} />
    </Suspense>
  );
}
