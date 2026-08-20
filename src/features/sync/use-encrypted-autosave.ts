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

type AutosaveInput = {
  userId: string | null;
  meetings: Meeting[] | null;
  personalItems: PersonalItem[];
  preferences: UserPreferences;
  gapPreferences: GapPreferences;
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
    const input = { schedule: meetings, personalItems, preferences, gapPreferences };
    const fingerprint = JSON.stringify({ schemaVersion: 1, ...input });
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
    isDemo,
    isOnline,
    meetings,
    personalItems,
    preferences,
    restoredFingerprint,
    userId,
  ]);
}
