import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { DEFAULT_GAP_PREFERENCES } from "@/features/gaps/preferences";
import { isEncryptedPrivateCloudAuthoritative } from "@/features/security/private-cloud-mode";
import type { PrivateDataPayloadV1 } from "@/features/security/private-data";
import type { GuestTimetableRestoration } from "@/features/security/guest-timetable";
import { cloudRestoration, isRestorationAbort } from "@/features/sync/cloud-restoration";
import { DEFAULT_USER_PREFERENCES, type UserPreferences } from "@/features/sync/preferences";
import {
  isCurrentRestorationRequest,
  memoryCandidate,
  shouldClearAccountState,
  type RestoredSource,
} from "@/features/sync/restoration-decisions";
import { chooseRestoration, type RestorationState } from "@/features/sync/restoration";
import { isCloudRestoreSuppressed } from "@/features/sync/restore-preference";
import type { GapPreferences } from "@/features/gaps/types";
import type { PersonalItem } from "@/lib/personal-types";
import type { Meeting } from "@/lib/timetable-types";

type RestorationInput = {
  authLoading: boolean;
  authError: string | null;
  userId: string | null;
  guest: GuestTimetableRestoration | null;
  meetings: Meeting[] | null;
  setMeetings: Dispatch<SetStateAction<Meeting[] | null>>;
  setPersonalItems: Dispatch<SetStateAction<PersonalItem[]>>;
  setPreferences: Dispatch<SetStateAction<UserPreferences>>;
  setGapPreferences: Dispatch<SetStateAction<GapPreferences>>;
  setWarnings: Dispatch<SetStateAction<string[]>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setIsDemo: Dispatch<SetStateAction<boolean>>;
};

/**
 * Owns auth generations and persistence-source selection. The returned meeting ref is the
 * browser's active operational schedule; cloud and guest records are restoration inputs only.
 */
