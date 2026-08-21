import { useEffect, useLayoutEffect, useState } from "react";
import { isEncryptedPrivateCloudAuthoritative } from "@/features/security/private-cloud-mode";

const THEME_KEY = "gapwise:theme";

export type Theme = "light" | "dark";
export type ThemePreference = Theme | "system";

function initialThemePreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
  } catch {
    return "system";
  }
}

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(initialThemePreference);
  const [systemTheme, setSystemTheme] = useState<Theme>(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light",
  );
  const theme = preference === "system" ? systemTheme : preference;

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemTheme(media.matches ? "dark" : "light");
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useLayoutEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.dataset["theme"] = theme;
    document.documentElement.style.colorScheme = theme;
    try {
      window.localStorage.setItem(THEME_KEY, preference);
    } catch {
      // Appearance still works for the current page when persistent storage is unavailable.
    }
  }, [preference, theme]);

  return {
    theme,
    preference,
    setTheme: setPreference,
    toggleTheme: () => setPreference(theme === "dark" ? "light" : "dark"),
  };
}

const INTRO_KEY = "gapwise:intro-dismissed";

export function useIntroDismissed() {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(window.localStorage.getItem(INTRO_KEY) === "1");
  }, []);

  return {
    dismissed,
    dismiss: () => {
      window.localStorage.setItem(INTRO_KEY, "1");
      setDismissed(true);
    },
  };
}

const REMEMBER_KEY = "gapwise:remember";
const TIMETABLE_KEY = "gapwise:timetable";

export type RememberedRecord<T> = { data: T; updatedAt: string | null };

export function loadRemembered<T>(): { remember: boolean; data: T | null } {
  const record = loadRememberedRecord<T>();
  return { remember: record.remember, data: record.record?.data ?? null };
}

export function loadRememberedRecord<T>(): {
  remember: boolean;
  record: RememberedRecord<T> | null;
} {
  try {
    if (isEncryptedPrivateCloudAuthoritative) {
      window.localStorage.removeItem(TIMETABLE_KEY);
      window.localStorage.removeItem(REMEMBER_KEY);
      return { remember: false, record: null };
    }
    const remember = window.localStorage.getItem(REMEMBER_KEY) === "1";
    if (!remember) return { remember, record: null };
    const raw = window.localStorage.getItem(TIMETABLE_KEY);
    if (!raw) return { remember, record: null };
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "data" in parsed &&
      "updatedAt" in parsed
    ) {
      const value = parsed as { data: T; updatedAt: unknown };
      return {
        remember,
        record: {
          data: value.data,
          updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : null,
        },
      };
    }
    // Records saved before timestamps were introduced remain valid, but local wins
    // when its age cannot be compared safely with a cloud record.
    return { remember, record: { data: parsed as T, updatedAt: null } };
  } catch {
    return { remember: false, record: null };
  }
}

export function saveRemembered(remember: boolean, data: unknown) {
  try {
    if (isEncryptedPrivateCloudAuthoritative) return;
    window.localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
    if (remember && data) {
      window.localStorage.setItem(
        TIMETABLE_KEY,
        JSON.stringify({ data, updatedAt: new Date().toISOString() }),
      );
    } else {
      window.localStorage.removeItem(TIMETABLE_KEY);
    }
  } catch {
    /* storage unavailable */
  }
}

export function clearRememberedTimetable() {
  try {
    window.localStorage.removeItem(TIMETABLE_KEY);
    window.localStorage.setItem(REMEMBER_KEY, "0");
  } catch {
    /* storage unavailable */
  }
}
