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
  variant = "card",
}: {
  onFile: (file: File) => void;
  onDemo: () => void;
  loading: boolean;
  error: string | null;
  remember: boolean;
  onRememberChange: (value: boolean) => void;
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
        className={`group relative w-full cursor-pointer overflow-hidden rounded-xl border border-dashed p-7 text-center transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60 sm:p-9 ${
          dragging
            ? "scale-[1.01] border-accent bg-accent/8 shadow-[var(--accent-glow)]"
            : "border-input bg-muted/30 hover:border-accent/60 hover:bg-secondary/45"
        }`}
      >
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-accent/20 bg-accent/8 transition-transform duration-200 group-hover:-translate-y-0.5">
          <FileUp className="h-5 w-5 text-accent" aria-hidden="true" />
        </span>

        <span className="mt-4 block text-sm font-medium">Drop your .ics file here</span>
        <span id="ics-file-help" className="mt-1.5 block text-xs text-muted-foreground">
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

      <div className="flex items-start gap-3 rounded-lg border border-border bg-secondary/25 p-3">
        <input
          id="remember"
          name="remember"
          type="checkbox"
          checked={remember}
          onChange={(e) => onRememberChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-accent)]"
        />
        <label htmlFor="remember" className="text-xs leading-5 text-muted-foreground">
          Remember on this device — keeps the parsed timetable in this browser&apos;s local storage
          only. Off by default.
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
        <h2 id="upload-heading" className="mt-2 font-display text-2xl font-medium tracking-tight">
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
