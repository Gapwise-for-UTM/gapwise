import { useEffect, useState } from "react";

const THEME_KEY = "gapwise:theme";

export type Theme = "light" | "dark";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_KEY) as Theme | null;
    const initial =
      stored ??
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
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

export function loadRemembered<T>(): { remember: boolean; data: T | null } {
  try {
    const remember = window.localStorage.getItem(REMEMBER_KEY) === "1";
    if (!remember) return { remember, data: null };
    const raw = window.localStorage.getItem(TIMETABLE_KEY);
    return { remember, data: raw ? (JSON.parse(raw) as T) : null };
  } catch {
    return { remember: false, data: null };
  }
}

export function saveRemembered(remember: boolean, data: unknown) {
  try {
    window.localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
    if (remember && data) {
      window.localStorage.setItem(TIMETABLE_KEY, JSON.stringify(data));
    } else {
      window.localStorage.removeItem(TIMETABLE_KEY);
    }
  } catch {
    /* storage unavailable */
  }
}
