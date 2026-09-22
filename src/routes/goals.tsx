import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { GoalsPage } from "@/components/goals/goals-page";

export const Route = createFileRoute("/goals")({
  head: () => ({
    meta: [
      { title: "Goals — Cadence Habit Tracker" },
      {
        name: "description",
        content: "Set and track long-term targets across your habits.",
      },
      { property: "og:title", content: "Goals — Cadence Habit Tracker" },
      {
        property: "og:description",
        content: "Set and track long-term targets across your habits.",
      },
      { property: "og:url", content: "https://cadencepwa.vercel.app/goals" },
    ],
  }),
  component: GoalsRoute,
});

function GoalsRoute() {
  return (
    <AppShell>
      <GoalsPage />
    </AppShell>
  );
}
