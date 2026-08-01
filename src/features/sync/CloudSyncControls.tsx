import type { User } from "@supabase/supabase-js";
import { CloudDownload, CloudUpload, Trash2 } from "lucide-react";
import { useState } from "react";
import type { Meeting } from "@/lib/timetable-types";
import { isSupabaseConfigured } from "@/lib/supabase";
import { deleteSchedule, loadSchedule, saveSchedule } from "./sync-service";
import type { RestorationState } from "./restoration";

export function CloudSyncControls({
  user,
  meetings,
  sourceFilename,
  onLoad,
  restorationState,
}: {
  user: User | null;
  meetings: Meeting[] | null;
  sourceFilename: string | null;
  onLoad: (meetings: Meeting[]) => void;
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
    <section className="border-t border-border py-4" aria-labelledby="cloud-sync-title">
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
            Only normalized meetings are stored. The original .ics file is never uploaded.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!enabled || !meetings?.length || busy}
            onClick={() =>
              void run(async () => {
                await saveSchedule(meetings!, sourceFilename);
                return "Normalized timetable synced.";
              })
            }
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CloudUpload className="h-3.5 w-3.5" aria-hidden="true" />
            Sync timetable
          </button>
          <button
            type="button"
            disabled={!enabled || busy}
            onClick={() =>
              void run(async () => {
                const cloudMeetings = await loadSchedule();
                if (!cloudMeetings?.length) return "No cloud timetable was found.";
                onLoad(cloudMeetings);
                return "Cloud timetable loaded into this browser.";
              })
            }
            className="inline-flex items-center gap-2 rounded-lg border border-input bg-card px-3 py-2 text-xs font-semibold hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CloudDownload className="h-3.5 w-3.5" aria-hidden="true" />
            Load cloud timetable
          </button>
          <button
            type="button"
            disabled={!enabled || busy}
            onClick={() => {
              if (!window.confirm("Delete your synced timetable from your account?")) return;
              void run(async () => {
                await deleteSchedule();
                return "Cloud timetable deleted. The local timetable was not changed.";
              });
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-destructive/40 bg-card px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Delete cloud timetable
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
