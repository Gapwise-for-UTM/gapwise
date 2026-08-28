import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { APP_UPDATE_READY_EVENT, type ApplyAppUpdate } from "@/features/pwa/update-events";

export function AppUpdatePrompt() {
  const [applyUpdate, setApplyUpdate] = useState<ApplyAppUpdate | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const receiveUpdate = (event: Event) => {
      const updateEvent = event as CustomEvent<ApplyAppUpdate>;
      setApplyUpdate(() => updateEvent.detail);
    };
    window.addEventListener(APP_UPDATE_READY_EVENT, receiveUpdate);
    return () => window.removeEventListener(APP_UPDATE_READY_EVENT, receiveUpdate);
  }, []);

  if (!applyUpdate) return null;

  return (
    <aside
      className="glass-panel fixed bottom-4 left-1/2 z-[100] w-[min(32rem,calc(100%-2rem))] -translate-x-1/2 rounded-2xl border border-accent/30 p-4 shadow-2xl"
      role="status"
      aria-live="polite"
    >
      <p className="font-semibold">A newer version of Gapwise is ready.</p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        Your timetable data is safe in this browser. Update now to avoid using stale app files.
      </p>
      <button
        type="button"
        disabled={updating}
        onClick={() => {
          setUpdating(true);
          void applyUpdate().catch(() => setUpdating(false));
        }}
        className="button-primary mt-3 inline-flex min-h-11 items-center justify-center gap-2 px-4 text-sm font-semibold disabled:opacity-60"
      >
        <RefreshCw className={`h-4 w-4 ${updating ? "animate-spin" : ""}`} aria-hidden="true" />
        {updating ? "Updating…" : "Update Gapwise"}
      </button>
    </aside>
  );
}
