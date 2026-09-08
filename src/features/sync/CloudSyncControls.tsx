import type { User } from "@supabase/supabase-js";
import { lazy, Suspense } from "react";
import type { AcademicState } from "@/features/academic/state";
import type { GapPreferences } from "@/features/gaps/types";
import type { PrivateDataPayloadV1 } from "@/features/security/private-data";
import type { PersonalItem } from "@/lib/personal-types";
import type { Meeting } from "@/lib/timetable-types";
import type { UserPreferences } from "./preferences";
import type { RestorationState } from "./restoration";

const CloudSyncControlsImpl = lazy(() =>
  import("./CloudSyncControlsImpl").then((module) => ({ default: module.CloudSyncControlsImpl })),
);

export function CloudSyncControls({
  user,
  meetings,
  personalItems,
  preferences,
  gapPreferences,
  academic,
  onLoad,
  onLoadPrivate,
  restorationState,
}: {
  user: User | null;
  meetings: Meeting[] | null;
  personalItems: PersonalItem[];
  preferences: UserPreferences;
  gapPreferences: GapPreferences;
  academic: AcademicState;
  onLoad: (meetings: Meeting[]) => void;
  onLoadPrivate: (payload: PrivateDataPayloadV1) => void;
  restorationState: RestorationState;
}) {
  if (!user) return null;

  return (
    <Suspense fallback={null}>
      <CloudSyncControlsImpl
        user={user}
        meetings={meetings}
        personalItems={personalItems}
        preferences={preferences}
        gapPreferences={gapPreferences}
        academic={academic}
        onLoad={onLoad}
        onLoadPrivate={onLoadPrivate}
        restorationState={restorationState}
      />
    </Suspense>
  );
}
