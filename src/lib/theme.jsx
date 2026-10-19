/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getCurrentUser, saveSettings } from "./appStore";

const ThemeContext = createContext(null);
export const THEME_STORAGE_KEY = "reedshelf-theme";

export function applyThemeToDOM(theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const isDark = theme === "dark";
  root.classList.toggle("dark", isDark);
  root.style.colorScheme = theme;
}

export function getInitialTheme() {
  if (typeof window === "undefined") return "light";

  // 1. First priority: Check explicit user choice in localStorage
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "light" || saved === "dark") {
      applyThemeToDOM(saved);
      return saved;
    }
  } catch {}

  // 2. Second priority: Check if current documentElement already has .dark
  if (document.documentElement.classList.contains("dark")) {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    } catch {}
    return "dark";
  }

  // 3. Fallback: OS color scheme preference on initial visit
  const systemDark = Boolean(window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  const initial = systemDark ? "dark" : "light";

  // Explicitly lock it in so OS automatic transitions do not change it on their own later
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, initial);
  } catch {}

  applyThemeToDOM(initial);
  return initial;
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getInitialTheme);

  // Synchronous theme updater that persists to localStorage and DOM immediately
  const applyAndPersist = useCallback((newTheme) => {
    const next = newTheme === "dark" ? "dark" : "light";
    setThemeState(next);
    applyThemeToDOM(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {}

    // Background sync to user settings in DB if user is logged in
    try {
      const user = getCurrentUser();
      if (user?.id) {
        saveSettings(user.id, { darkMode: next === "dark" }).catch?.(() => {});
      }
    } catch {}

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("reedshelf:theme_changed", { detail: { theme: next } }));
    }
  }, []);

  const setTheme = useCallback((newTheme) => {
    applyAndPersist(newTheme);
  }, [applyAndPersist]);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const next = current === "dark" ? "light" : "dark";
      applyThemeToDOM(next);
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {}
      try {
        const user = getCurrentUser();
        if (user?.id) {
          saveSettings(user.id, { darkMode: next === "dark" }).catch?.(() => {});
        }
      } catch {}
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("reedshelf:theme_changed", { detail: { theme: next } }));
      }
      return next;
    });
  }, []);

  // Multi-tab synchronization
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === THEME_STORAGE_KEY && (e.newValue === "light" || e.newValue === "dark")) {
        setThemeState(e.newValue);
        applyThemeToDOM(e.newValue);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Guarantee DOM is always in sync with theme state
  useEffect(() => {
    applyThemeToDOM(theme);
  }, [theme]);

  const value = {
    theme,
    isDark: theme === "dark",
    toggleTheme,
    setTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
