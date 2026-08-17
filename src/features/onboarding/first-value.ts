import { useCallback, useEffect, useState } from "react";

const PENDING_KEY = "gapwise:first-value-pending:v1";
const SEEN_KEY = "gapwise:first-value-seen:v1";
const PENDING_TTL_MS = 10 * 60 * 1000;

type FirstValueSource = "import";

type PendingFirstValue = {
  source: FirstValueSource;
  createdAt: number;
};

type FirstValueArrival = {
  source: FirstValueSource | null;
  showSuccess: boolean;
  showHint: boolean;
  emphasize: boolean;
};

const EMPTY_ARRIVAL: FirstValueArrival = {
  source: null,
  showSuccess: false,
  showHint: false,
  emphasize: false,
};

function readPending(): PendingFirstValue | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingFirstValue>;
    if (parsed.source !== "import" || typeof parsed.createdAt !== "number") {
      window.sessionStorage.removeItem(PENDING_KEY);
      return null;
    }
    if (Date.now() - parsed.createdAt > PENDING_TTL_MS) {
      window.sessionStorage.removeItem(PENDING_KEY);
      return null;
    }
    return { source: parsed.source, createdAt: parsed.createdAt };
  } catch {
    return null;
  }
}

export function markFirstValuePending() {
  if (typeof window === "undefined") return;
  try {
    const value: PendingFirstValue = { source: "import", createdAt: Date.now() };
    window.sessionStorage.setItem(PENDING_KEY, JSON.stringify(value));
  } catch {
    // Session storage is a progressive enhancement. Import must still work without it.
  }
}

export function clearFirstValuePending() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // Ignore storage failures; this marker never contains timetable data.
  }
}

export function hasPendingFirstValue() {
  return readPending() !== null;
}

function consumePending(): FirstValueSource | null {
  const pending = readPending();
  if (!pending) return null;
  clearFirstValuePending();
  return pending.source;
}

function isFirstValueSeen() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function markFirstValueSeen() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // The hint can safely reappear if local preferences are unavailable.
  }
}

/** Claims a freshly imported handoff only while the Today route is active. */
export function useFirstValueArrival(active: boolean) {
  const [arrival, setArrival] = useState<FirstValueArrival>(EMPTY_ARRIVAL);

  useEffect(() => {
    if (!active) {
      setArrival(EMPTY_ARRIVAL);
      return;
    }

    const source = consumePending();
    if (!source) return;

    const firstVisit = !isFirstValueSeen();
    if (firstVisit) markFirstValueSeen();

    setArrival({ source, showSuccess: true, showHint: firstVisit, emphasize: firstVisit });

    const successTimer = window.setTimeout(() => {
      setArrival((current) => ({ ...current, showSuccess: false }));
    }, 2200);

    return () => {
      window.clearTimeout(successTimer);
    };
  }, [active]);

  const dismissHint = useCallback(() => {
    setArrival((current) => ({ ...current, showHint: false, emphasize: false }));
  }, []);
  const acknowledge = useCallback(() => {
    setArrival((current) => ({ ...current, showHint: false, emphasize: false }));
  }, []);

  return { ...arrival, dismissHint, acknowledge };
}
