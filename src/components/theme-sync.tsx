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
      // Dark value mirrors the `.dark` `--background` token in src/styles.css
      // (and the static meta tag in __root.tsx) so the browser UI always paints
      // the exact shell colour before hydration, then stays aligned after it.
      if (meta) meta.setAttribute("content", dark ? "#0b0f17" : "#f8f7f3");
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  return null;
}
