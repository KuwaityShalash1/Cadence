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
