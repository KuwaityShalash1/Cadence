import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { QuitTrackerPage } from "@/features/quit-tracker/quit-tracker-page";

export const Route = createFileRoute("/quit-tracker")({
  head: () => ({
    meta: [
      { title: "Quit Tracker — Cadence Habit Tracker" },
      {
        name: "description",
        content: "Track abstinences, monitor live clean streaks, and analyze relapse triggers.",
      },
      { property: "og:title", content: "Quit Tracker — Cadence Habit Tracker" },
      {
        property: "og:description",
        content: "Track abstinences, monitor live clean streaks, and analyze relapse triggers.",
      },
      { property: "og:url", content: "https://cadencepwa.vercel.app/quit-tracker" },
    ],
  }),
  component: QuitTrackerRoute,
});

function QuitTrackerRoute() {
  return (
    <AppShell>
      <QuitTrackerPage />
    </AppShell>
  );
}
