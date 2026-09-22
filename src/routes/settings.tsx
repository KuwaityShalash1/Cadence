import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { SettingsPage } from "@/features/profile/settings-page";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Cadence Habit Tracker" },
      {
        name: "description",
        content:
          "Manage your profile, theme, notifications, and local Cadence data — everything stays on your device.",
      },
      { property: "og:title", content: "Settings — Cadence Habit Tracker" },
      {
        property: "og:description",
        content:
          "Manage your profile, theme, notifications, and local Cadence data — everything stays on your device.",
      },
      { property: "og:url", content: "https://cadencepwa.vercel.app/settings" },
    ],
  }),
  component: SettingsRoute,
});

function SettingsRoute() {
  return (
    <AppShell>
      <SettingsPage />
    </AppShell>
  );
}
