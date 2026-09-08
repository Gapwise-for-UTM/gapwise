import { useEffect, useState } from "react";
import type { GuestTimetableRestoration } from "@/features/security/guest-timetable";
import { loadRememberedRecord } from "@/hooks/use-preferences";

const EMPTY_GUEST_RESTORATION: GuestTimetableRestoration = {
  remember: false,
  meetings: null,
  updatedAt: null,
};
const GUEST_PERSISTENCE_EVENT = "gapwise:guest-timetable-persistence";

type GuestPersistenceEvent = CustomEvent<GuestTimetableRestoration>;

export function useGuestTimetableRestoration() {
  const [record, setRecord] = useState<GuestTimetableRestoration | null>(null);
  const [remember, setRemember] = useState(false);

  useEffect(() => {
    loadRememberedRecord<unknown>();
    let active = true;
    void import("@/features/security/guest-timetable")
      .then(({ loadGuestTimetable }) => loadGuestTimetable())
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

  useEffect(() => {
    const handlePersistenceChange = (event: Event) => {
      const detail = (event as GuestPersistenceEvent).detail;
      if (!detail || typeof detail.remember !== "boolean") return;
      setRecord(detail);
      setRemember(detail.remember);
    };
    window.addEventListener(GUEST_PERSISTENCE_EVENT, handlePersistenceChange);
    return () => window.removeEventListener(GUEST_PERSISTENCE_EVENT, handlePersistenceChange);
  }, []);

  return { record, setRecord, remember, setRemember };
}
