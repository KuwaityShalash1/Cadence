import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { CalendarPage } from "@/features/calendar/calendar-page";

export const Route = createFileRoute("/calendar")({
  head: () => ({
    meta: [
      { title: "Calendar — Cadence Habit Tracker" },
      {
        name: "description",
        content: "Browse your habit history day by day and edit any past day.",
      },
      { property: "og:title", content: "Calendar — Cadence Habit Tracker" },
      {
        property: "og:description",
        content: "Browse your habit history day by day and edit any past day.",
      },
      { property: "og:url", content: "https://cadencepwa.vercel.app/calendar" },
    ],
  }),
  component: CalendarRoute,
});

function CalendarRoute() {
  return (
    <AppShell>
      <CalendarPage />
    </AppShell>
  );
}
