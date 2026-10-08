import { createFileRoute } from "@tanstack/react-router";

import { PrivacyPage } from "@/features/legal/privacy-page";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Cadence" },
      {
        name: "description",
        content:
          "Cadence Privacy Policy: Learn how we protect your personal data with an offline-first architecture, zero tracking, and secure Google OAuth.",
      },
      { property: "og:title", content: "Privacy Policy — Cadence" },
      {
        property: "og:description",
        content:
          "Offline-first habit tracking with complete user privacy, no ads, no trackers, and local data ownership.",
      },
      { property: "og:url", content: "https://cadencepwa.vercel.app/privacy" },
    ],
  }),
  component: PrivacyPage,
});

