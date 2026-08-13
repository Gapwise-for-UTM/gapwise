import { useRef, useState } from "react";
import { FileUp, Loader2, Sparkles } from "lucide-react";
import { emitClickSpark } from "@/lib/micro-interactions";

export function UploadPanel({
  onFile,
  onDemo,
  loading,
  error,
  remember,
  onRememberChange,
  rememberAvailable = true,
  variant = "card",
}: {
  onFile: (file: File) => void;
  onDemo: () => void;
  loading: boolean;
  error: string | null;
  remember: boolean;
  onRememberChange: (value: boolean) => void;
  rememberAvailable?: boolean;
  variant?: "card" | "hero";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const hero = variant === "hero";

  const dropzone = (
    <>
      <button
        type="button"
        aria-describedby="ics-file-help"
        disabled={loading}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!loading) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file && !loading) onFile(file);
        }}
        data-dragging={dragging ? "true" : "false"}
        className={`upload-dropzone group relative w-full cursor-pointer overflow-hidden border border-dashed p-7 text-center transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60 sm:p-9 ${
          dragging
            ? "scale-[1.01] border-accent bg-accent/8 shadow-[var(--accent-glow)]"
            : "border-input bg-muted/30 hover:border-accent/60 hover:bg-secondary/45"
        }`}
      >
        <span className="upload-orbit mx-auto flex items-center justify-center transition-transform duration-200 group-hover:-translate-y-0.5">
          <FileUp className="h-5 w-5 text-accent" aria-hidden="true" />
        </span>

        <span className="mt-5 block font-display text-[0.95rem] font-semibold tracking-tight">
          {dragging ? "Release to build your timetable" : "Drop your .ics file here"}
        </span>
        <span id="ics-file-help" className="mt-1.5 block text-xs leading-5 text-muted-foreground">
          Choose from your device · 2 MB maximum
        </span>
      </button>
      <input
        ref={inputRef}
        id="ics-file"
        name="ics-file"
        type="file"
        accept=".ics,text/calendar"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
    </>
  );

  const controls = (
    <div className="mt-5 space-y-3">
      <button
        type="button"
        onClick={(event) => {
          emitClickSpark(event);
          inputRef.current?.click();
        }}
        disabled={loading}
        className="button-primary click-spark inline-flex w-full items-center justify-center gap-2 px-5 py-3 text-sm font-semibold disabled:translate-y-0 disabled:opacity-60"
        aria-live="polite"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <FileUp className="h-4 w-4" aria-hidden="true" />
        )}
        {loading ? "Parsing timetable…" : "Upload timetable"}
      </button>
      <button
        type="button"
        onClick={onDemo}
        disabled={loading}
        className="button-secondary inline-flex w-full items-center justify-center gap-2 px-5 py-3 text-sm font-semibold disabled:opacity-60"
      >
        <Sparkles className="h-4 w-4" aria-hidden="true" />
        Try a demo
      </button>

      <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-low/55 p-3.5">
        <input
          id="remember"
          name="remember"
          type="checkbox"
          checked={rememberAvailable && remember}
          disabled={!rememberAvailable}
          onChange={(e) => onRememberChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-55"
        />
        <label htmlFor="remember" className="text-xs leading-5 text-muted-foreground">
          {rememberAvailable
            ? "Remember on this device — stores only an encrypted timetable copy in this browser. Off by default."
            : "Signed-in device restore is managed by encrypted private-data sync."}
        </label>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}
    </div>
  );

  if (hero) {
    return (
      <section aria-labelledby="upload-heading">
        <p className="eyebrow text-accent">Start with ACORN</p>
        <h2
          id="upload-heading"
          className="mt-2 font-display text-[1.65rem] font-medium tracking-[-0.035em]"
        >
          Upload your ACORN calendar
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          One local upload unlocks your timetable, gap plan, and day routes.
        </p>
        <div className="mt-5">{dropzone}</div>
        {controls}
      </section>
    );
  }

  return (
    <section aria-labelledby="upload-heading" className="surface p-5 sm:p-7">
      <h2 id="upload-heading" className="font-display text-xl font-medium">
        Upload your ACORN calendar
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Your calendar is parsed in your browser. Cloud sync is optional and never uploads the
        original ACORN file.
      </p>
      <div className="mt-5">{dropzone}</div>
      {controls}
    </section>
  );
}
