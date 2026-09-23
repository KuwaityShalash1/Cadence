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
import { BackupReminder } from "@/components/backup-reminder";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/stores/app-store";
import { LanguageProvider } from "@/i18n/context";
import { ErrorBoundary } from "@/components/error-boundary";
import { checkDailyHabitReminder } from "@/lib/notifications";
import { registerServiceWorker } from "@/lib/service-worker";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useWeeklyBackupReminder } from "@/hooks/use-weekly-backup";
import { useApp } from "@/stores/app-store";
import { useShortcuts } from "@/hooks/use-shortcuts";
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

/** Canonical, absolute origin of the deployed app — used by canonical + social URLs. */
const SITE_ORIGIN = "https://cadencepwa.vercel.app";

/** Homepage copy: keyword-rich but still an accurate description of the app. */
const HOME_TITLE = "Cadence — Free Offline Habit Tracker & Daily Routine Planner";
const HOME_DESCRIPTION =
  "Track habits and build discipline with Cadence. A 100% offline-first PWA featuring unique moderation goals, daily routines, and zero tracking or ads.";
const HOME_KEYWORDS =
  "habit tracker, offline habit tracker, moderation habits, daily routine planner, privacy-first pwa, habit tracker no ads";

/** Social preview artwork (1200x630) served from /public along with the app. */
const SOCIAL_IMAGE_URL = `${SITE_ORIGIN}/og-image.png`;
const SOCIAL_IMAGE_ALT = "Cadence — free offline habit tracker and daily routine planner";

/** Features advertised to search engines and AI answer engines. */
const APP_FEATURE_LIST = [
  "100% Offline Storage via IndexedDB",
  "Moderation Strategy for Screen Time & Habits",
  "Custom Routines and Goal Tracking",
  "Installable PWA",
];

/**
 * JSON-LD graph describing Cadence.
 *
 * `WebApplication` and `SoftwareApplication` intentionally share a single
 * `@id`, so crawlers merge them into one entity: a free, installable,
 * offline-first productivity application. `WebSite` describes the public site.
 * One script carrying an `@graph` keeps the relations between those nodes
 * explicit, which is what answer engines (Perplexity, ChatGPT, AI Overviews)
 * read when they summarise an app.
 */
