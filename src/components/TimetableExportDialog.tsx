import { Download, Image, Loader2, Share2 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  availableExportTerms,
  generateTimetablePng,
  resolveExportTheme,
  type ExportAppearance,
  type ExportSelection,
} from "@/lib/timetable-export";
import type { Meeting } from "@/lib/timetable-types";

export function TimetableExportDialog({ meetings }: { meetings: Meeting[] }) {
  const terms = useMemo(() => availableExportTerms(meetings), [meetings]);
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState<ExportSelection>(terms[0] ?? "Fall");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appearance, setAppearance] = useState<ExportAppearance>("match");
  const supportsShare = typeof navigator !== "undefined" && "share" in navigator;

  const exportImage = async () => {
    setExporting(true);
    setError(null);
    try {
      const resolvedGapwiseTheme = document.documentElement.classList.contains("dark")
        ? "dark"
        : "light";
      const { blob, filename } = await generateTimetablePng(
        meetings,
        selection,
        resolveExportTheme(appearance, resolvedGapwiseTheme),
      );
      const file = new File([blob], filename, { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "My timetable" });
      } else {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      }
      setOpen(false);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError(
        cause instanceof Error ? cause.message : "Export could not be completed. Try again.",
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setSelection(terms.length === 1 ? terms[0]! : "all");
          setError(null);
          setOpen(true);
        }}
        className="button-secondary inline-flex min-h-10 items-center justify-center gap-2 px-3 text-xs font-semibold"
      >
        <Image className="h-4 w-4" aria-hidden="true" />
        Export image
      </button>
      <Dialog open={open} onOpenChange={(next) => !exporting && setOpen(next)}>
        <DialogContent className="glass-panel max-w-md bg-card/95">
          <DialogHeader className="pr-7">
            <DialogTitle className="font-display text-xl">Export timetable image</DialogTitle>
            <DialogDescription className="leading-6">
              Create a private, high-resolution PNG entirely in this browser. Your schedule is not
              uploaded.
            </DialogDescription>
          </DialogHeader>
          {terms.length > 1 ? (
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">Include</legend>
              <div
                className="grid grid-cols-2 gap-2"
                role="radiogroup"
                aria-label="Terms to export"
              >
                {[...terms, "all" as const].map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={selection === option}
                    onClick={() => setSelection(option)}
                    className={`min-h-11 rounded-xl border px-3 text-sm font-semibold ${selection === option ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground"}`}
                  >
                    {option === "all" ? "All available terms" : option}
                  </button>
                ))}
              </div>
            </fieldset>
          ) : (
            <p className="rounded-xl border border-border bg-background/50 p-3 text-sm">
              {terms[0]} timetable
            </p>
          )}
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Appearance</legend>
            <div
              className="grid grid-cols-3 rounded-xl border border-border bg-background/45 p-1"
              role="radiogroup"
              aria-label="Export appearance"
            >
              {(
                [
                  ["match", "Match Gapwise"],
                  ["light", "Light"],
                  ["dark", "Dark"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={appearance === value}
                  onClick={() => setAppearance(value)}
                  className={`min-h-10 rounded-lg px-2 text-xs font-semibold transition-colors ${appearance === value ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
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
            disabled={exporting}
            onClick={() => void exportImage()}
            className="button-primary inline-flex min-h-12 w-full items-center justify-center gap-2 px-4 text-sm font-semibold disabled:opacity-60"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : supportsShare ? (
              <Share2 className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Download className="h-4 w-4" aria-hidden="true" />
            )}
            {exporting ? "Generating high-resolution PNG…" : "Generate image"}
          </button>
          <p aria-live="polite" className="sr-only">
            {exporting ? "Generating timetable image" : (error ?? "")}
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
