import { createFileRoute } from "@tanstack/react-router";

import { AuthPage } from "@/features/auth/auth-page";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Cadence" },
      {
        name: "description",
        content: "Sign in or create a Cadence account to prepare for cloud sync.",
      },
    ],
  }),
  component: AuthPage,
});
