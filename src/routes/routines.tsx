import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { RoutinesPage } from "@/components/routines/routines-page";

export const Route = createFileRoute("/routines")({
  head: () => ({
    meta: [
      { title: "Routines — Cadence Habit Tracker" },
      {
        name: "description",
        content: "Group habits into daily or weekly routines.",
      },
    ],
  }),
  component: RoutinesRoute,
});

function RoutinesRoute() {
  return (
    <AppShell>
      <RoutinesPage />
    </AppShell>
  );
}