export function useAuthenticatedRestoration(input: RestorationInput) {
  const {
    authLoading,
    authError,
    userId,
    guest,
    meetings,
    setMeetings,
    setPersonalItems,
    setPreferences,
    setGapPreferences,
    setWarnings,
    setError,
    setIsDemo,
  } = input;
  const [restoration, setRestoration] = useState<RestorationState>("waiting-for-auth");
  const [restorationMessage, setRestorationMessage] = useState<string | null>(null);
  const restoredSource = useRef<RestoredSource>("none");
  const latestMeetings = useRef<Meeting[] | null>(meetings);
  const lastEncryptedFingerprint = useRef<string | null>(null);
  const mounted = useRef(false);
  const requestVersion = useRef(0);
  const requestedUser = useRef<string | null>(null);
  const previousUser = useRef<string | null>(null);

  latestMeetings.current = meetings;

  const applyPrivateData = useCallback(
    (payload: PrivateDataPayloadV1) => {
      latestMeetings.current = payload.schedule;
      setMeetings(payload.schedule);
      setPersonalItems(payload.personalItems);
      setPreferences(payload.preferences);
      setGapPreferences(payload.gapPreferences);
      setWarnings([]);
      setError(null);
      setIsDemo(false);
      // Prevent autosave from echoing an unchanged restored payload back to persistence.
      lastEncryptedFingerprint.current = JSON.stringify(payload);
    },
    [
      setError,
      setGapPreferences,
      setIsDemo,
      setMeetings,
      setPersonalItems,
      setPreferences,
      setWarnings,
    ],
  );

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (authLoading || guest === null) {
      setRestoration("waiting-for-auth");
      return;
    }
    if (!userId) {
      const returningFromAccount = previousUser.current !== null;
      cloudRestoration.cancel(previousUser.current);
      requestVersion.current += 1;
      requestedUser.current = null;
      let currentMeetings = latestMeetings.current;
      if (shouldClearAccountState(previousUser.current, restoredSource.current)) {
        currentMeetings = null;
        latestMeetings.current = null;
        setMeetings(null);
        if (isEncryptedPrivateCloudAuthoritative) {
          setPersonalItems([]);
          setPreferences(DEFAULT_USER_PREFERENCES);
          setGapPreferences(DEFAULT_GAP_PREFERENCES);
          lastEncryptedFingerprint.current = null;
        }
      }
      previousUser.current = null;
      const guestRecord = guest.meetings
        ? { data: guest.meetings, updatedAt: guest.updatedAt }
        : null;
      const choice = chooseRestoration(
        memoryCandidate(restoredSource.current, currentMeetings),
        guestRecord,
        null,
      );
      if (choice.meetings && choice.source !== "memory") {
        latestMeetings.current = choice.meetings;
        setMeetings(choice.meetings);
      }
      restoredSource.current = choice.source;
      setRestoration(authError ? "failed" : choice.state);
      if (authError) {
        setRestorationMessage(
          "We couldn't restore your signed-in session. Cloud restore is unavailable.",
        );
      } else if (returningFromAccount) {
        setRestorationMessage(null);
      }
      return;
    }

    if (previousUser.current !== userId) {
      cloudRestoration.cancel(previousUser.current);
      requestVersion.current += 1;
      requestedUser.current = null;
      if (shouldClearAccountState(previousUser.current, restoredSource.current)) {
        latestMeetings.current = null;
        setMeetings(null);
        if (isEncryptedPrivateCloudAuthoritative) {
          setPersonalItems([]);
          setPreferences(DEFAULT_USER_PREFERENCES);
          setGapPreferences(DEFAULT_GAP_PREFERENCES);
          lastEncryptedFingerprint.current = null;
        }
      }
      previousUser.current = userId;
    }

    if (isCloudRestoreSuppressed(userId)) {
      requestedUser.current = userId;
      setRestoration("no-cloud-data");
      setRestorationMessage(
        "Automatic cloud restore is paused on this browser. Use Load private data when you want it back.",
      );
      return;
    }
    if (latestMeetings.current?.length && restoredSource.current === "memory") {
      setRestoration("restored-memory");
      return;
    }
    if (requestedUser.current === userId) return;

    requestedUser.current = userId;
    const version = ++requestVersion.current;
    setRestoration("checking-cloud");
    setRestorationMessage(null);
    void cloudRestoration
      .restore(userId)
      .then((cloud) => {
        if (
          !isCurrentRestorationRequest({
            mounted: mounted.current,
            currentVersion: requestVersion.current,
            requestVersion: version,
            currentUserId: previousUser.current,
            requestUserId: userId,
          })
        )
          return;
        const choice = chooseRestoration(
          memoryCandidate(restoredSource.current, latestMeetings.current),
          null,
          cloud,
        );
        if (choice.meetings && choice.source !== "memory") {
          latestMeetings.current = choice.meetings;
          setMeetings(choice.meetings);
        }
        if (choice.source === "cloud" && cloud?.privateData) applyPrivateData(cloud.privateData);
        restoredSource.current = choice.source;
        setRestoration(choice.state);
        if (choice.state === "cloud-version-available") {
          setRestorationMessage("A cloud version is available; your local timetable was kept.");
        } else if (choice.source === "cloud" && cloud?.persistentKeys === false) {
          setRestorationMessage(
            "Encrypted data restored. This browser cannot persist non-extractable keys, so another broker check will be needed after reload.",
          );
        }
      })
      .catch((error: unknown) => {
        if (isRestorationAbort(error)) return;
        if (
          !isCurrentRestorationRequest({
            mounted: mounted.current,
            currentVersion: requestVersion.current,
            requestVersion: version,
            currentUserId: previousUser.current,
            requestUserId: userId,
          })
        )
          return;
        const choice = chooseRestoration(
          memoryCandidate(restoredSource.current, latestMeetings.current),
          null,
          null,
        );
        if (choice.meetings && choice.source !== "memory") {
          latestMeetings.current = choice.meetings;
          setMeetings(choice.meetings);
        }
        restoredSource.current = choice.source;
        setRestoration("failed");
        setRestorationMessage(
          "We couldn't restore your cloud timetable. Your local timetable is unchanged.",
        );
      });
  }, [
    applyPrivateData,
    authError,
    authLoading,
    guest,
    setGapPreferences,
    setMeetings,
    setPersonalItems,
    setPreferences,
    userId,
  ]);

  return {
    restoration,
    setRestoration,
    restorationMessage,
    setRestorationMessage,
    restoredSource,
    latestMeetings,
    lastEncryptedFingerprint,
    applyPrivateData,
  };
}
