import { useEffect, useRef, useState } from "react";
import { FileUp, LogIn, ShieldCheck, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { requestGapwiseSignIn } from "@/features/auth/AccountStatus";
import { clearFirstValuePending, markFirstValuePending } from "@/features/onboarding/first-value";
import { emitClickSpark } from "@/lib/micro-interactions";
import { isSupabaseConfigured } from "@/lib/supabase";
import "./onboarding/first-run.css";

function ScheduleSkeleton() {
  return (
    <div
      className="and66-skeleton mt-5 rounded-xl border border-border bg-surface-low/45 p-4"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <p className="font-display text-base font-semibold tracking-tight">
        Reading your ACORN schedule…
      </p>
      <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
        The original .ics file is parsed locally and never uploaded.
      </p>
      <div className="mt-5 grid grid-cols-[4.25rem_minmax(0,1fr)] gap-3" aria-hidden="true">
        <div className="space-y-3 pt-1">
          <Skeleton className="h-3 w-12 motion-reduce:animate-none" />
          <Skeleton className="h-3 w-14 motion-reduce:animate-none" />
          <Skeleton className="h-3 w-10 motion-reduce:animate-none" />
        </div>
        <div className="space-y-2.5">
          <Skeleton className="h-10 w-[72%] motion-reduce:animate-none" />
          <Skeleton className="ml-[18%] h-14 w-[78%] motion-reduce:animate-none" />
          <Skeleton className="h-9 w-[58%] motion-reduce:animate-none" />
        </div>
      </div>
      <span className="sr-only">Reading the selected calendar locally.</span>
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
  );

  const rememberControl = (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-low/55 p-3.5">
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
    <p
      role="alert"
      className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
    >
      {error}
    </p>
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
              className="mt-4 flex items-start gap-2 rounded-lg border border-accent/20 bg-accent/6 px-3.5 py-3 text-xs leading-5 text-muted-foreground"
            >
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
              <span>Your calendar stays on this device. No account required.</span>
            </p>
            <div className="mt-5 space-y-2.5">
              <button
                type="button"
                onClick={(event) => {
                  emitClickSpark(event);
                  openNativePicker();
                }}
                className="button-primary click-spark inline-flex min-h-14 w-full items-center justify-center gap-2 px-5 text-sm font-semibold"
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
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary/55 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                <span>Try Demo Schedule</span>
              </button>
              <button
                type="button"
                onClick={requestGapwiseSignIn}
                disabled={!isSupabaseConfigured}
                aria-label="Sign in to sync across devices"
                title={isSupabaseConfigured ? "Sign in to sync" : "Sign-in is unavailable in this environment"}
                className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg px-4 text-xs font-semibold text-accent transition-colors hover:bg-accent/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45"
              >
                <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Sign in to sync</span>
              </button>
            </div>
            <div className="mt-5 hidden sm:block">{dropzone}</div>
            <div className="mt-4">{rememberControl}</div>
            {errorMessage ? <div className="mt-3">{errorMessage}</div> : null}
          </>
        )}
      </section>
    );
  }

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
              onClick={(event) => {
                emitClickSpark(event);
                openNativePicker();
              }}
              className="button-primary click-spark inline-flex min-h-12 w-full items-center justify-center gap-2 px-5 text-sm font-semibold"
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
              className="button-secondary inline-flex min-h-11 w-full items-center justify-center gap-2 px-5 text-sm font-semibold"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              <span>Try Demo Schedule</span>
            </button>
            {rememberControl}
            {errorMessage}
          </div>
        </>
      )}
    </section>
  );
}
