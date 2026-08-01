import { useEffect, useState } from "react";

const THEME_KEY = "gapwise:theme";

export type Theme = "light" | "dark";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_KEY) as Theme | null;
    const initial =
      stored ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setTheme(initial);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  return {
    theme,
    toggleTheme: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
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
