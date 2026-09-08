import type { ReactNode } from "react";
import { Trash2, Upload } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";

export function MobileMoreSheet({
  open,
  onOpenChange,
  loading,
  onUpdateTimetable,
  onRemoveTimetable,
  canRemove = true,
  children,
  syncControls,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  onUpdateTimetable: () => void;
  onRemoveTimetable: () => void;
  canRemove?: boolean;
  children: ReactNode;
  syncControls?: ReactNode;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[88dvh] rounded-t-2xl border-border bg-popover">
        <DrawerHeader className="border-b border-border px-4 pb-4 text-left">
          <DrawerTitle className="font-display text-lg font-medium tracking-tight">More</DrawerTitle>
        </DrawerHeader>
        <div className="space-y-5 overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4">
          <section>
            <p className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Preferences
            </p>
            <div className="flex flex-wrap items-center gap-2">{children}</div>
          </section>

          {syncControls ? (
            <section className="border-t border-border pt-4">
              <p className="mb-3 text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Sync
              </p>
              {syncControls}
            </section>
          ) : null}

          <section className="space-y-2 border-t border-border pt-4">
            <p className="mb-3 text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Timetable
            </p>
            <button
              type="button"
              disabled={loading}
              onClick={onUpdateTimetable}
              className="button-primary inline-flex min-h-11 w-full items-center justify-center gap-2 px-4 text-sm font-semibold disabled:opacity-60"
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              {loading ? "Updating…" : "Update timetable"}
            </button>
            {canRemove ? (
              <button
                type="button"
                onClick={onRemoveTimetable}
                className="button-secondary inline-flex min-h-11 w-full items-center justify-center gap-2 px-4 text-sm font-semibold text-muted-foreground hover:border-destructive/50 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Remove timetable
              </button>
            ) : null}
          </section>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
