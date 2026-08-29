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
import { canDeliverGeneratedExportImmediately } from "@/lib/timetable-export-delivery";
import type { Meeting } from "@/lib/timetable-types";

type ExportOutput = "image" | "print";

interface PreparedExport {
  output: ExportOutput;
  blob: Blob;
  filename: string;
}

function isAbortError(cause: unknown) {
  return cause instanceof DOMException && cause.name === "AbortError";
}

function isActivationError(cause: unknown) {
  return (
    cause instanceof DOMException &&
    (cause.name === "NotAllowedError" || cause.name === "InvalidStateError")
  );
}

export function TimetableExportDialog({ meetings }: { meetings: Meeting[] }) {
  const terms = useMemo(() => availableExportTerms(meetings), [meetings]);
  const exportTriggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState<ExportSelection>(terms[0] ?? "Fall");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appearance, setAppearance] = useState<ExportAppearance>("match");
  const [output, setOutput] = useState<ExportOutput>("image");
  const [preparedExport, setPreparedExport] = useState<PreparedExport | null>(null);
  const supportsShare =
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function";

  const clearPreparedExport = () => {
    setPreparedExport(null);
    setError(null);
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = "noopener";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    try {
      anchor.click();
    } finally {
      anchor.remove();
      // Safari may resolve the blob URL after the synthetic click has returned.
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }
  };

  const openExport = () => {
    setSelection(terms.length === 1 ? terms[0]! : "all");
    setOutput("image");
    setPreparedExport(null);
    setError(null);
    setOpen(true);
  };

  const deliverPreparedExport = async (prepared: PreparedExport) => {
    if (prepared.output === "image") {
      const file = new File([prepared.blob], prepared.filename, { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "My timetable" });
      } else {
        downloadBlob(prepared.blob, prepared.filename);
      }
    } else {
      downloadBlob(prepared.blob, prepared.filename);
    }
    setPreparedExport(null);
    setOpen(false);
  };

  const reportDeliveryError = (cause: unknown) => {
    if (isAbortError(cause)) return;
    if (isActivationError(cause)) {
      setError("Your export is ready. Tap the button below once more to share or download it.");
      return;
    }
    setError("Your export is ready, but this browser could not share or download it. Try again.");
  };

  const exportTimetable = async () => {
    setError(null);

    if (preparedExport) {
      try {
        await deliverPreparedExport(preparedExport);
      } catch (cause) {
        reportDeliveryError(cause);
      }
      return;
    }

    setExporting(true);
    try {
      let prepared: PreparedExport;
      if (output === "print") {
        const { blob, filename } = await generateTimetablePrintSvg(meetings, selection);
        prepared = { output, blob, filename };
      } else {
        const resolvedGapwiseTheme = document.documentElement.classList.contains("dark")
          ? "dark"
          : "light";
        const { blob, filename } = await generateTimetablePng(
          meetings,
          selection,
          resolveExportTheme(appearance, resolvedGapwiseTheme),
        );
        prepared = { output, blob, filename };
      }

      // Keep the artifact in memory until delivery succeeds. Safari can expire the
      // originating user activation while the image/SVG is being generated; in that
      // case a fresh explicit tap is required for Web Share or <a download>.
      setPreparedExport(prepared);

      if (canDeliverGeneratedExportImmediately()) {
        try {
          await deliverPreparedExport(prepared);
        } catch (cause) {
          reportDeliveryError(cause);
        }
      }
    } catch (cause) {
      if (isAbortError(cause)) return;
      setPreparedExport(null);
      setError(
        "The timetable export could not be created. Your timetable is safe and unchanged — try exporting again.",
      );
    } finally {
      setExporting(false);
    }
  };

  const readyMessage =
    preparedExport?.output === "print"
      ? "Print-ready SVG is ready. Tap below to download it."
      : preparedExport
        ? "Image is ready. Tap below to share or download it."
        : null;

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
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (exporting) return;
          if (!next) clearPreparedExport();
          setOpen(next);
        }}
      >
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
                    onClick={() => {
                      setSelection(option);
                      clearPreparedExport();
                    }}
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
                onClick={() => {
                  setOutput("image");
                  clearPreparedExport();
                }}
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
                onClick={() => {
                  setOutput("print");
                  clearPreparedExport();
                }}
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
                    onClick={() => {
                      setAppearance(value);
                      clearPreparedExport();
                    }}
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
          {readyMessage ? (
            <p
              role="status"
              className="rounded-xl border border-accent/35 bg-accent/10 p-3 text-sm text-foreground"
            >
              {readyMessage}
            </p>
          ) : null}
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
            ) : preparedExport?.output === "print" ? (
              <Download className="h-4 w-4" aria-hidden="true" />
            ) : preparedExport ? (
              supportsShare ? (
                <Share2 className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Download className="h-4 w-4" aria-hidden="true" />
              )
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
              : preparedExport?.output === "print"
                ? "Download print-ready SVG"
                : preparedExport
                  ? supportsShare
                    ? "Share image"
                    : "Download image"
                  : output === "print"
                    ? "Prepare print-ready SVG"
                    : "Generate image"}
          </button>
          <p aria-live="polite" className="sr-only">
            {exporting
              ? output === "print"
                ? "Preparing print-ready timetable"
                : "Generating timetable image"
              : (error ?? readyMessage ?? "")}
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
