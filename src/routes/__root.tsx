import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { ThemeSync } from "@/components/theme-sync";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/stores/app-store";
import { LanguageProvider } from "@/i18n/context";
import { ErrorBoundary } from "@/components/error-boundary";
import { checkDailyHabitReminder } from "@/lib/notifications";
import { registerServiceWorker } from "@/lib/service-worker";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useApp } from "@/stores/app-store";
import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      { title: "Cadence — Offline Habit Tracker & Daily Routine Planner" },
      {
        name: "description",
        content:
          "Build daily routines, track habits, and maintain streaks with Cadence. A calm, fast, offline-first habit tracker powered by IndexedDB.",
      },
      {
        name: "keywords",
        content:
          "habit tracker, offline habit tracker, routine planner, daily streaks, productivity, cadence, indexeddb app",
      },
      { name: "author", content: "Cadence" },
      { property: "og:title", content: "Cadence — Offline Habit Tracker & Daily Routine Planner" },
      {
        property: "og:description",
        content:
          "Build daily routines, track habits, and maintain streaks with Cadence. A calm, fast, offline-first habit tracker powered by IndexedDB.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://cadence-shalash1.vercel.app/" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Cadence — Offline Habit Tracker & Daily Routine Planner" },
      {
        name: "twitter:description",
        content:
          "Build daily routines, track habits, and maintain streaks with Cadence. A calm, fast, offline-first habit tracker powered by IndexedDB.",
      },
      { name: "twitter:url", content: "https://cadence-shalash1.vercel.app/" },
      { name: "twitter:site", content: "@Cadence" },
      { name: "theme-color", content: "#090d16", media: "(prefers-color-scheme: dark)" },
      { name: "theme-color", content: "#ffffff", media: "(prefers-color-scheme: light)" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Cadence" },
      { name: "google-site-verification", content: "REPLACE_WITH_YOUR_GSC_CODE" },
    ],
    scripts: [
      {
        attrs: { type: "application/ld+json" },
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": ["WebApplication", "SoftwareApplication"],
          name: "Cadence",
          alternateName: "Cadence Habit Tracker",
          applicationCategory: "ProductivityApplication",
          operatingSystem: "All",
          url: "https://cadence-shalash1.vercel.app/",
          description:
            "A calm, fast, offline-first habit tracker and routine planner powered by IndexedDB.",
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "USD",
          },
          featureList: [
            "Offline-first habit tracking",
            "Client-side IndexedDB local persistence",
            "Streak counter and statistics",
            "Dark mode support",
            "Privacy-first with zero tracking",
          ],
        }),
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "canonical", href: "https://cadence-shalash1.vercel.app/" },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png?v=3" },
      {
        rel: "icon",
        href: "/favicon-light.svg",
        media: "(prefers-color-scheme: light)",
        type: "image/svg+xml",
      },
      {
        rel: "icon",
        href: "/favicon-dark.svg",
        media: "(prefers-color-scheme: dark)",
        type: "image/svg+xml",
      },
      { rel: "icon", href: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { rel: "icon", href: "/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  // MUST match the exact Zustand localStorage key found in step 1
                  const STORE_KEY = 'cadence-storage';
                  const raw = localStorage.getItem(STORE_KEY) || localStorage.getItem('theme');
                  if (raw) {
                    let parsed;
                    try {
                      parsed = JSON.parse(raw);
                    } catch {
                      parsed = { theme: raw };
                    }
                    const state = parsed?.state || parsed;
                    const theme = state?.theme || state?.settings?.theme;

                    if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                      document.documentElement.classList.add('dark');
                    } else if (theme === 'light') {
                      document.documentElement.classList.remove('dark');
                    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                      document.documentElement.classList.add('dark');
                    }

                    const isCollapsed = state?.isSidebarCollapsed ?? state?.isCollapsed;
                    if (isCollapsed) {
                      document.documentElement.setAttribute('data-sidebar-collapsed', 'true');
                      document.documentElement.classList.add('sidebar-collapsed');
                    }
                  } else {
                    if (localStorage.getItem('cadence_sidebar_collapsed') === 'true') {
                      document.documentElement.setAttribute('data-sidebar-collapsed', 'true');
                      document.documentElement.classList.add('sidebar-collapsed');
                    }
                    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                      document.documentElement.classList.add('dark');
                    }
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              /* Inline critical override executed by browser parser immediately */
              html[data-sidebar-collapsed="true"] aside {
                width: 4rem !important;
              }
              html[data-sidebar-collapsed="true"] aside span,
              html[data-sidebar-collapsed="true"] aside p,
              html[data-sidebar-collapsed="true"] aside .sidebar-label {
                display: none !important;
                opacity: 0 !important;
                visibility: hidden !important;
              }
            `,
          }}
        />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <LanguageProvider>
          <NotificationScheduler />
          <ServiceWorkerBootstrap />
          <ClientAnalytics />
          <ClientSpeedInsights />
          <ThemeSync />
          <TooltipProvider delayDuration={200}>
            <ErrorBoundary>
              {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
              <Outlet />
            </ErrorBoundary>
          </TooltipProvider>
          <Toaster />
        </LanguageProvider>
      </AppProvider>
    </QueryClientProvider>
  );
}

function ClientAnalytics() {
  const [mounted, setMounted] = useState(false);
  const isOnline = useOnlineStatus();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Analytics is the only network-bound feature in the app. Skipping it while
  // offline keeps the console clean without touching any local feature.
  return mounted && isOnline ? <Analytics /> : null;
}

/**
 * Renders Vercel Speed Insights only after the app has mounted on the client
 * and the browser reports being online. The Web Vitals beacons that
 * Speed Insights sends are network-bound, so rendering it while offline or
 * during SSR would only produce failed requests or hydration mismatches.
 * This mirrors the ClientAnalytics guard so the console stays clean without
 * affecting any local functionality.
 */
function ClientSpeedInsights() {
  const [mounted, setMounted] = useState(false);
  const isOnline = useOnlineStatus();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Skip while offline: the performance metrics would never reach Vercel and
  // could throw or log errors during the beacon send attempt.
  return mounted && isOnline ? <SpeedInsights /> : null;
}

/**
 * Registers the offline service worker from a post-mount effect, so nothing
 * runs during server rendering or hydration (`registerServiceWorker` is a no-op
 * when `navigator.serviceWorker` is missing). It resolves once the window has
 * loaded and never throws into React.
 */
function ServiceWorkerBootstrap() {
  useEffect(() => {
    void registerServiceWorker();
  }, []);

  return null;
}

function NotificationScheduler() {
  const { habits, logMap, ready, settings } = useApp();
  const habitsRef = useRef(habits);
  const logMapRef = useRef(logMap);

  useEffect(() => {
    habitsRef.current = habits;
    logMapRef.current = logMap;
  }, [habits, logMap]);

  useEffect(() => {
    if (typeof window === "undefined" || !ready || !settings.notificationsEnabled) return;

    const check = () => {
      void checkDailyHabitReminder(habitsRef.current, logMapRef.current);
    };
    check();
    const intervalId = window.setInterval(check, 60_000);
    return () => window.clearInterval(intervalId);
  }, [ready, settings.notificationsEnabled]);

  return null;
}
