import { createFileRoute } from "@tanstack/react-router";

import { TermsPage } from "@/features/legal/terms-page";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Cadence" },
      {
        name: "description",
        content:
          "Cadence Terms of Service: Terms and conditions governing the use of the Cadence habit tracker application.",
      },
      { property: "og:title", content: "Terms of Service — Cadence" },
      {
        property: "og:description",
        content:
          "Terms and conditions for using Cadence, including disclaimers of warranties, limitations of liability, and user responsibilities.",
      },
      { property: "og:url", content: "https://cadencepwa.vercel.app/terms" },
    ],
  }),
  component: TermsPage,
});

