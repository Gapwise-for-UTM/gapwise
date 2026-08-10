import type { User } from "@supabase/supabase-js";
import { Building2, CloudDownload, CloudUpload, Home, TrainFront } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { UTM_RESIDENCES } from "@/data/utm/building-registry";
import { sanitizeUserPreferences, type UserPreferences } from "./preferences";
import { loadPreferences, savePreferences } from "./sync-service";

export function ResidenceSettings({
  user,
  preferences,
  onPreferencesChange,
}: {
  user: User | null;
  preferences: UserPreferences;
  onPreferencesChange: (preferences: UserPreferences) => void;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const selectedResidence = UTM_RESIDENCES.find(
    (building) => building.code === preferences.residenceBuildingCode,
  );

  function update(patch: Partial<UserPreferences>) {
    onPreferencesChange(sanitizeUserPreferences({ ...preferences, ...patch }));
    setMessage("Saved on this device.");
  }

  async function saveToCloud() {
    setBusy(true);
    setMessage(null);
    try {
      await savePreferences(preferences);
      setMessage("Home setting saved to your account.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Cloud save failed.");
    } finally {
      setBusy(false);
    }
  }

  async function loadFromCloud() {
    setBusy(true);
    setMessage(null);
    try {
      const value = await loadPreferences();
      if (value) onPreferencesChange(value);
      setMessage(value ? "Account settings loaded." : "No saved account settings yet.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Cloud load failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="button-secondary inline-flex min-h-9 items-center gap-2 px-3 text-sm font-medium"
          aria-label="Home and commute settings"
        >
          <Home className="h-4 w-4 text-accent" aria-hidden="true" />
          <span className="hidden max-w-28 truncate sm:inline">
            {selectedResidence ? selectedResidence.code : "Home"}
          </span>
        </button>
      </DialogTrigger>
      <DialogContent className="glass-panel mx-4 w-[calc(100%-2rem)] max-w-md rounded-xl border-border/80 shadow-none">
        <DialogHeader>
          <DialogTitle>Where does your campus day start?</DialogTitle>
          <DialogDescription>
            Gapwise uses this only for day routes and gap suggestions. No live location is
            collected.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Campus day origin">
          <button
            type="button"
            role="radio"
            aria-checked={preferences.dayOrigin === "commute"}
            onClick={() => update({ dayOrigin: "commute", residenceBuildingCode: null })}
            className={`rounded-lg border p-3 text-left transition-colors ${
              preferences.dayOrigin === "commute"
                ? "border-accent/60 bg-accent/10"
                : "border-border bg-card/80 hover:bg-muted/60"
            }`}
          >
            <TrainFront className="h-4 w-4 text-accent" aria-hidden="true" />
            <span className="mt-2 block text-sm font-semibold">I commute</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">Keep today’s flow.</span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={preferences.dayOrigin === "residence"}
            onClick={() =>
              update({
                dayOrigin: "residence",
                residenceBuildingCode: preferences.residenceBuildingCode ?? UTM_RESIDENCES[0]!.code,
              })
            }
            className={`rounded-lg border p-3 text-left transition-colors ${
              preferences.dayOrigin === "residence"
                ? "border-accent/60 bg-accent/10"
                : "border-border bg-card/80 hover:bg-muted/60"
            }`}
          >
            <Building2 className="h-4 w-4 text-accent" aria-hidden="true" />
            <span className="mt-2 block text-sm font-semibold">I live on campus</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Route from residence.
            </span>
          </button>
        </div>

        {preferences.dayOrigin === "residence" ? (
          <label className="text-sm font-medium" htmlFor="residence-building">
            Residence building
            <select
              id="residence-building"
              value={preferences.residenceBuildingCode ?? UTM_RESIDENCES[0]!.code}
              onChange={(event) =>
                update({ dayOrigin: "residence", residenceBuildingCode: event.target.value })
              }
              className="mt-2 min-h-11 w-full rounded-lg border border-input bg-card px-3 text-sm"
            >
              {UTM_RESIDENCES.map((building) => (
                <option key={building.code} value={building.code}>
                  {building.name} ({building.code})
                </option>
              ))}
            </select>
            <span className="mt-2 block text-xs font-normal leading-relaxed text-muted-foreground">
              Residence approaches come from the bundled campus map. Unverified doors are clearly
              marked in route details.
            </span>
          </label>
        ) : null}

        {user ? (
          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <button
              type="button"
              disabled={busy}
              onClick={() => void saveToCloud()}
              className="button-primary inline-flex min-h-9 items-center gap-2 px-3 text-xs font-semibold disabled:opacity-50"
            >
              <CloudUpload className="h-3.5 w-3.5" aria-hidden="true" /> Save to account
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void loadFromCloud()}
              className="button-secondary inline-flex min-h-9 items-center gap-2 px-3 text-xs font-semibold disabled:opacity-50"
            >
              <CloudDownload className="h-3.5 w-3.5" aria-hidden="true" /> Load account setting
            </button>
          </div>
        ) : (
          <p className="border-t border-border pt-4 text-xs text-muted-foreground">
            Stored only in this browser. Sign in if you want to sync it across devices.
          </p>
        )}
        {message ? (
          <p className="text-xs text-muted-foreground" role="status">
            {message}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
