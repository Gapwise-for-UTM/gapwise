import { useEffect, useState } from "react";
import {
  loadGuestTimetable,
  type GuestTimetableRestoration,
} from "@/features/security/guest-timetable";
import { loadRememberedRecord } from "@/hooks/use-preferences";

const EMPTY_GUEST_RESTORATION: GuestTimetableRestoration = {
  remember: false,
  meetings: null,
  updatedAt: null,
};

export function useGuestTimetableRestoration() {
  const [record, setRecord] = useState<GuestTimetableRestoration | null>(null);
  const [remember, setRemember] = useState(false);

  useEffect(() => {
    // Remove obsolete plaintext persistence before reading the encrypted guest record.
    loadRememberedRecord<unknown>();
    let active = true;
    void loadGuestTimetable()
      .then((restored) => {
        if (!active) return;
        setRecord(restored);
        setRemember(restored.remember);
      })
      .catch(() => {
        if (active) setRecord(EMPTY_GUEST_RESTORATION);
      });
    return () => {
      active = false;
    };
  }, []);

  return { record, setRecord, remember, setRemember };
}
