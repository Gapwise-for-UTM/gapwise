import type { User } from "@supabase/supabase-js";
import { Building2, BusFront, CarFront, Home, MapPin } from "lucide-react";
import { useState, type ComponentType } from "react";
import {
  campusAccessPointsFor,
  getCampusAccessPoint,
  type CampusAccessKind,
} from "@/data/utm/campus-access-points";
import { UTM_RESIDENCES } from "@/data/utm/building-registry";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { sanitizeUserPreferences, type UserPreferences } from "./preferences";

type ArrivalOption = {
  label: string;
  description: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  dayOrigin: UserPreferences["dayOrigin"];
  commuteMode: CampusAccessKind | null;
};

const ARRIVAL_OPTIONS: ArrivalOption[] = [
  {
    label: "Live on campus",
    description: "Route from residence.",
    icon: Building2,
    dayOrigin: "residence",
    commuteMode: null,
  },
  {
    label: "Public transit",
    description: "Start at a transit stop.",
    icon: BusFront,
    dayOrigin: "commute",
    commuteMode: "transit",
  },
  {
    label: "Drive / park",
    description: "Start at your parking lot.",
    icon: CarFront,
    dayOrigin: "commute",
    commuteMode: "parking",
  },
  {
    label: "Drop-off / pick-up",
    description: "Use a verified handoff point.",
    icon: MapPin,
    dayOrigin: "commute",
    commuteMode: "pickup",
  },
];

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
  const selectedResidence = UTM_RESIDENCES.find(
    (building) => building.code === preferences.residenceBuildingCode,
  );
  const selectedAccessPoint = getCampusAccessPoint(preferences.campusAccessPointId);
  const activeOption = ARRIVAL_OPTIONS.find(
    (option) =>
      option.dayOrigin === preferences.dayOrigin &&
      (option.dayOrigin === "residence" || option.commuteMode === preferences.commuteMode),
  );

  function update(patch: Partial<UserPreferences>) {
    onPreferencesChange(sanitizeUserPreferences({ ...preferences, ...patch }));
    setMessage(
      user ? "Updated. Encrypted sync will include this setting." : "Updated for this visit.",
    );
  }

  function selectOption(option: ArrivalOption) {
    if (option.dayOrigin === "residence") {
      update({
        dayOrigin: "residence",
        residenceBuildingCode: preferences.residenceBuildingCode ?? UTM_RESIDENCES[0]!.code,
        commuteMode: null,
        campusAccessPointId: null,
      });
      return;
    }
    update({
      dayOrigin: "commute",
      residenceBuildingCode: null,
      commuteMode: option.commuteMode,
      campusAccessPointId: null,
    });
  }

  const points = preferences.commuteMode ? campusAccessPointsFor(preferences.commuteMode) : [];
  const triggerLabel = selectedResidence?.code ?? selectedAccessPoint?.label ?? "Arrival";

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="button-secondary inline-flex min-h-9 items-center gap-2 px-3 text-sm font-medium"
          aria-label="Campus arrival settings"
        >
          <Home className="h-4 w-4 text-accent" aria-hidden="true" />
          <span className="hidden max-w-28 truncate sm:inline">{triggerLabel}</span>
        </button>
      </DialogTrigger>
      <DialogContent className="residence-settings-dialog glass-panel mx-4 w-[calc(100%-2rem)] max-w-xl rounded-xl border-border/80 shadow-none">
        <DialogHeader className="pr-8">
          <DialogTitle>Where does your campus day start?</DialogTitle>
          <DialogDescription>
            Gapwise only stores where your campus walk begins — not your home address.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Campus day origin">
          {ARRIVAL_OPTIONS.map((option) => {
            const Icon = option.icon;
            const checked = option === activeOption;
            return (
              <button
                key={option.label}
                type="button"
                role="radio"
                aria-checked={checked}
                onClick={() => selectOption(option)}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  checked
                    ? "border-accent/60 bg-accent/10"
                    : "border-border bg-card/80 hover:bg-muted/60"
                }`}
              >
                <Icon className="h-4 w-4 text-accent" aria-hidden="true" />
                <span className="mt-2 block text-sm font-semibold">{option.label}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {option.description}
                </span>
              </button>
            );
          })}
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
        ) : preferences.commuteMode === "pickup" && points.length === 0 ? (
          <p className="rounded-lg border border-border bg-muted/45 p-3 text-sm text-muted-foreground">
            Verified pickup/drop-off handoff points aren&apos;t mapped yet.
          </p>
        ) : preferences.commuteMode ? (
          <label className="text-sm font-medium" htmlFor="campus-access-point">
            Campus arrival point
            <select
              id="campus-access-point"
              value={preferences.campusAccessPointId ?? ""}
              onChange={(event) => update({ campusAccessPointId: event.target.value || null })}
              className="mt-2 min-h-11 w-full rounded-lg border border-input bg-card px-3 text-sm"
            >
              <option value="">Choose a verified point</option>
              {points.map((point) => (
                <option key={point.id} value={point.id}>
                  {point.label}
                </option>
              ))}
            </select>
            <span className="mt-2 block text-xs font-normal leading-relaxed text-muted-foreground">
              This is the on-campus point where walking directions begin and end.
            </span>
          </label>
        ) : (
          <p className="rounded-lg border border-border bg-muted/45 p-3 text-sm text-muted-foreground">
            Choose how you arrive to add the start and end of your campus day.
          </p>
        )}

        <p className="border-t border-border pt-4 text-xs text-muted-foreground">
          {user
            ? "This private setting is included in encrypted private-data sync."
            : "Guest settings stay in this page session. Sign in to sync private settings across devices."}
        </p>
        {message ? (
          <p className="text-xs text-muted-foreground" role="status">
            {message}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
