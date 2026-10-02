import { createFileRoute } from "@tanstack/react-router";

import { AboutPage } from "@/features/about/about-page";

/**
 * Secret "About Us" Easter egg route — /about-us
 *
 * This route is intentionally NOT linked from any part of the UI
 * (no Navbar entry, no Sidebar item, no footer link, no command palette entry).
 * It is only reachable by manually typing the URL.
 *
 * Robots are excluded below so search engines never index it and
 * it remains a genuine discovery for curious developers.
 */
export const Route = createFileRoute("/about-us")({
  head: () => ({
    meta: [
      { title: "About — Cadence" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AboutUsRoute,
});

function AboutUsRoute() {
  return <AboutPage />;
}
