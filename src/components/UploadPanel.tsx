import { useEffect, useRef, useState } from "react";
import { FileUp } from "lucide-react";
import { clearFirstValuePending, markFirstValuePending } from "@/features/onboarding/first-value";
import "./onboarding/first-run.css";

function ScheduleSkeleton() {
  return (
    <div
      className="and66-skeleton mt-5 rounded-lg border border-border bg-surface-low/45 p-4 text-left"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <p className="font-display text-sm font-medium">Building your timetable…</p>
      <div className="mt-4 grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3" aria-hidden="true">
        <div className="space-y-2.5 pt-1">
          <span className="block h-2 w-10 rounded bg-muted" />
          <span className="block h-2 w-12 rounded bg-muted" />
          <span className="block h-2 w-8 rounded bg-muted" />
        </div>
        <div className="space-y-2">
          <span className="block h-8 w-[68%] rounded bg-muted" />
          <span className="ml-[16%] block h-10 w-[76%] rounded bg-muted" />
          <span className="block h-7 w-[54%] rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}

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
  const importArmedRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const hero = variant === "hero";

  useEffect(() => {
    if (error) clearFirstValuePending();
  }, [error]);

  function openNativePicker() {
    importArmedRef.current = true;
    inputRef.current?.click();
  }

  function submitFile(file: File, activateFirstValue: boolean) {
    importArmedRef.current = false;
    if (activateFirstValue) markFirstValuePending();
    onFile(file);
  }

  const fileInput = (
    <input
      ref={inputRef}
      id="ics-file"
      name="ics-file"
      type="file"
      accept=".ics,text/calendar"
      hidden
      onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) submitFile(file, importArmedRef.current);
        event.target.value = "";
      }}
    />
  );

  const rememberControl = (
    <label className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/25 p-3 text-xs text-muted-foreground">
      <input
        id="remember"
        name="remember"
        type="checkbox"
        checked={rememberAvailable && remember}
        disabled={!rememberAvailable}
        onChange={(event) => onRememberChange(event.target.checked)}
        className="h-4 w-4 shrink-0 accent-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-55"
      />
      <span>
        {rememberAvailable ? "Remember this timetable on this device" : "Device sync is active"}
      </span>
    </label>
  );

  const errorMessage = error ? (
    <div
      role="alert"
      className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
    >
      <p className="font-semibold">The calendar could not be imported.</p>
      <p className="mt-1 leading-6">{error}</p>
      <p className="mt-1 leading-6">Choose another ACORN .ics file to try again.</p>
    </div>
  ) : null;

  if (hero) {
    return (
      <section aria-labelledby="upload-heading" className="and66-first-run">
        {fileInput}
        <p className="eyebrow">Import timetable</p>
        <h2
          id="upload-heading"
          className="mt-2 text-balance font-display text-[1.8rem] font-medium leading-tight tracking-[-0.04em]"
        >
          Start with your timetable.
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Upload the .ics export from ACORN or open a demo schedule.
        </p>

        {loading ? (
          <ScheduleSkeleton />
        ) : (
          <>
            <div className="mt-6 space-y-2">
              <button
                type="button"
                onClick={openNativePicker}
                className="button-primary inline-flex min-h-11 w-full items-center justify-center gap-2 px-5 text-sm font-semibold"
              >
                <FileUp className="h-4 w-4" aria-hidden="true" />
                Import ACORN
              </button>
              <button
                type="button"
                aria-label="Try a demo"
                onClick={() => {
                  importArmedRef.current = false;
                  clearFirstValuePending();
                  onDemo();
                }}
                className="button-secondary inline-flex min-h-10 w-full items-center justify-center px-4 text-sm font-medium text-muted-foreground"
              >
                Try Demo Schedule
              </button>
            </div>
            {errorMessage ? <div className="mt-3">{errorMessage}</div> : null}
          </>
        )}
      </section>
    );
  }

  const dropzone = (
    <button
      type="button"
      aria-describedby="ics-file-help"
      disabled={loading}
      onClick={openNativePicker}
      onDragOver={(event) => {
        event.preventDefault();
        if (!loading) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer.files?.[0];
        if (file && !loading) submitFile(file, true);
      }}
      data-dragging={dragging ? "true" : undefined}
      className={`upload-dropzone group relative w-full cursor-pointer overflow-hidden border border-dashed p-7 text-center disabled:cursor-not-allowed disabled:opacity-60 sm:p-9 ${
        dragging
          ? "border-accent bg-accent/6"
          : "border-input bg-muted/20 hover:border-accent/60 hover:bg-secondary/45"
      }`}
    >
      <span className="upload-orbit mx-auto flex items-center justify-center">
        <FileUp className="h-5 w-5 text-accent" aria-hidden="true" />
      </span>
      <span className="mt-5 block font-display text-[0.95rem] font-semibold tracking-tight">
        {dragging ? "Release to build your timetable" : "Drop your .ics file here"}
      </span>
      <span id="ics-file-help" className="mt-1.5 block text-xs leading-5 text-muted-foreground">
        Choose from your device · 2 MB maximum
      </span>
    </button>
  );

  return (
    <section aria-labelledby="upload-heading" className="surface p-5 sm:p-7">
      {fileInput}
      <h2 id="upload-heading" className="font-display text-xl font-medium">
        Upload your timetable
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">Choose the .ics export from ACORN.</p>
      {loading ? (
        <ScheduleSkeleton />
      ) : (
        <>
          <div className="mt-5">{dropzone}</div>
          <div className="mt-5 space-y-3">
            <button
              type="button"
              onClick={openNativePicker}
              className="button-primary inline-flex min-h-11 w-full items-center justify-center gap-2 px-5 text-sm font-semibold"
            >
              <FileUp className="h-4 w-4" aria-hidden="true" />
              Import ACORN
            </button>
            <button
              type="button"
              aria-label="Try a demo"
              onClick={() => {
                importArmedRef.current = false;
                clearFirstValuePending();
                onDemo();
              }}
              className="button-secondary inline-flex min-h-10 w-full items-center justify-center px-5 text-sm font-medium"
            >
              Try Demo Schedule
            </button>
            {rememberControl}
            {errorMessage}
          </div>
        </>
      )}
    </section>
  );
}
