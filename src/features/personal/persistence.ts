import { PersonalItem } from "@/lib/personal-types";
import { isEncryptedPrivateCloudAuthoritative } from "@/features/security/private-cloud-mode";

const STORAGE_KEY = "gapwise:personal:v1";

export function loadPersonalItems(): PersonalItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PersonalItem[];
    return parsed;
  } catch {
    return [];
  }
}

export function savePersonalItems(items: PersonalItem[]) {
  if (typeof window === "undefined") return;
  if (isEncryptedPrivateCloudAuthoritative) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore storage errors
  }
}

export function clearStoredPersonalItems() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // A verified encrypted copy still exists; blocked storage needs no cleanup.
  }
}
