const RESTORE_SUPPRESSION_PREFIX = "gapwise:cloud-restore-suppressed:";

function key(userId: string) {
  return `${RESTORE_SUPPRESSION_PREFIX}${userId}`;
}

export function isCloudRestoreSuppressed(userId: string): boolean {
  try {
    return window.localStorage.getItem(key(userId)) === "1";
  } catch {
    return false;
  }
}

export function setCloudRestoreSuppressed(userId: string, suppressed: boolean): void {
  try {
    if (suppressed) window.localStorage.setItem(key(userId), "1");
    else window.localStorage.removeItem(key(userId));
  } catch {
    // Storage denial cannot make private data less protected; it only prevents suppression.
  }
}
