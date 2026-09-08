import { Download, ImageDown, Loader2, Share2 } from "lucide-react";
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
import { TERMS, type Meeting, type Term } from "@/lib/timetable-types";
import type { TimetableHeatmapSelection } from "@/lib/timetable-heatmap-export";

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
  const terms = useMemo(
    () => TERMS.filter((candidate) => meetings.some((meeting) => meeting.term === candidate)),
    [meetings],
  );
  const [selection, setSelection] = useState<TimetableHeatmapSelection>(term);
  const mappedStops = useMemo(
    () =>
      meetings.filter(
        (meeting) =>
          (selection === "all" || meeting.term === selection) &&
          meeting.buildingCode &&
          !meeting.locationUnknown,
      ).length,
    [meetings, selection],
  );
  const supportsShare = typeof navigator !== "undefined" && "share" in navigator;

  const openExport = () => {
    setSelection(terms.length > 1 ? "all" : (terms[0] ?? term));
    setError(null);
    setOpen(true);
  };

  const exportHeatmap = async () => {
    setExporting(true);
    setError(null);
    try {
      const { createTimetableHeatmapData } = await import("@/lib/timetable-heatmap-export");
      const { generateLinearTimetableHeatmapPng } = await import(
        "@/lib/timetable-linear-heatmap-export"
      );
      const data = createTimetableHeatmapData({
        meetings,
        selection,
        preferences,
        planTransition,
      });
      const theme = document.documentElement.classList.contains("dark") ? "dark" : "light";
      const { blob, filename } = await generateLinearTimetableHeatmapPng(data, theme);
      const file = new File([blob], filename, { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `My ${selection === "all" ? "all-terms" : selection} UTM timetable heatmap`,
          text: "UTM timetable heatmap by Gapwise.",
        });
      } else {
        downloadBlob(blob, filename);
      }
      setOpen(false);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError(
        mappedStops === 0
          ? "This selection has no mapped campus buildings."
          : "The heatmap image could not be created. Try again.",
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
              Create a focused campus map of where your week happens. Brighter buildings mean more
              visits; repeated paths intensify.
            </DialogDescription>
          </DialogHeader>

          {terms.length > 1 ? (
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">Include</legend>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Terms to export">
                {[...terms, "all" as const].map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={selection === option}
                    onClick={() => setSelection(option)}
                    className={`min-h-11 rounded-lg border px-3 text-sm font-semibold ${selection === option ? "border-accent bg-accent text-accent-foreground" : "border-border text-muted-foreground"}`}
                  >
                    {option === "all" ? "All available terms" : option}
                  </button>
                ))}
              </div>
            </fieldset>
          ) : null}

          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg border border-border bg-background/45 p-3">
              <dt className="text-xs text-muted-foreground">Term</dt>
              <dd className="mt-1 font-semibold">
                {selection === "all" ? "All terms" : selection}
              </dd>
            </div>
            <div className="rounded-lg border border-border bg-background/45 p-3">
              <dt className="text-xs text-muted-foreground">Mapped stops</dt>
              <dd className="mt-1 font-semibold tabular-nums">{mappedStops}</dd>
            </div>
          </dl>

          <p className="text-xs leading-5 text-muted-foreground">
            4:5 PNG · focused campus crop · route paths · visit intensity · matches Gapwise theme.
            Campus geometry © OpenStreetMap contributors.
          </p>

          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-destructive/35 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}

          <button
            type="button"
            disabled={exporting || mappedStops === 0}
            onClick={() => void exportHeatmap()}
            className="button-primary inline-flex min-h-11 w-full items-center justify-center gap-2 px-4 text-sm font-semibold disabled:opacity-60"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : supportsShare ? (
              <Share2 className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Download className="h-4 w-4" aria-hidden="true" />
            )}
            {exporting ? "Generating heatmap…" : supportsShare ? "Generate and share" : "Generate image"}
          </button>
          <p aria-live="polite" className="sr-only">
            {exporting ? "Generating timetable heatmap image" : (error ?? "")}
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
