import { Moon, Sun } from "lucide-react";
import { useTheme } from "../lib/theme";

export const ThemeToggle = ({ className = "" }) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={`grid h-10 w-10 flex-shrink-0 place-items-center rounded-full border transition ${className}`}
    >
      <Sun size={18} className={`transition-all ${isDark ? "hidden" : "block"}`} />
      <Moon size={18} className={`transition-all ${isDark ? "block" : "hidden"}`} />
    </button>
  );
};
