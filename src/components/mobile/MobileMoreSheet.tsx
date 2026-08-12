import type { ReactNode } from "react";
import { Trash2, Upload } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

export function MobileMoreSheet({
  open,
  onOpenChange,
  loading,
  onUpdateTimetable,
  onRemoveTimetable,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  onUpdateTimetable: () => void;
  onRemoveTimetable: () => void;
  /** Existing account, theme, and residence controls, rendered unchanged. */
  children: ReactNode;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85dvh]">
        <DrawerHeader className="text-left">
          <DrawerTitle className="font-display text-lg font-semibold tracking-tight">
            Settings
          </DrawerTitle>
          <DrawerDescription className="text-sm text-muted-foreground">
            Account, appearance, and timetable controls.
          </DrawerDescription>
        </DrawerHeader>
        <div className="space-y-4 overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <div className="flex flex-wrap items-center gap-2">{children}</div>
          <div className="space-y-2 border-t border-border pt-4">
            <button
              type="button"
              disabled={loading}
              onClick={onUpdateTimetable}
              className="button-primary inline-flex min-h-[2.875rem] w-full items-center justify-center gap-2 px-4 text-sm font-semibold disabled:opacity-60"
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              {loading ? "Updating…" : "Update timetable"}
            </button>
            <button
              type="button"
              onClick={onRemoveTimetable}
              className="button-secondary inline-flex min-h-[2.875rem] w-full items-center justify-center gap-2 px-4 text-sm font-semibold text-muted-foreground hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Remove timetable
            </button>
          </div>
          <p className="text-center font-mono text-[0.6rem] uppercase leading-relaxed tracking-[0.13em] text-muted-foreground">
            Independent student project · Not affiliated with U of T
          </p>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
