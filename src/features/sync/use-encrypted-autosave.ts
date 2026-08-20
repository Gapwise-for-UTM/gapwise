import { useEffect, useRef, type MutableRefObject } from "react";
import { isEncryptedPrivateCloudAuthoritative } from "@/features/security/private-cloud-mode";
import {
  isEncryptedSyncOptedIn,
  saveEncryptedPrivateState,
} from "@/features/sync/encrypted-sync-service";
import type { GapPreferences } from "@/features/gaps/types";
import type { PersonalItem } from "@/lib/personal-types";
import type { Meeting } from "@/lib/timetable-types";
import type { UserPreferences } from "@/features/sync/preferences";
import type { AcademicState } from "@/features/academic/state";

type AutosaveInput = {
  userId: string | null;
  meetings: Meeting[] | null;
  personalItems: PersonalItem[];
  preferences: UserPreferences;
  gapPreferences: GapPreferences;
  academic: AcademicState;
  isDemo: boolean;
  isOnline: boolean;
  restoredFingerprint: MutableRefObject<string | null>;
  onFailure: () => void;
};

export function useEncryptedAutosave({
  userId,
  meetings,
  personalItems,
  preferences,
  gapPreferences,
  academic,
  isDemo,
  isOnline,
  restoredFingerprint,
  onFailure,
}: AutosaveInput) {
  const failureHandler = useRef(onFailure);
  failureHandler.current = onFailure;

  useEffect(() => {
    if (
      !isEncryptedPrivateCloudAuthoritative ||
      !userId ||
      meetings === null ||
      isDemo ||
      !isEncryptedSyncOptedIn(userId)
    ) {
      return;
    }
    const input = { schedule: meetings, personalItems, preferences, gapPreferences, academic };
    const fingerprint = JSON.stringify({ schemaVersion: 2, ...input });
    if (fingerprint === restoredFingerprint.current) return;
    const timeout = window.setTimeout(() => {
      restoredFingerprint.current = fingerprint;
      void saveEncryptedPrivateState(userId, input, {
        requireExistingOptIn: true,
        localOnly: !isOnline,
      }).catch(() => {
        if (restoredFingerprint.current === fingerprint) restoredFingerprint.current = null;
        failureHandler.current();
      });
    }, 750);
    return () => window.clearTimeout(timeout);
  }, [
    gapPreferences,
    academic,
    isDemo,
    isOnline,
    meetings,
    personalItems,
    preferences,
    restoredFingerprint,
    userId,
  ]);
}
