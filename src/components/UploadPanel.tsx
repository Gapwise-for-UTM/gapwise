import { useRef, useState } from "react";
import { FileUp, Loader2, Sparkles } from "lucide-react";

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
        className={`w-full cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all disabled:cursor-not-allowed disabled:opacity-60 sm:p-10 ${
          dragging
            ? "border-accent bg-secondary"
            : "border-input bg-muted/50 hover:border-accent hover:bg-card"
        }`}
      >
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
          <FileUp className="h-7 w-7 text-accent" aria-hidden="true" />
        </span>
        <span className="mt-4 block text-sm font-semibold">Drop your .ics file here</span>
        <span id="ics-file-help" className="mt-1 block text-xs text-muted-foreground">
          or choose a file from your device · 2 MB maximum
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
    <div className="mt-6 space-y-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/10 transition-opacity hover:opacity-90 disabled:opacity-60"
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
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-input bg-card px-5 py-3.5 text-sm font-semibold transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
      >
        <Sparkles className="h-4 w-4" aria-hidden="true" />
        Try a demo
      </button>

      <div className="flex items-start gap-3 pt-1">
        <input
          id="remember"
          name="remember"
          type="checkbox"
          checked={remember}
          onChange={(e) => onRememberChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"
        />
        <label htmlFor="remember" className="text-sm text-muted-foreground">
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
        <h2 id="upload-heading" className="font-display text-2xl font-bold">
          Get started
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Select your calendar file to generate your gap plan.
        </p>
        <div className="mt-6">{dropzone}</div>
        {controls}
      </section>
    );
  }

  return (
    <section aria-labelledby="upload-heading" className="surface p-5 sm:p-7">
      <h2 id="upload-heading" className="font-display text-xl font-bold">
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
