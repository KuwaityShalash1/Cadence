import { createFileRoute } from "@tanstack/react-router";

import { AuthPage } from "@/features/auth/auth-page";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Cadence" },
      {
        name: "description",
        content:
          "Sign in with Google to securely sync your habits and streaks across all your devices.",
      },
    ],
  }),
  component: AuthPage,
});
