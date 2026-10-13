import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { TodayPage } from "@/components/today/today-page";

/**
 * Homepage metadata — the primary landing document crawlers index first, so the
 * title, description and social cards are written out explicitly here instead of
 * relying on the root defaults (which use the exact same copy).
 */
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cadence | Minimalist Habit Tracker" },
      {
        name: "description",
        content:
          "Cadence is an offline-first, minimalist habit tracker designed to help you build routines, track goals, and stay consistent effortlessly.",
      },
      {
        name: "keywords",
        content:
          "Cadence, habit tracker, offline habit tracker, متتبع عادات, تتبع العادات, بناء الروتين, إدارة الأهداف, تطبيق إنتاجية, بدون إنترنت",
      },
      { property: "og:site_name", content: "Cadence" },
      { property: "og:locale", content: "en_US" },
      { property: "og:locale:alternate", content: "ar_AR" },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://cadencepwa.vercel.app/" },
      {
        property: "og:title",
        content: "Cadence | Minimalist Habit Tracker",
      },
      {
        property: "og:description",
        content: "Track your habits and build routines with this offline-first minimalist app.",
      },
      { property: "og:image", content: "/og-image.png" },
      {
        property: "og:image:secure_url",
        content: "https://cadencepwa.vercel.app/og-image.png",
      },
      { property: "og:image:type", content: "image/png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      {
        property: "og:image:alt",
        content: "Cadence | Minimalist Habit Tracker",
      },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "twitter:title",
        content: "Cadence | Minimalist Habit Tracker",
      },
      {
        name: "twitter:description",
        content: "Track your habits and build routines with this offline-first minimalist app.",
      },
      { name: "twitter:image", content: "/og-image.png" },
      {
        name: "twitter:image:alt",
        content: "Cadence | Minimalist Habit Tracker",
      },
    ],
    links: [
      { rel: "icon", href: "/favicon.ico" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/logo192.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <AppShell>
      <TodayPage />
    </AppShell>
  );
}
