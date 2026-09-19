import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { TodayPage } from "@/components/today/today-page";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Today — Cadence Habit Tracker" },
      {
        name: "description",
        content:
          "Track today's habits, log progress in one tap, run a focus timer, and keep your streaks going — offline-first.",
      },
      { property: "og:title", content: "Today — Cadence Habit Tracker" },
      {
        property: "og:description",
        content: "Your daily habits, streaks, and focus timer in one calm dashboard.",
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
