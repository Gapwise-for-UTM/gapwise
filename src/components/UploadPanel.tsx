import { useRef, useState } from "react";
import { FileUp, Loader2, Sparkles } from "lucide-react";

export function UploadPanel({
  onFile,
  onDemo,
  loading,
  error,
  remember,
  onRememberChange,
}: {
  onFile: (file: File) => void;
  onDemo: () => void;
  loading: boolean;
  error: string | null;
  remember: boolean;
  onRememberChange: (value: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <section aria-labelledby="upload-heading" className="surface p-5 sm:p-7">
      <h2 id="upload-heading" className="text-xl font-semibold">
        Upload your ACORN calendar
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Your calendar is parsed in your browser. Cloud sync is optional and never uploads the
        original ACORN file.
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) onFile(file);
        }}
        className={`mt-5 rounded-xl border-2 border-dashed p-6 text-center transition-colors sm:p-10 ${
          dragging ? "border-accent bg-secondary" : "border-input bg-muted/40"
        }`}
      >
        <FileUp className="mx-auto h-8 w-8 text-accent" aria-hidden="true" />
        <label htmlFor="ics-file" className="mt-4 block text-sm font-medium">
          Calendar file (.ics)
        </label>
        <input
          ref={inputRef}
          id="ics-file"
          name="ics-file"
          type="file"
          accept=".ics,text/calendar"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            e.target.value = "";
          }}
        />
        <p className="mt-1 text-sm text-muted-foreground">
          Drag and drop it here, or choose a file from your device.
        </p>
        <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60 sm:w-auto"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <FileUp className="h-4 w-4" aria-hidden="true" />
            )}
            {loading ? "Parsing timetable…" : "Upload ACORN calendar"}
          </button>
          <button
            type="button"
            onClick={onDemo}
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-input bg-card px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-secondary disabled:opacity-60 sm:w-auto"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Try a demo
          </button>
        </div>
      </div>

      <div className="mt-5 flex items-start gap-3">
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
          className="mt-5 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}
    </section>
  );
}
