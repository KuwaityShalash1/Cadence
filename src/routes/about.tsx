import { createFileRoute } from "@tanstack/react-router";

import { AboutPage } from "@/features/about/about-page";

/**
 * About route — /about
 */
export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — Cadence" },
      {
        name: "description",
        content:
          "Start immediately without signing up. Your data belongs to you and lives on your device. Choose to log in only when you're ready to sync your progress seamlessly across devices.",
      },
    ],
  }),
  component: AboutRoute,
});

function AboutRoute() {
  return <AboutPage />;
}

