import type { User } from "@supabase/supabase-js";
import { CloudDownload, CloudUpload, Trash2 } from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { GapPreferences } from "@/features/gaps/types";
import type { PrivateDataPayloadV1 } from "@/features/security/private-data";
import type { AcademicState } from "@/features/academic/state";
import type { PersonalItem } from "@/lib/personal-types";
import type { Meeting } from "@/lib/timetable-types";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  deleteEncryptedPrivateCloud,
  loadEncryptedPrivateState,
  saveEncryptedPrivateState,
} from "./encrypted-sync-service";
import type { UserPreferences } from "./preferences";
import type { RestorationState } from "./restoration";
import { setCloudRestoreSuppressed } from "./restore-preference";

const CloudAiBridge = lazy(() =>
  import("./CloudAiBridge").then((module) => ({ default: module.CloudAiBridge })),
);
const SYNC_SETTINGS_SLOT_ID = "gapwise-sync-settings-slot";

export type CloudSyncControlsProps = {
  user: User;
  meetings: Meeting[] | null;
  personalItems: PersonalItem[];
  preferences: UserPreferences;
  gapPreferences: GapPreferences;
  academic: AcademicState;
  onLoad: (meetings: Meeting[]) => void;
  onLoadPrivate: (payload: PrivateDataPayloadV1) => void;
  restorationState: RestorationState;
};

export function CloudSyncControlsImpl({
  user,
  meetings,
  personalItems,
  preferences,
  gapPreferences,
  academic,
  onLoadPrivate,
  restorationState,
}: CloudSyncControlsProps) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [settingsSlot, setSettingsSlot] = useState<HTMLElement | null>(null);
  const enabled = isSupabaseConfigured;

  useEffect(() => {
    if (typeof document === "undefined") return;
    const updateSlot = () => {
      const next = document.getElementById(SYNC_SETTINGS_SLOT_ID);
      setSettingsSlot((current) => (current === next ? current : next));
    };
    updateSlot();
    const observer = new MutationObserver(updateSlot);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  async function run(action: () => Promise<string>) {
    setBusy(true);
    setMessage(null);
    try {
      setMessage(await action());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sync failed.");
    } finally {
      setBusy(false);
    }
  }

  const controls = settingsSlot
    ? createPortal(
        <section className="surface p-4 sm:p-5" aria-labelledby="cloud-sync-title">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="cloud-sync-title" className="text-sm font-semibold">
                Sync across devices
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Keep your timetable, preferences, and planning data in sync.
              </p>
              <p className="mt-1 text-[0.68rem] text-muted-foreground">
                {restorationState === "checking-cloud"
                  ? "Checking sync…"
                  : restorationState === "restored-cloud"
                    ? "Synced data loaded."
                    : restorationState === "cloud-version-available"
                      ? "A newer sync is available."
                      : "Using this device’s copy."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!enabled || busy}
                onClick={() =>
                  void run(async () => {
                    await saveEncryptedPrivateState(user.id, {
                      schedule: meetings ?? [],
                      personalItems,
                      preferences,
                      gapPreferences,
                    });
                    setCloudRestoreSuppressed(user.id, false);
                    return "Synced.";
                  })
                }
                className="button-primary inline-flex min-h-10 items-center gap-2 px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CloudUpload className="h-3.5 w-3.5" aria-hidden="true" />
                Sync now
              </button>
              <button
                type="button"
                disabled={!enabled || busy}
                onClick={() =>
                  void run(async () => {
                    const restored = await loadEncryptedPrivateState(user.id, undefined, true);
                    if (!restored) return "No sync found.";
                    setCloudRestoreSuppressed(user.id, false);
                    onLoadPrivate(restored.payload);
                    return "Loaded.";
                  })
                }
                className="button-secondary inline-flex min-h-10 items-center gap-2 px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CloudDownload className="h-3.5 w-3.5" aria-hidden="true" />
                Load sync
              </button>
              <button
                type="button"
                disabled={!enabled || busy}
                onClick={() => {
                  if (!window.confirm("Delete synced Gapwise data from your account?")) return;
                  void run(async () => {
                    await deleteEncryptedPrivateCloud(user.id);
                    return "Deleted.";
                  });
                }}
                className="inline-flex min-h-10 items-center gap-2 rounded-md border border-destructive/40 bg-card px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                Delete sync
              </button>
            </div>
          </div>
          {message ? (
            <p role="status" className="mt-3 text-xs text-muted-foreground">
              {message}
            </p>
          ) : null}
        </section>,
        settingsSlot,
      )
    : null;

  return (
    <>
      <Suspense fallback={null}>
        <CloudAiBridge
          user={user}
          meetings={meetings}
          personalItems={personalItems}
          preferences={preferences}
          gapPreferences={gapPreferences}
          academic={academic}
          onLoadPrivate={onLoadPrivate}
        />
      </Suspense>
      {controls}
    </>
  );
}
