import { Download, ImageDown, Loader2, Share2, Sparkles } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TransitionPlanner } from "@/features/routing/transition";
import type { UserPreferences } from "@/features/sync/preferences";
import type { Meeting, Term } from "@/lib/timetable-types";

type TriggerVariant = "button" | "icon";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function TimetableHeatmapExportDialog({
  meetings,
  term,
  preferences,
  planTransition,
  triggerVariant = "button",
}: {
  meetings: Meeting[];
  term: Term;
  preferences: UserPreferences;
  planTransition: TransitionPlanner;
  triggerVariant?: TriggerVariant;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mappedStops = useMemo(
    () =>
      meetings.filter(
        (meeting) => meeting.term === term && meeting.buildingCode && !meeting.locationUnknown,
      ).length,
    [meetings, term],
  );
  const supportsShare = typeof navigator !== "undefined" && "share" in navigator;

  const openExport = () => {
    setError(null);
    setOpen(true);
  };

  const exportHeatmap = async () => {
    setExporting(true);
    setError(null);
    try {
      const { createTimetableHeatmapData, generateTimetableHeatmapPng } = await import(
        "@/lib/timetable-heatmap-export"
      );
      const data = createTimetableHeatmapData({
        meetings,
        term,
        preferences,
        planTransition,
      });
      const { blob, filename } = await generateTimetableHeatmapPng(data);
      const file = new File([blob], filename, { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `My ${term} UTM timetable heatmap`,
          text: "My campus routes and most-visited buildings, generated privately by Gapwise.",
        });
      } else {
        downloadBlob(blob, filename);
      }
      setOpen(false);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError(
        mappedStops === 0
          ? "This term has no mapped campus buildings to include in a heatmap."
          : "The heatmap image could not be created. Your timetable is unchanged — try exporting again.",
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openExport}
        disabled={mappedStops === 0}
        aria-label="Export timetable heatmap"
        title="Export timetable heatmap"
        className={
          triggerVariant === "icon"
            ? "button-secondary inline-flex h-11 w-11 shrink-0 items-center justify-center p-0 disabled:opacity-45"
            : "button-secondary inline-flex min-h-10 items-center justify-center gap-2 px-3 text-xs font-semibold disabled:opacity-45"
        }
      >
        <ImageDown className="h-4 w-4" aria-hidden="true" />
        {triggerVariant === "button" ? "Export heatmap" : null}
      </button>

      <Dialog open={open} onOpenChange={(next) => !exporting && setOpen(next)}>
        <DialogContent
          className="glass-panel max-w-md bg-card/95"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            triggerRef.current?.focus();
          }}
        >
          <DialogHeader className="pr-7">
            <DialogTitle className="font-display text-xl">Export timetable heatmap</DialogTitle>
            <DialogDescription className="leading-6">
              Turn your {term} timetable into a shareable UTM map. Brighter buildings mean more
              weekly visits; overlapping route lines get brighter when you repeat the same path.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-accent/25 bg-accent/8 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-accent" aria-hidden="true" />
              Built for sharing, without schedule details
            </p>
            <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
              The image is generated entirely in this browser from your timetable. Course codes,
              room numbers, class times, and your name are not included or uploaded.
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl border border-border bg-background/45 p-3">
              <dt className="text-xs text-muted-foreground">Term</dt>
              <dd className="mt-1 font-semibold">{term}</dd>
            </div>
            <div className="rounded-xl border border-border bg-background/45 p-3">
              <dt className="text-xs text-muted-foreground">Mapped stops</dt>
              <dd className="mt-1 font-semibold tabular-nums">{mappedStops}</dd>
            </div>
          </dl>

          <div className="rounded-xl border border-border bg-background/35 p-3 text-xs leading-5 text-muted-foreground">
            Export format: dark 4:5 PNG · campus path network · timetable routes · building visit
            intensity · OpenStreetMap attribution.
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-xl border border-destructive/35 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}

          <button
            type="button"
            disabled={exporting || mappedStops === 0}
            onClick={() => void exportHeatmap()}
            className="button-primary inline-flex min-h-12 w-full items-center justify-center gap-2 px-4 text-sm font-semibold disabled:opacity-60"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : supportsShare ? (
              <Share2 className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Download className="h-4 w-4" aria-hidden="true" />
            )}
            {exporting ? "Generating campus heatmap…" : supportsShare ? "Generate and share" : "Generate image"}
          </button>
          <p aria-live="polite" className="sr-only">
            {exporting ? "Generating timetable heatmap image" : (error ?? "")}
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
