import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { AnalyticsDashboard } from "@/components/analytics/AnalyticsDashboard";

export const Route = createFileRoute("/stats")({
  head: () => ({
    meta: [
      { title: "Analytics — Cadence Habit Tracker" },
      {
        name: "description",
        content:
          "Rich analytics with charts showing habit completion rates and moderation adherence over the last 7 days.",
      },
      { property: "og:title", content: "Analytics — Cadence Habit Tracker" },
      {
        property: "og:description",
        content:
          "Visual breakdown of your habit completion and moderation adherence.",
      },
      { property: "og:url", content: "https://cadencepwa.vercel.app/stats" },
    ],
  }),
  component: StatsRoute,
});

function StatsRoute() {
  return (
    <AppShell>
      <AnalyticsDashboard />
    </AppShell>
  );
}
