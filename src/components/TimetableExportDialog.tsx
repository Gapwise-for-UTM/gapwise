import { Download, Image, Loader2, Printer, Share2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
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
import { generateTimetablePrintSvg } from "@/lib/timetable-print-export";
import type { Meeting } from "@/lib/timetable-types";

type ExportOutput = "image" | "print";

export function TimetableExportDialog({ meetings }: { meetings: Meeting[] }) {
  const terms = useMemo(() => availableExportTerms(meetings), [meetings]);
  const exportTriggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState<ExportSelection>(terms[0] ?? "Fall");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appearance, setAppearance] = useState<ExportAppearance>("match");
  const [output, setOutput] = useState<ExportOutput>("image");
  const supportsShare = typeof navigator !== "undefined" && "share" in navigator;

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  };

  const openExport = () => {
    setSelection(terms.length === 1 ? terms[0]! : "all");
    setOutput("image");
    setError(null);
    setOpen(true);
  };

  const exportTimetable = async () => {
    setExporting(true);
    setError(null);
    try {
      if (output === "print") {
        const { blob, filename } = await generateTimetablePrintSvg(meetings, selection);
        downloadBlob(blob, filename);
        setOpen(false);
        return;
      }

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
        downloadBlob(blob, filename);
      }
      setOpen(false);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError(
        "The timetable export could not be created. Your timetable is safe and unchanged — try exporting again.",
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <button
        ref={exportTriggerRef}
        type="button"
        aria-label="Export timetable"
        onClick={openExport}
        className="button-secondary inline-flex min-h-10 items-center justify-center gap-2 px-3 text-xs font-semibold"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        Export
      </button>
      <Dialog open={open} onOpenChange={(next) => !exporting && setOpen(next)}>
        <DialogContent
          className="glass-panel max-w-md bg-card/95"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            exportTriggerRef.current?.focus();
          }}
        >
          <DialogHeader className="pr-7">
            <DialogTitle className="font-display text-xl">
              {output === "print" ? "Print timetable" : "Export timetable image"}
            </DialogTitle>
            <DialogDescription className="leading-6">
              {output === "print"
                ? "Create a razor-sharp black-and-white vector for paper entirely in this browser. Your schedule is not uploaded."
                : "Create a private, high-resolution PNG entirely in this browser. Your schedule is not uploaded."}
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
            <legend className="mb-2 text-sm font-semibold">Format</legend>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Export format">
              <button
                type="button"
                role="radio"
                aria-checked={output === "image"}
                onClick={() => setOutput("image")}
                className={`min-h-20 rounded-xl border p-3 text-left transition-colors ${output === "image" ? "border-accent bg-accent/10" : "border-border bg-background/35"}`}
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <Image className="h-4 w-4" aria-hidden="true" />
                  Share image
                </span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  High-resolution PNG for screens
                </span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={output === "print"}
                onClick={() => setOutput("print")}
                className={`min-h-20 rounded-xl border p-3 text-left transition-colors ${output === "print" ? "border-accent bg-accent/10" : "border-border bg-background/35"}`}
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <Printer className="h-4 w-4" aria-hidden="true" />
                  Print-ready B&amp;W
                </span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  Vector SVG · unlimited sharpness
                </span>
              </button>
            </div>
          </fieldset>
          {output === "image" ? (
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
          ) : (
            <div className="rounded-xl border border-border bg-background/45 p-3">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Printer className="h-4 w-4" aria-hidden="true" />
                Built specifically for paper
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Pure monochrome vector artwork with embedded typography, crisp grid lines, and no
                screen-only shadows or gradients. Scale it to any printer DPI or page size without
                losing sharpness.
              </p>
            </div>
          )}
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
            onClick={() => void exportTimetable()}
            className="button-primary inline-flex min-h-12 w-full items-center justify-center gap-2 px-4 text-sm font-semibold disabled:opacity-60"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : output === "print" ? (
              <Printer className="h-4 w-4" aria-hidden="true" />
            ) : supportsShare ? (
              <Share2 className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Download className="h-4 w-4" aria-hidden="true" />
            )}
            {exporting
              ? output === "print"
                ? "Preparing print-ready vector…"
                : "Generating high-resolution PNG…"
              : output === "print"
                ? "Download print-ready SVG"
                : "Generate image"}
          </button>
          <p aria-live="polite" className="sr-only">
            {exporting
              ? output === "print"
                ? "Preparing print-ready timetable"
                : "Generating timetable image"
              : (error ?? "")}
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
