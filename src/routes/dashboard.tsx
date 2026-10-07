import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { UserDashboard } from "@/components/dashboard/user-dashboard";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "User Dashboard — Cadence Habit Tracker" },
      {
        name: "description",
        content:
          "Personalized profile, Supabase sync status, and gamification statistics including streaks and completion rates.",
      },
      { property: "og:title", content: "User Dashboard — Cadence Habit Tracker" },
      {
        property: "og:description",
        content: "View your habit streaks, monthly completion rates, and account profile.",
      },
      { property: "og:url", content: "https://cadencepwa.vercel.app/dashboard" },
    ],
  }),
  component: DashboardRoute,
});

function DashboardRoute() {
  return (
    <AppShell>
      <UserDashboard />
    </AppShell>
  );
}
