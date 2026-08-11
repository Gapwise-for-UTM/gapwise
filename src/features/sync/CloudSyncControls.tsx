import type { User } from "@supabase/supabase-js";
import { CloudDownload, CloudUpload, Trash2 } from "lucide-react";
import { useState } from "react";
import type { GapPreferences } from "@/features/gaps/types";
import type { PrivateDataPayloadV1 } from "@/features/security/private-data";
import {
  isEncryptedPrivateCloudAuthoritative,
  shouldWritePrivateCloud,
} from "@/features/security/private-cloud-mode";
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
import { deletePreferences, deleteSchedule, loadSchedule, saveSchedule } from "./sync-service";

export function CloudSyncControls({
  user,
  meetings,
  personalItems,
  preferences,
  gapPreferences,
  onLoad,
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
          <h2 id="cloud-sync-title" className="text-sm font-semibold">
            Cloud ·{" "}
            {restorationState === "checking-cloud"
              ? "Checking"
              : restorationState === "restored-cloud"
                ? "Restored"
                : restorationState === "cloud-version-available"
                  ? "Version available"
                  : "Local only"}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {isEncryptedPrivateCloudAuthoritative
              ? "Timetable, custom items, and private settings are encrypted before sync. The original .ics file is never uploaded."
              : shouldWritePrivateCloud
                ? "Migration mode stores the normalized timetable on the legacy path and also uploads an encrypted private-data copy. The original .ics file is never uploaded."
                : "Only normalized meetings are stored. The original .ics file is never uploaded."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!enabled || !meetings?.length || busy}
            onClick={(event) => {
              emitClickSpark(event);
              void run(async () => {
                if (!isEncryptedPrivateCloudAuthoritative) await saveSchedule(meetings!);
                if (shouldWritePrivateCloud) {
                  const result = await saveEncryptedPrivateState(user!.id, {
                    schedule: meetings!,
                    personalItems,
                    preferences,
                    gapPreferences,
                  });
                  if (!isEncryptedPrivateCloudAuthoritative) {
                    return result.persistentKeys
                      ? "Legacy plaintext timetable and encrypted migration copy synced and verified."
                      : "Legacy plaintext timetable and encrypted migration copy synced. Secure encrypted restore is available only while this page stays open on this browser.";
                  }
                  return result.persistentKeys
                    ? "Private data encrypted, synced, and verified."
                    : "Private data encrypted and synced. Secure restore is available only while this page stays open on this browser.";
                }
                return "Normalized timetable synced.";
              });
            }}
            className="button-primary click-spark inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CloudUpload className="h-3.5 w-3.5" aria-hidden="true" />
            {isEncryptedPrivateCloudAuthoritative
              ? "Sync private data"
              : shouldWritePrivateCloud
                ? "Sync migration copy"
                : "Sync timetable"}
          </button>
          <button
            type="button"
            disabled={!enabled || busy}
            onClick={() =>
              void run(async () => {
                if (isEncryptedPrivateCloudAuthoritative) {
                  const restored = await loadEncryptedPrivateState(user!.id, undefined, true);
                  if (!restored) return "No encrypted cloud data was found.";
                  onLoadPrivate(restored.payload);
                  return "Encrypted private data loaded into this browser.";
                }
                const cloudMeetings = await loadSchedule();
                if (!cloudMeetings?.length) return "No cloud timetable was found.";
                onLoad(cloudMeetings);
                return "Cloud timetable loaded into this browser.";
              })
            }
            className="button-secondary inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CloudDownload className="h-3.5 w-3.5" aria-hidden="true" />
            {isEncryptedPrivateCloudAuthoritative ? "Load private data" : "Load cloud timetable"}
          </button>
          <button
            type="button"
            disabled={!enabled || busy}
            onClick={() => {
              if (!window.confirm("Delete your synced private data from your account?")) return;
              void run(async () => {
                const results = await Promise.allSettled([
                  ...(shouldWritePrivateCloud ? [deleteEncryptedPrivateCloud(user!.id)] : []),
                  deleteSchedule(),
                  deletePreferences(),
                ]);
                if (results.some((result) => result.status === "rejected")) {
                  throw new Error(
                    "Some cloud data could not be deleted. Try again to remove the rest.",
                  );
                }
                return "Cloud private data deleted. Local browser data was not changed.";
              });
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-destructive/40 bg-card px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Delete cloud data
          </button>
        </div>
      </div>
      {!user ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {isSupabaseConfigured
            ? "Sign in to enable these controls. Guest mode remains fully functional."
            : "Cloud controls are disabled on this deployment. Guest mode remains fully functional."}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="mt-3 text-xs text-muted-foreground">
          {message}
        </p>
      ) : null}
    </section>
  );
}
