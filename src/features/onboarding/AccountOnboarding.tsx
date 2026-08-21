import { CheckCircle2, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";

async function requestOnboarding(action: "read" | "complete") {
  const client = getSupabaseClient();
  if (!client) throw new Error("Account setup is unavailable.");
  const { data } = await client.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("Sign in is required.");
  const response = await fetch("/api/onboarding", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
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

export function AccountOnboarding({ userId }: { userId: string | null }) {
  const [pending, setPending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setPending(false);
    setMessage(null);
    if (!userId) return () => void (active = false);
    void requestOnboarding("read")
      .then((result) => {
        if (active) setPending(result?.pending === true);
      })
      .catch(() => {
        // First-run guidance must never block a working signed-in session.
        if (active) setPending(false);
      });
    return () => void (active = false);
  }, [userId]);

  if (!userId || !pending) return null;

  async function complete() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await requestOnboarding("complete");
      setPending(false);
    } catch {
      setMessage("Your account is ready, but this welcome state could not be saved. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside
      role="dialog"
      aria-label="Gapwise account ready"
      className="glass-panel fixed bottom-4 left-4 right-4 z-[70] mx-auto max-w-lg rounded-2xl border border-accent/25 p-5 shadow-xl sm:left-auto sm:right-5"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-accent/20 bg-accent/8">
          <CheckCircle2 className="h-4 w-4 text-accent" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-semibold">Your Gapwise account is ready.</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Anything already open stays exactly where it is. Your account adds encrypted sync,
            private friend features, and Pro access without uploading your original ACORN file.
          </p>
          <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
            If you have not imported a timetable yet, the ACORN import on this page is still your
            next step.
          </p>
          {message ? <p className="mt-3 text-xs text-destructive">{message}</p> : null}
          <button
            type="button"
            onClick={() => void complete()}
            disabled={busy}
            className="button-primary mt-4 min-h-10 px-4 text-sm font-semibold disabled:opacity-60"
          >
            {busy ? "Saving…" : "Got it"}
          </button>
        </div>
      </div>
    </aside>
  );
}
