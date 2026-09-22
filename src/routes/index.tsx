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
      { title: "Cadence — Free Offline Habit Tracker & Daily Routine Planner" },
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
      {
        property: "og:title",
        content: "Cadence — Free Offline Habit Tracker & Daily Routine Planner",
      },
      {
        property: "og:description",
        content:
          "Track habits and build discipline with Cadence. A 100% offline-first PWA featuring unique moderation goals, daily routines, and zero tracking or ads.",
      },
      { property: "og:url", content: "https://cadencepwa.vercel.app/" },
      { property: "og:image", content: "https://cadencepwa.vercel.app/og-image.png" },
      {
        name: "twitter:title",
        content: "Cadence — Free Offline Habit Tracker & Daily Routine Planner",
      },
      {
        name: "twitter:description",
        content:
          "Track habits and build discipline with Cadence. A 100% offline-first PWA featuring unique moderation goals, daily routines, and zero tracking or ads.",
      },
      { name: "twitter:image", content: "https://cadencepwa.vercel.app/og-image.png" },
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
