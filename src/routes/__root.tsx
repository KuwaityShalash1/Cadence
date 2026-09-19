import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { ThemeSync } from "@/components/theme-sync";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/stores/app-store";
import { LanguageProvider } from "@/i18n/context";
import { ErrorBoundary } from "@/components/error-boundary";
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
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Cadence - Habit Tracker" },
      {
        name: "description",
        content:
          "Build daily routines, track habits, and keep your streaks going — a calm, offline-first habit tracker.",
      },
      { name: "author", content: "Cadence" },
      { property: "og:title", content: "Cadence - Habit Tracker" },
      {
        property: "og:description",
        content: "Build daily routines, track habits, and keep your streaks going.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@Cadence" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg?v=2" },
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
