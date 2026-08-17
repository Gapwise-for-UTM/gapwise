import type { User } from "@supabase/supabase-js";
import { CloudDownload, CloudUpload, Trash2 } from "lucide-react";
import { useState } from "react";
import type { GapPreferences } from "@/features/gaps/types";
import type { PrivateDataPayloadV1 } from "@/features/security/private-data";
import type { PersonalItem } from "@/lib/personal-types";
import type { Meeting } from "@/lib/timetable-types";
import { emitClickSpark } from "@/lib/micro-interactions";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  deleteEncryptedPrivateCloud,
  loadEncryptedPrivateState,
  saveEncryptedPrivateState,
} from "./encrypted-sync-service";
import type { UserPreferences } from "./preferences";
import type { RestorationState } from "./restoration";
import { setCloudRestoreSuppressed } from "./restore-preference";

export function CloudSyncControls({
  user,
  meetings,
  personalItems,
  preferences,
  gapPreferences,
  onLoadPrivate,
  restorationState,
}: {
  user: User | null;
  meetings: Meeting[] | null;
  personalItems: PersonalItem[];
  preferences: UserPreferences;
  gapPreferences: GapPreferences;
  onLoad: (meetings: Meeting[]) => void;
  onLoadPrivate: (payload: PrivateDataPayloadV1) => void;
  restorationState: RestorationState;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const enabled = isSupabaseConfigured && Boolean(user);

  async function run(action: () => Promise<string>) {
    setBusy(true);
    setMessage(null);
    try {
      setMessage(await action());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Cloud sync failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="surface p-4 sm:p-5" aria-labelledby="cloud-sync-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="cloud-sync-title" className="text-sm font-semibold">Sync across devices</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Your private Gapwise data is encrypted in your browser before it is stored. Sync is
            optional. The original .ics file is never uploaded.
          </p>
          <p className="mt-1 text-[0.68rem] text-muted-foreground">
            {restorationState === "checking-cloud"
              ? "Checking for an encrypted copy…"
              : restorationState === "restored-cloud"
                ? "Encrypted private data restored in this browser."
                : restorationState === "cloud-version-available"
                  ? "An encrypted cloud version is available."
                  : "This browser is currently using local data."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!enabled || busy}
            onClick={(event) => {
              emitClickSpark(event);
              void run(async () => {
                const result = await saveEncryptedPrivateState(user!.id, {
                  schedule: meetings ?? [], personalItems, preferences, gapPreferences,
                });
                setCloudRestoreSuppressed(user!.id, false);
                return result.persistentKeys
                  ? "Private data encrypted, synced, and verified."
                  : "Private data encrypted and synced. Secure restore is available only while this page stays open on this browser.";
              });
            }}
            className="button-primary click-spark inline-flex min-h-11 items-center gap-2 px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CloudUpload className="h-3.5 w-3.5" aria-hidden="true" />
            Sync private data
          </button>
          <button
            type="button"
            disabled={!enabled || busy}
            onClick={() => void run(async () => {
              const restored = await loadEncryptedPrivateState(user!.id, undefined, true);
              if (!restored) return "No encrypted cloud data was found.";
              setCloudRestoreSuppressed(user!.id, false);
              onLoadPrivate(restored.payload);
              return "Encrypted private data loaded into this browser.";
            })}
            className="button-secondary inline-flex min-h-11 items-center gap-2 px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CloudDownload className="h-3.5 w-3.5" aria-hidden="true" />
            Load private data
          </button>
          <button
            type="button"
            disabled={!enabled || busy}
            onClick={() => {
              if (!window.confirm("Delete your synced encrypted private data from your account?")) return;
              void run(async () => {
                await deleteEncryptedPrivateCloud(user!.id);
                return "Cloud encrypted private data deleted. Local browser data was not changed.";
              });
            }}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-destructive/40 bg-card px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Delete cloud data
          </button>
        </div>
      </div>
      {!user ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {isSupabaseConfigured
            ? "Sign in only if you want cross-device sync. Guest mode remains fully functional."
            : "Cloud controls are disabled on this deployment. Guest mode remains fully functional."}
        </p>
      ) : null}
      {message ? <p role="status" className="mt-3 text-xs text-muted-foreground">{message}</p> : null}
    </section>
  );
}
