import {
  useCallback,
  type ChangeEvent,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { clearGuestTimetable, saveGuestTimetable } from "@/features/security/guest-timetable";
import type { GuestTimetableRestoration } from "@/features/security/guest-timetable";
import type { PrivateDataPayloadV1 } from "@/features/security/private-data";
import { clearPrivateCloudLocalUser } from "@/features/sync/encrypted-sync-service";
import type { RestoredSource } from "@/features/sync/restoration-decisions";
import type { RestorationState } from "@/features/sync/restoration";
import { setCloudRestoreSuppressed } from "@/features/sync/restore-preference";
import { DEMO_MEETINGS } from "@/lib/demo-timetable";
import type { Meeting } from "@/lib/timetable-types";
import {
  describeTimetableChanges,
  parseTimetableText,
  timetableImportError,
  validateTimetableFile,
} from "./import-lifecycle";

type TimetableCommandInput = {
  meetings: Meeting[] | null;
  setMeetings: Dispatch<SetStateAction<Meeting[] | null>>;
  setWarnings: Dispatch<SetStateAction<string[]>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  remember: boolean;
  setRemember: Dispatch<SetStateAction<boolean>>;
  setGuestRestoration: Dispatch<SetStateAction<GuestTimetableRestoration | null>>;
  userId: string | null;
  isDemo: boolean;
  setIsDemo: Dispatch<SetStateAction<boolean>>;
  latestMeetings: MutableRefObject<Meeting[] | null>;
  restoredSource: MutableRefObject<RestoredSource>;
  setRestoration: Dispatch<SetStateAction<RestorationState>>;
  setRestorationMessage: Dispatch<SetStateAction<string | null>>;
  applyPrivateData: (payload: PrivateDataPayloadV1) => void;
};

/** Explicit browser-owned timetable commands shared by desktop and mobile presentation. */
export function useTimetableCommands(input: TimetableCommandInput) {
  const clearView = useCallback(() => {
    input.setMeetings(null);
    input.latestMeetings.current = null;
    input.restoredSource.current = "none";
    input.setRestoration("no-cloud-data");
    input.setRestorationMessage(null);
    input.setWarnings([]);
    input.setError(null);
    input.setIsDemo(false);
  }, [input]);

  const importFile = useCallback(
    async (file: File) => {
      const previousMeetings = input.latestMeetings.current;
      input.setError(null);
      const validationError = validateTimetableFile(file);
      if (validationError) {
        if (previousMeetings?.length) {
          input.setRestorationMessage(`Update failed · ${validationError}`);
        } else input.setError(validationError);
        return;
      }
      input.setRestorationMessage(null);
      input.setLoading(true);
      try {
        const result = await parseTimetableText(await file.text());
        let persistenceWarning: string | null = null;
        if (input.remember && !input.userId) {
          try {
            await saveGuestTimetable(result.meetings);
            input.setGuestRestoration({
              remember: true,
              meetings: result.meetings,
              updatedAt: new Date().toISOString(),
            });
          } catch {
            input.setRemember(false);
            persistenceWarning =
              "This browser could not keep an encrypted device copy. Your open timetable is unchanged.";
          }
        }
        input.setMeetings(result.meetings);
        input.latestMeetings.current = result.meetings;
        input.restoredSource.current = "memory";
        input.setRestoration("restored-memory");
        input.setRestorationMessage(
          previousMeetings?.length
            ? (persistenceWarning ??
                `Timetable updated · ${describeTimetableChanges(previousMeetings, result.meetings)}`)
            : persistenceWarning,
        );
        input.setWarnings(result.warnings);
        input.setIsDemo(false);
      } catch (error) {
        const message = timetableImportError(error);
        if (previousMeetings?.length) {
          input.setRestorationMessage(`Update failed · ${message}`);
        } else {
          input.setMeetings(null);
          input.latestMeetings.current = null;
          input.restoredSource.current = "none";
          input.setWarnings([]);
          input.setError(message);
        }
      } finally {
        input.setLoading(false);
      }
    },
    [input],
  );

  const handleFileInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) void importFile(file);
      event.target.value = "";
    },
    [importFile],
  );

  const loadDemo = useCallback(() => {
    input.setError(null);
    input.setWarnings([]);
    input.setMeetings(DEMO_MEETINGS);
    input.latestMeetings.current = DEMO_MEETINGS;
    input.restoredSource.current = "memory";
    input.setRestoration("restored-memory");
    input.setRestorationMessage(null);
    input.setIsDemo(true);
  }, [input]);

  const remove = useCallback(async () => {
    try {
      if (input.userId) {
        await clearPrivateCloudLocalUser(input.userId);
        setCloudRestoreSuppressed(input.userId, true);
      } else {
        await clearGuestTimetable();
        input.setGuestRestoration({ remember: false, meetings: null, updatedAt: null });
        input.setRemember(false);
      }
      clearView();
    } catch {
      input.setRestorationMessage(
        "This browser could not clear its encrypted local copy, so the timetable was left in place.",
      );
    }
  }, [clearView, input]);

  const confirmRemove = useCallback(() => {
    const cloudNote = input.userId
      ? " Your encrypted cloud copy will remain available from Load private data."
      : "";
    if (
      window.confirm(
        `Remove this timetable and its encrypted local copy from this browser?${cloudNote}`,
      )
    ) {
      void remove();
    }
  }, [input.userId, remove]);

  const loadCloud = useCallback(
    (cloudMeetings: Meeting[]) => {
      input.setMeetings(cloudMeetings);
      input.latestMeetings.current = cloudMeetings;
      input.setWarnings([]);
      input.setError(null);
      input.setIsDemo(false);
      if (input.userId) setCloudRestoreSuppressed(input.userId, false);
      input.restoredSource.current = "cloud";
      input.setRestoration("restored-cloud");
    },
    [input],
  );

  const loadPrivate = useCallback(
    (payload: PrivateDataPayloadV1) => {
      if (input.userId) setCloudRestoreSuppressed(input.userId, false);
      input.applyPrivateData(payload);
      input.restoredSource.current = "cloud";
      input.setRestoration("restored-cloud");
      input.setRestorationMessage(null);
    },
    [input],
  );

  const setRemembered = useCallback(
    (value: boolean) => {
      input.setRemember(value);
      if (input.userId) return;
      input.setRestorationMessage(
        value ? "Setting up encrypted device restore…" : "Removing the encrypted device copy…",
      );
      void (
        value ? saveGuestTimetable(input.isDemo ? null : input.meetings) : clearGuestTimetable()
      )
        .then(() => {
          input.setGuestRestoration({
            remember: value,
            meetings: value && !input.isDemo ? input.meetings : null,
            updatedAt: value && input.meetings && !input.isDemo ? new Date().toISOString() : null,
          });
          input.setRestorationMessage(
            value
              ? "Encrypted device restore is on for this browser."
              : "Encrypted device restore is off and its local copy was removed.",
          );
        })
        .catch(() => {
          input.setRemember(!value);
          input.setRestorationMessage("Secure device storage is unavailable in this browser.");
        });
    },
    [input],
  );

  return {
    importFile,
    handleFileInputChange,
    loadDemo,
    clearView,
    confirmRemove,
    loadCloud,
    loadPrivate,
    setRemembered,
  };
}
