import { useEffect, useRef, type MutableRefObject } from "react";
import { isEncryptedPrivateCloudAuthoritative } from "@/features/security/private-cloud-mode";
import { chooseAutosaveTarget } from "@/features/sync/autosave-reconnect";
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
  const activeUserId = useRef<string | null>(null);
  const lastCloudFingerprint = useRef<string | null>(null);
  const pendingOfflineFingerprint = useRef<string | null>(null);
  failureHandler.current = onFailure;

  useEffect(() => {
    if (!isEncryptedPrivateCloudAuthoritative || !userId || meetings === null || isDemo) return;

    let cancelled = false;
    let timeout: number | null = null;

    void import("@/features/sync/encrypted-sync-service").then(
      ({ isEncryptedSyncOptedIn, saveEncryptedPrivateState }) => {
        if (cancelled || !isEncryptedSyncOptedIn(userId)) return;

        if (activeUserId.current !== userId) {
          activeUserId.current = userId;
          lastCloudFingerprint.current = null;
          pendingOfflineFingerprint.current = null;
        }

        const data = { schedule: meetings, personalItems, preferences, gapPreferences, academic };
        const fingerprint = JSON.stringify({ schemaVersion: 2, ...data });

        if (
          isOnline &&
          lastCloudFingerprint.current === null &&
          pendingOfflineFingerprint.current === null &&
          restoredFingerprint.current !== null
        ) {
          lastCloudFingerprint.current = restoredFingerprint.current;
        }

        const target = chooseAutosaveTarget({
          fingerprint,
          lastCloudFingerprint: lastCloudFingerprint.current,
          pendingOfflineFingerprint: pendingOfflineFingerprint.current,
          isOnline,
        });
        if (target === "skip" || cancelled) return;

        timeout = window.setTimeout(() => {
          if (cancelled) return;
          if (target === "local") {
            pendingOfflineFingerprint.current = fingerprint;
            void saveEncryptedPrivateState(userId, data, {
              requireExistingOptIn: true,
              localOnly: true,
            }).catch(() => {
              if (pendingOfflineFingerprint.current === fingerprint) {
                pendingOfflineFingerprint.current = null;
              }
              failureHandler.current();
            });
            return;
          }

          const previousCloudFingerprint = lastCloudFingerprint.current;
          lastCloudFingerprint.current = fingerprint;
          pendingOfflineFingerprint.current = null;
          restoredFingerprint.current = fingerprint;
          void saveEncryptedPrivateState(userId, data, {
            requireExistingOptIn: true,
            localOnly: false,
          }).catch(() => {
            if (lastCloudFingerprint.current === fingerprint) {
              lastCloudFingerprint.current = previousCloudFingerprint;
              pendingOfflineFingerprint.current = fingerprint;
            }
            if (restoredFingerprint.current === fingerprint) {
              restoredFingerprint.current = previousCloudFingerprint;
            }
            failureHandler.current();
          });
        }, 750);
      },
    );

    return () => {
      cancelled = true;
      if (timeout !== null) window.clearTimeout(timeout);
    };
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
