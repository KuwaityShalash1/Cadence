import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { TodayPage } from "@/components/today/today-page";

/**
 * Homepage metadata — the primary landing document crawlers index first, so the
 * title, description and social cards are written out explicitly here instead of
 * relying on the root defaults (which use the exact same copy).
 */
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cadence | Minimalist Habit Tracker" },
      {
        name: "description",
        content:
          "Track habits and build discipline with Cadence. A 100% offline-first PWA featuring unique moderation goals, daily routines, and zero tracking or ads.",
      },
      {
        name: "keywords",
        content:
          "habit tracker, offline habit tracker, moderation habits, daily routine planner, privacy-first pwa, habit tracker no ads",
      },
      { property: "og:site_name", content: "Cadence" },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://cadencepwa.vercel.app/" },
      {
        property: "og:title",
        content: "Cadence | Minimalist Habit Tracker",
      },
      {
        property: "og:description",
        content:
          "Track habits and build discipline with Cadence. A 100% offline-first PWA featuring unique moderation goals, daily routines, and zero tracking or ads.",
      },
      { property: "og:image", content: "https://cadencepwa.vercel.app/og-image.png" },
      { property: "og:image:secure_url", content: "https://cadencepwa.vercel.app/og-image.png" },
      { property: "og:image:type", content: "image/png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      {
        property: "og:image:alt",
        content: "Cadence — free offline habit tracker and daily routine planner",
      },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "twitter:title",
        content: "Cadence | Minimalist Habit Tracker",
      },
      {
        name: "twitter:description",
        content:
          "Track habits and build discipline with Cadence. A 100% offline-first PWA featuring unique moderation goals, daily routines, and zero tracking or ads.",
      },
      { name: "twitter:image", content: "https://cadencepwa.vercel.app/og-image.png" },
      {
        name: "twitter:image:alt",
        content: "Cadence — free offline habit tracker and daily routine planner",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <AppShell>
      <TodayPage />
    </AppShell>
  );
}
