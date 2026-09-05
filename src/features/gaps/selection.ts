type GapSelectionListener = (gapId: string) => void;

let queuedGapId: string | null = null;
const listeners = new Set<GapSelectionListener>();

/**
 * Keeps timetable-derived selection ephemeral and browser-local. The selected
 * gap never needs to be encoded into a shareable URL or sent to a service.
 */
export function queueGapPlanSelection(gapId: string) {
  queuedGapId = gapId;
  for (const listener of listeners) listener(gapId);
}

export function peekQueuedGapPlanSelection() {
  return queuedGapId;
}

export function clearQueuedGapPlanSelection(gapId?: string) {
  if (gapId === undefined || queuedGapId === gapId) queuedGapId = null;
}

export function subscribeGapPlanSelection(listener: GapSelectionListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
