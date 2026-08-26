import * as DialogPrimitive from "@radix-ui/react-dialog";
import { CalendarPlus2, Check, CheckCircle2, Cloud, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import "@/components/onboarding/account-onboarding.css";
import { getSupabaseClient } from "@/lib/supabase";
import { getAccountOnboardingAction } from "./account-onboarding-action";

async function requestOnboarding(action: "read" | "complete") {
  const client = getSupabaseClient();
  if (!client) throw new Error("Account setup is unavailable.");
  const { data } = await client.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("Sign in is required.");
  const response = await fetch("/api/onboarding", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
  const payload = (await response.json().catch(() => null)) as {
    pending?: boolean;
    completed?: boolean;
    error?: string;
  } | null;
  if (!response.ok) throw new Error(payload?.error ?? "Account setup is unavailable.");
  return payload;
}

export function AccountOnboarding({
  userId,
  hasTimetable,
  onContinue,
  onImport,
}: {
  userId: string | null;
  hasTimetable: boolean;
  onContinue: () => void;
  onImport: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [importReady, setImportReady] = useState(false);
  const actionRef = useRef<HTMLButtonElement>(null);
  const action = getAccountOnboardingAction(hasTimetable);

  useEffect(() => {
    let active = true;
    setPending(false);
    setImportReady(false);
    setMessage(null);
    if (!userId) return () => void (active = false);
    void requestOnboarding("read")
      .then((result) => {
        if (active) setPending(result?.pending === true);
      })
      .catch(() => {
        if (active) setPending(false);
      });
    return () => void (active = false);
  }, [userId]);

  async function complete() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await requestOnboarding("complete");
      if (result?.completed !== true) throw new Error("Completion was not confirmed.");
      if (action.kind === "import") {
        setImportReady(true);
      } else {
        setPending(false);
        onContinue();
      }
    } catch {
      setMessage("We couldn't save this yet. Your timetable is safe — try again.");
    } finally {
      setBusy(false);
    }
  }

  function chooseFile() {
    onImport();
    setPending(false);
  }

  if (!userId || !pending) return null;

  return (
    <DialogPrimitive.Root open modal>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="account-onboarding-backdrop fixed inset-0 z-[80]" />
        <DialogPrimitive.Content
          aria-describedby="account-onboarding-description"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            actionRef.current?.focus();
          }}
          className="account-onboarding-panel glass-panel fixed bottom-0 left-1/2 z-[81] w-full max-w-xl -translate-x-1/2 overflow-hidden rounded-t-[1.75rem] border border-accent/25 px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-6 shadow-2xl sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-[1.75rem] sm:p-7"
        >
          <div className="flex items-center gap-3" role="status">
            <span className="account-onboarding-check flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-accent/25 bg-accent/10">
              <CheckCircle2 className="h-5 w-5 text-accent" aria-hidden="true" />
            </span>
            <div>
              <p className="eyebrow text-accent">Account unlocked</p>
              <DialogPrimitive.Title className="mt-1 font-display text-xl font-semibold">
                Your Gapwise account is ready.
              </DialogPrimitive.Title>
            </div>
          </div>

          <DialogPrimitive.Description
            id="account-onboarding-description"
            className="account-onboarding-reveal account-onboarding-reveal-one mt-5 text-sm leading-6 text-muted-foreground"
          >
            {hasTimetable
              ? "Your timetable stayed right where you left it. Signing in never replaces what is already in this browser."
              : "You can keep using Gapwise right away. Import your timetable when you're ready."}
          </DialogPrimitive.Description>

          <ul className="mt-4 grid gap-2.5 text-sm sm:grid-cols-2">
            <li className="account-onboarding-reveal account-onboarding-reveal-two flex gap-3 rounded-xl border border-border/80 bg-background/45 p-3.5">
              <Cloud className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
              <span>
                <strong className="block font-medium text-foreground">Encrypted continuity</strong>
                <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                  Optional private sync is now available.
                </span>
              </span>
            </li>
            <li className="account-onboarding-reveal account-onboarding-reveal-three flex gap-3 rounded-xl border border-border/80 bg-background/45 p-3.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
              <span>
                <strong className="block font-medium text-foreground">Your file stays local</strong>
                <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                  The original ACORN .ics is never uploaded.
                </span>
              </span>
            </li>
          </ul>

          {message ? (
            <p className="mt-4 text-sm text-destructive" role="alert">
              {message}
            </p>
          ) : null}

          <button
            ref={actionRef}
            type="button"
            onClick={importReady ? chooseFile : () => void complete()}
            disabled={busy}
            className="account-onboarding-action button-primary mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 px-5 text-sm font-semibold disabled:opacity-60 sm:w-auto sm:min-w-48"
          >
            {busy ? (
              "Saving…"
            ) : importReady ? (
              <>
                <CalendarPlus2 className="h-4 w-4" aria-hidden="true" />
                Choose ACORN file
              </>
            ) : (
              <>
                {action.kind === "import" ? (
                  <CalendarPlus2 className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Check className="h-4 w-4" aria-hidden="true" />
                )}
                {action.label}
              </>
            )}
          </button>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
