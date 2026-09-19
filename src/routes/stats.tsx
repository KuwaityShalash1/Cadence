import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { StatsPage } from "@/components/stats/stats-page";

export const Route = createFileRoute("/stats")({
  head: () => ({
    meta: [
      { title: "Statistics — Cadence Habit Tracker" },
      {
        name: "description",
        content: "Completion rates, streaks, and trends across all your habits.",
      },
    ],
  }),
  component: StatsRoute,
});

function StatsRoute() {
  return (
    <AppShell>
      <StatsPage />
    </AppShell>
  );
}
