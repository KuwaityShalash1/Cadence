import { useEffect } from "react";

import { useApp } from "@/stores/app-store";

/** Applies the persisted theme choice to <html>. Runs after hydration only. */
export function ThemeSync() {
  const { settings } = useApp();
  const theme = settings.theme;

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && media.matches);
      root.classList.toggle("dark", dark);
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", dark ? "#2b2f36" : "#f8f7f3");
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  return null;
}
