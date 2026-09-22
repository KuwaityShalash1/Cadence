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
      { property: "og:title", content: "Routines — Cadence Habit Tracker" },
      {
        property: "og:description",
        content: "Group habits into daily or weekly routines.",
      },
      { property: "og:url", content: "https://cadencepwa.vercel.app/routines" },
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
