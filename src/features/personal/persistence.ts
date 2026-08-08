import { PersonalItem } from "@/lib/personal-types";

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
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore storage errors
  }
}
