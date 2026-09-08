import { useEffect, useRef, useState } from "react";
import { FileUp, ShieldCheck } from "lucide-react";
import { LoadingPanel } from "@/components/ui/state-panel";
import { requestGapwiseSignIn } from "@/features/auth/sign-in-trigger";
import { clearFirstValuePending, markFirstValuePending } from "@/features/onboarding/first-value";
import { isSupabaseConfigured } from "@/lib/supabase";
import "./onboarding/first-run.css";

function ScheduleSkeleton() {
  return (
    <LoadingPanel
      className="and66-skeleton mt-5"
      compact
      title="Reading your ACORN schedule…"
      description="The original .ics file is parsed locally and never uploaded."
    />
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
    <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/35 p-3">
      <input
        id="remember"
        name="remember"
        type="checkbox"
        checked={rememberAvailable && remember}
        disabled={!rememberAvailable}
        onChange={(event) => onRememberChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-55"
      />
      <label htmlFor="remember" className="text-xs leading-5 text-muted-foreground">
        {rememberAvailable
          ? "Remember on this device — stores only an encrypted timetable copy in this browser. Off by default."
          : "Signed-in device restore is managed by encrypted private-data sync."}
      </label>
    </div>
  );

  const errorMessage = error ? (
    <div
      role="alert"
      className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
    >
      <p className="font-semibold">The calendar could not be imported.</p>
      <p className="mt-1 leading-6">{error}</p>
      <p className="mt-1 leading-6">
        Any timetable already in this browser is safe. Choose another ACORN .ics file to try again.
      </p>
    </div>
  ) : null;

  if (hero) {
    return (
      <section aria-labelledby="upload-heading" className="and66-first-run">
        {fileInput}
        <p className="eyebrow text-accent">Start with ACORN</p>
        <h2
          id="upload-heading"
          className="mt-2 text-balance font-display text-[1.8rem] font-medium leading-tight tracking-[-0.04em]"
        >
          See gaps. Navigate UTM. Privately.
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Import your ACORN calendar to see what&apos;s next, how much time is usable, and where to
          go.
        </p>

        {loading ? (
          <ScheduleSkeleton />
        ) : (
          <>
            <p
              id="first-run-privacy"
              className="mt-4 flex items-start gap-2 text-xs leading-5 text-muted-foreground"
            >
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
              <span>Your calendar stays on this device. No account required.</span>
            </p>
            <div className="mt-5 space-y-2">
              <button
                type="button"
                onClick={openNativePicker}
                className="button-primary inline-flex min-h-11 w-full items-center justify-center gap-2 px-5 text-sm font-semibold"
                aria-describedby="first-run-import-help first-run-privacy"
              >
                <FileUp className="h-4 w-4" aria-hidden="true" />
                Import ACORN
              </button>
              <p
                id="first-run-import-help"
                className="text-center text-xs leading-5 text-muted-foreground"
              >
                Choose the .ics file you downloaded from ACORN.
              </p>
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
              <button
                type="button"
                onClick={requestGapwiseSignIn}
                disabled={!isSupabaseConfigured}
                aria-label="Sign in to sync across devices"
                title={
                  isSupabaseConfigured
                    ? "Sign in to sync"
                    : "Sign-in is unavailable in this environment"
                }
                className="inline-flex min-h-9 w-full items-center justify-center rounded-md px-4 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45"
              >
                Sign in to sync
              </button>
            </div>
            <div className="mt-4">{rememberControl}</div>
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
      data-dragging={dragging ? "true" : "false"}
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
        Upload your ACORN calendar
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Your calendar is parsed in your browser. Cloud sync is optional and never uploads the
        original ACORN file.
      </p>
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