function buildStructuredData(canonicalUrl: string) {
  const applicationId = `${SITE_ORIGIN}/#software-application`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_ORIGIN}/#website`,
        name: "Cadence",
        alternateName: "Cadence Habit Tracker",
        url: `${SITE_ORIGIN}/`,
        description: HOME_DESCRIPTION,
        inLanguage: "en",
        publisher: { "@id": applicationId },
      },
      {
        "@type": "WebApplication",
        "@id": applicationId,
        name: "Cadence Habit Tracker",
        alternateName: "Cadence",
        url: canonicalUrl,
        applicationCategory: "ProductivityApplication",
        applicationSubCategory: "Habit Tracker",
        operatingSystem: "Web, iOS, Android, Windows, macOS",
        browserRequirements: "Requires JavaScript, IndexedDB, and HTTPS (or localhost)",
        isAccessibleForFree: true,
        inLanguage: "en",
        offers: {
          "@type": "Offer",
          price: "0.00",
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
        },
        featureList: APP_FEATURE_LIST,
        keywords: HOME_KEYWORDS,
        image: SOCIAL_IMAGE_URL,
      },
      {
        "@type": "SoftwareApplication",
        "@id": applicationId,
        name: "Cadence Habit Tracker",
        url: canonicalUrl,
        applicationCategory: "ProductivityApplication",
        operatingSystem: "Web, iOS, Android, Windows, macOS",
        isAccessibleForFree: true,
        offers: {
          "@type": "Offer",
          price: "0.00",
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
        },
        featureList: APP_FEATURE_LIST,
      },
    ],
  };
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  /**
   * Per-page metadata. TanStack Router keeps only the deepest match for every
   * `title` / `name` / `property`, so anything defined here is the default that
   * child routes override, while `canonical` and `og:url` always mirror the page
   * actually being rendered (exactly one canonical tag per document).
   */
  head: ({ matches }) => {
    const deepestMatch = matches[matches.length - 1];
    const routeId = deepestMatch?.routeId;
    /**
     * TanStack Router's fuzzy not-found mode serves the root route as a successful
     * match for unknown paths, so `pathname` is "/" even for `/does-not-exist`.
     * We use `routeId` to decide the canonical: real page routes (anything other
     * than __root__) get a canonical of their own path, the root route gets "/",
     * and we suppress the canonical entirely when the root route is the only match
     * (which is the 404 fallback case).
     */
    const isRootOnlyMatch = matches.length === 1 && routeId === "__root__";
    const canonicalPath = isRootOnlyMatch ? "/" : routeId ? deepestMatch?.fullPath : "/";
    const pathname = canonicalPath === "/" ? "/" : canonicalPath;
    const canonicalUrl =
      pathname === "/" ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${pathname.replace(/\/$/, "")}`;
    const robotsDirective =
      "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";

    return {
      meta: [
        { charSet: "utf-8" },
        {
          name: "viewport",
          content: "width=device-width, initial-scale=1, viewport-fit=cover",
        },
        { title: HOME_TITLE },
        { name: "description", content: HOME_DESCRIPTION },
        { name: "keywords", content: HOME_KEYWORDS },
        { name: "author", content: "Cadence" },
        { name: "application-name", content: "Cadence Habit Tracker" },
        { name: "robots", content: robotsDirective },
        { name: "googlebot", content: robotsDirective },
        { property: "og:site_name", content: "Cadence" },
        { property: "og:locale", content: "en_US" },
        { property: "og:type", content: "website" },
        { property: "og:title", content: HOME_TITLE },
        { property: "og:description", content: HOME_DESCRIPTION },
        { property: "og:url", content: canonicalUrl },
        { property: "og:image", content: SOCIAL_IMAGE_URL },
        { property: "og:image:type", content: "image/png" },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { property: "og:image:alt", content: SOCIAL_IMAGE_ALT },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: HOME_TITLE },
        { name: "twitter:description", content: HOME_DESCRIPTION },
        { name: "twitter:url", content: canonicalUrl },
        { name: "twitter:image", content: SOCIAL_IMAGE_URL },
        { name: "twitter:image:alt", content: SOCIAL_IMAGE_ALT },
        // Only one theme-color on purpose: browsers and crawlers honour the last
        // occurrence, and the brand surface of the app is the dark shell.
        { name: "theme-color", content: "#090d16" },
        { name: "apple-mobile-web-app-capable", content: "yes" },
        { name: "mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
        { name: "apple-mobile-web-app-title", content: "Cadence" },
        // Search Console ownership is proven by /google2b0885a7999327aa.html, so
        // the legacy placeholder verification meta tag is intentionally absent.
        // Structured data for search engines and AI answer engines. TanStack
        // converts this key into `<script type="application/ld+json">` and escapes
        // the payload, which a hand-written `scripts` entry cannot do safely.
        { "script:ld+json": buildStructuredData(canonicalUrl) },
      ],
      links: [
        {
          rel: "stylesheet",
          href: appCss,
        },
        // Emitted for every route except the 404 page so each document has
        // exactly one canonical URL pointing at its own address.
        ...(isRootOnlyMatch ? [] : [{ rel: "canonical" as const, href: canonicalUrl }]),
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
    };
  },
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
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  // Chromium can fire "beforeinstallprompt" before React has
                  // mounted. Stashing the event on the window lets the Settings
                  // screen offer "Install App" whenever the user gets there.
                  // src/hooks/use-pwa.ts reads and clears this slot.
                  window.__cadenceDeferredInstallPrompt = null;
                  window.addEventListener('beforeinstallprompt', function (event) {
                    event.preventDefault();
                    window.__cadenceDeferredInstallPrompt = event;
                  });
                  window.addEventListener('appinstalled', function () {
                    window.__cadenceDeferredInstallPrompt = null;
                  });
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
  // Global keyboard shortcuts (N / Cmd+K / T). Mounted once at the top
  // level; safe for SSR (listener attaches in useEffect) and offline.
  useShortcuts();

  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <LanguageProvider>
          <NotificationScheduler />
          <WeeklyBackupReminder />
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

/**
 * Smart Weekly Auto-Backup reminder for the offline-first IndexedDB database.
 *
 * Runs inside `AppProvider` so it can call the store's canonical `exportData()`
 * serializer when the user taps "Export Backup (JSON)". The hook itself is
 * SSR-safe (all `localStorage` work happens in `useEffect`) and respects browser
 * auto-download policies by only downloading from the banner button gesture.
 * Renders the floating `BackupReminder` banner; the bottom navigation and top
 * header layouts are untouched.
 */
function WeeklyBackupReminder() {
  const { exportData, ready } = useApp();

  // Wait until the Dexie snapshot has loaded so the export contains real data.
  const { visible, exportBackup, snoozeReminder, dismissReminder } = useWeeklyBackupReminder(
    exportData,
    { enabled: ready },
  );

  return (
    <BackupReminder
      visible={visible}
      onExport={exportBackup}
      onSnooze={snoozeReminder}
      onDismiss={dismissReminder}
    />
  );
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
