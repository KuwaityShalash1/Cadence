/**
 * Client-side service worker bootstrap for Cadence.
 *
 * The worker itself lives in `public/sw.js` and is intentionally dependency
 * free, so this module only deals with the parts the page owns:
 *
 *  - registering `/sw.js` after the window has loaded (never during hydration),
 *  - skipping registration (and cleaning up) while running `vite dev`, so a
 *    production worker can never serve stale modules to the dev server,
 *  - promoting a freshly installed version and reloading exactly once so the
 *    document and its hashed assets always come from the same build,
 *  - asking the worker to refresh its offline route documents once per session.
 *
 * Everything is SSR-safe: every browser API is only touched inside a function
 * that runs after mount.
 */

/** Every SSR route of the app; kept in sync with `APP_ROUTES` in public/sw.js. */
export const APP_ROUTE_PATHS = [
  "/",
  "/calendar",
  "/goals",
  "/quit-tracker",
  "/routines",
  "/settings",
  "/stats",
] as const;

const SERVICE_WORKER_URL = "/sw.js";
const SERVICE_WORKER_SCOPE = "/";

/** Session flag so the offline documents are refreshed at most once per tab. */
const ROUTE_CACHE_SESSION_KEY = "cadence-sw-route-cache";

let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

/** True when this environment is able to run a service worker at all. */
export function isServiceWorkerSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof window.isSecureContext === "boolean" &&
    window.isSecureContext
  );
}

/**
 * Resolve once the window "load" event has fired. Registering earlier would
 * compete with the entry bundle for bandwidth and delay the first paint.
 */
function waitForWindowLoad(): Promise<void> {
  if (document.readyState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    window.addEventListener("load", () => resolve(), { once: true });
  });
}

/**
 * Register `/sw.js` (idempotent). Safe to call from any post-mount effect: the
 * in-flight promise is reused, and a failure only logs a warning because the
 * app stays fully functional without a worker.
 */
export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isServiceWorkerSupported()) return Promise.resolve(null);
  if (registrationPromise) return registrationPromise;

  // `vite dev` serves every module from source and depends on HMR, so a worker
  // installed by a production or preview build would freeze the app on stale
  // files. Remove it and its caches instead.
  if (import.meta.env.DEV) {
    registrationPromise = unregisterStaleWorkers();
    return registrationPromise;
  }

  registrationPromise = waitForWindowLoad()
    .then(() =>
      navigator.serviceWorker.register(SERVICE_WORKER_URL, {
        scope: SERVICE_WORKER_SCOPE,
        // Always revalidate sw.js itself: a cached worker script delays updates.
        updateViaCache: "none",
      }),
    )
    .then((registration) => {
      watchForUpdates(registration);
      requestRouteCacheRefresh();
      return registration;
    })
    .catch((error: unknown) => {
      console.warn("[Cadence] Service worker registration failed", error);
      return null;
    });

  return registrationPromise;
}

/**
 * Promote an updated worker and reload the page exactly once when it takes
 * control. The very first install (no controller yet) never reloads.
 */
function watchForUpdates(registration: ServiceWorkerRegistration): void {
  const promoteWhenInstalled = (worker: ServiceWorker | null) => {
    if (!worker) return;
    const onStateChange = () => {
      // "installed" while a controller exists means this is an update, not the
      // very first install.
      if (worker.state === "installed" && navigator.serviceWorker.controller) {
        worker.postMessage({ type: "SKIP_WAITING" });
      }
      if (worker.state === "redundant") {
        worker.removeEventListener("statechange", onStateChange);
      }
    };
    worker.addEventListener("statechange", onStateChange);
  };

  promoteWhenInstalled(registration.installing);
  registration.addEventListener("updatefound", () => promoteWhenInstalled(registration.installing));

  // A worker can already be waiting when the page loads (the app was closed
  // while an update was downloading). Promote it right away.
  if (registration.waiting && navigator.serviceWorker.controller) {
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
  }

  const wasControlled = Boolean(navigator.serviceWorker.controller);
  let hasReloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!wasControlled || hasReloaded) return;
    hasReloaded = true;
    // All data lives in IndexedDB / localStorage, so reloading cannot lose
    // anything; it only guarantees a single, consistent version is running.
    window.location.reload();
  });
}

/**
 * Ask the worker to re-download the offline documents of every route.
 * Runs once per tab session: the worker already precaches them on install, this
 * keeps them aligned with the deployment that is live right now.
 */
function requestRouteCacheRefresh(): void {
  try {
    if (window.sessionStorage.getItem(ROUTE_CACHE_SESSION_KEY) === "1") return;
  } catch (error) {
    // Storage can be unavailable (private mode); skip the refresh in that case.
    return;
  }

  void navigator.serviceWorker.ready
    .then((registration) => {
      // While an update is waiting, the next version precaches on activation.
      if (registration.waiting) return;
      const worker = registration.active;
      if (!worker) return;
      worker.postMessage({ type: "CACHE_ROUTES", urls: [...APP_ROUTE_PATHS] });
      try {
        window.sessionStorage.setItem(ROUTE_CACHE_SESSION_KEY, "1");
      } catch (error) {
        // Ignore: the flag is an optimisation only.
      }
    })
    .catch(() => undefined);
}

/** Development-only cleanup of workers and caches left by a previous build. */
async function unregisterStaleWorkers(): Promise<null> {
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key.startsWith("cadence-")).map((key) => caches.delete(key)),
      );
    }
  } catch (error) {
    console.warn("[Cadence] Failed to clean up service workers in development", error);
  }
  return null;
}
