/*
 * Cadence Service Worker — offline support
 * ----------------------------------------
 * Cadence keeps every habit, routine, goal and log inside IndexedDB, so the
 * only work this worker has to do is make sure the app *shell* keeps loading
 * when the device has no connectivity.
 *
 * Strategies
 *   install  → warm the shell cache ("/", icons, manifest.json), then read the
 *              shell document to discover the hashed entry bundles, and finally
 *              cache every SSR route so any screen opens offline.
 *   activate → delete caches from older versions, enable navigation preload and
 *              take control of the open clients.
 *   navigate → network-first with a cache fallback (the cached document for the
 *              requested URL, then the cached shell, then a minimal offline page).
 *   assets   → cache-first for immutable hashed build output (/assets/*) and
 *              stale-while-revalidate for every other static asset (icons,
 *              fonts, images, xml).
 *
 * Bump SW_VERSION whenever the caching strategy or the precache lists change:
 * the activate handler uses the version in the cache names to evict the rest.
 */

"use strict";

/** Version of the caching scheme. Also part of every cache name. */
const SW_VERSION = "1.0.0";

const CACHE_NAMESPACE = "cadence";
/** Core shell files (document + icons + manifest); never trimmed at runtime. */
const SHELL_CACHE = `${CACHE_NAMESPACE}-shell-v${SW_VERSION}`;
/** Immutable hashed build output served from /assets/. */
const ASSET_CACHE = `${CACHE_NAMESPACE}-assets-v${SW_VERSION}`;
/** Server-rendered HTML documents, one per route. */
const PAGE_CACHE = `${CACHE_NAMESPACE}-pages-v${SW_VERSION}`;
/** Everything else static (images, fonts, xml…), trimmed by size. */
const RUNTIME_CACHE = `${CACHE_NAMESPACE}-runtime-v${SW_VERSION}`;

const ACTIVE_CACHES = [SHELL_CACHE, ASSET_CACHE, PAGE_CACHE, RUNTIME_CACHE];

/** Document used whenever a requested route has never been cached. */
const OFFLINE_URL = "/";

/** Core shell files that must exist before the worker activates. */
const PRECACHE_URLS = [
  OFFLINE_URL,
  "/manifest.json",
  "/favicon.svg",
  "/favicon-light.svg",
  "/favicon-dark.svg",
  "/favicon-16.png",
  "/favicon-32.png",
  "/apple-touch-icon.png",
  "/icon-192.png",
  "/icon-512.png",
];

/**
 * Every SSR route of the app. Caching the HTML of each one (plus the chunks it
 * preloads) is what lets the user open any screen without a connection.
 */
const APP_ROUTES = [
  "/",
  "/calendar",
  "/goals",
  "/quit-tracker",
  "/routines",
  "/settings",
  "/stats",
];

/** Abandon a navigation request after this long and serve the cache instead. */
const NETWORK_TIMEOUT_MS = 5000;

/** Upper bound for the runtime (non-hashed) asset cache. */
const MAX_RUNTIME_ENTRIES = 120;
/** Upper bound for cached documents (routes + query-string variants). */
const MAX_PAGE_ENTRIES = 30;

const STATIC_DESTINATIONS = new Set([
  "script",
  "style",
  "image",
  "font",
  "audio",
  "video",
  "manifest",
]);

const STATIC_EXTENSIONS =
  /\.(?:js|mjs|css|png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf|eot|mp3|wav|ogg|json|webmanifest|txt|xml)$/i;

/* ------------------------------------------------------------------ helpers */

/**
 * Responses we are allowed to store. Opaque and error responses would poison
 * the cache, and 206 partial responses are not fully cacheable.
 */
function isCacheableResponse(response) {
  if (!response || !response.ok || response.status === 206) return false;
  return response.type === "basic" || response.type === "default";
}

/**
 * Absolute same-origin URL for a path. Used both as a cache key and to build
 * requests, so precache writes and runtime lookups always agree.
 */
function absoluteUrl(path) {
  try {
    return new URL(path, self.location.origin).href;
  } catch (error) {
    return path;
  }
}

/**
 * Vite dev requests (source modules, the HMR client and the dependency
 * optimizer) must never be cached: they change on every edit and caching them
 * would freeze the dev server on stale code.
 */
function isDevServerRequest(url) {
  const path = url.pathname;
  return (
    path.startsWith("/@") ||
    path.startsWith("/src/") ||
    path.startsWith("/node_modules/") ||
    path.startsWith("/__") ||
    path.includes("/.vite/") ||
    url.searchParams.has("import")
  );
}

/** True for scripts, styles, images, fonts, media and manifest files. */
function isStaticAssetRequest(request, url) {
  if (STATIC_DESTINATIONS.has(request.destination)) return true;
  return STATIC_EXTENSIONS.test(url.pathname);
}

/**
 * Vite build output lives under /assets/ and carries a content hash in its
 * file name, so a given URL always maps to the same bytes.
 */
function isImmutableAsset(url) {
  return url.pathname.startsWith("/assets/");
}

/**
 * Collapse a hashed file name back to its logical chunk name, e.g.
 * `/assets/index-Dw_0Ifzv.js` → `index.js`. Two URLs that share a logical name
 * are the same chunk emitted by two different builds.
 */
function logicalAssetName(pathname) {
  const match = /\/([^/]+?)-[A-Za-z0-9_-]{8,}\.([a-z0-9]+)$/i.exec(pathname);
  return match ? `${match[1]}.${match[2]}` : null;
}

/** Keep a cache below `maxEntries`, dropping the oldest entries first. */
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  const excess = keys.length - maxEntries;
  for (let index = 0; index < excess; index += 1) {
    const key = keys[index];
    if (key) await cache.delete(key);
  }
}

/* ---------------------------------------------------------------- precaching */

/**
 * Fetch one URL and store it, tolerating individual failures so a single
 * missing icon can never abort the whole install step.
 *
 * `fresh` forces the network to be used (needed for HTML, which changes between
 * deployments); hashed build files are already immutable, so the normal HTTP
 * cache may serve them and save bandwidth.
 */
async function precacheInto(cache, url, fresh) {
  try {
    const target = absoluteUrl(url);
    const request = fresh
      ? new Request(target, { cache: "reload", credentials: "same-origin" })
      : new Request(target, { credentials: "same-origin" });
    const response = await fetch(request);
    if (!isCacheableResponse(response)) return false;
    await cache.put(target, response);
    return true;
  } catch (error) {
    return false;
  }
}

/** Collect the `/assets/*` files referenced by a document (src/href attrs). */
function extractAssetReferences(html) {
  const references = new Set();
  const attributePattern = /(?:src|href)="([^"]+)"/g;
  let match = attributePattern.exec(html);
  while (match !== null) {
    const value = match[1];
    if (value && value.startsWith("/assets/")) {
      references.add(value.split("?")[0]);
    }
    match = attributePattern.exec(html);
  }
  return Array.from(references);
}

/** Download a document and return its `/assets/*` references. */
async function collectAssetReferences(documentUrl) {
  try {
    const request = new Request(absoluteUrl(documentUrl), {
      cache: "reload",
      credentials: "same-origin",
    });
    const response = await fetch(request);
    if (!response.ok) return [];
    return extractAssetReferences(await response.text());
  } catch (error) {
    return [];
  }
}

/**
 * Cache the SSR document of every route together with the chunks that route
 * preloads. Returns the union of the asset URLs that were queued.
 *
 * This runs on install and whenever the client asks for a refresh (the client
 * does that once per session, which keeps the offline copies in sync with the
 * deployment that is currently live).
 */
async function precacheRoutes(routes) {
  const [assetCache, pageCache] = await Promise.all([
    caches.open(ASSET_CACHE),
    caches.open(PAGE_CACHE),
  ]);

  const assetUrls = new Set();

  await Promise.all(
    routes.map(async (route) => {
      try {
        const key = absoluteUrl(route);
        const request = new Request(key, { cache: "reload", credentials: "same-origin" });
        const response = await fetch(request);
        if (!isCacheableResponse(response)) return;
        // Clone before reading the body: one copy is stored, one is parsed.
        await pageCache.put(key, response.clone());
        for (const assetUrl of extractAssetReferences(await response.text())) {
          assetUrls.add(assetUrl);
        }
      } catch (error) {
        // A route that fails to download must not break the others.
      }
    }),
  );

  await Promise.all(
    Array.from(assetUrls).map(async (assetUrl) => {
      const stored = await precacheInto(assetCache, assetUrl, false);
      if (stored) {
        try {
          await pruneSupersededAssets(assetCache, new URL(assetUrl, self.location.origin));
        } catch (error) {
          // Pruning is best effort only.
        }
      }
    }),
  );

  await trimCache(PAGE_CACHE, MAX_PAGE_ENTRIES);
  return Array.from(assetUrls);
}

/* ------------------------------------------------------- runtime strategies */

/**
 * Drop cached chunks that are the same logical file with a different hash.
 * Without this the asset cache would keep one copy of every chunk from every
 * deployment forever.
 */
async function pruneSupersededAssets(cache, url) {
  const logicalName = logicalAssetName(url.pathname);
  if (!logicalName) return;
  const keys = await cache.keys();
  await Promise.all(
    keys
      .filter((key) => {
        const keyUrl = new URL(key.url);
        if (keyUrl.pathname === url.pathname) return false;
        return logicalAssetName(keyUrl.pathname) === logicalName;
      })
      .map((key) => cache.delete(key)),
  );
}

/**
 * Cache-first: immutable hashed build output (/assets/*) is answered from the
 * cache immediately and only falls back to the network on a miss.
 */
async function cacheFirst(event, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(event.request);
  if (cached) return cached;

  const response = await fetch(event.request);
  if (isCacheableResponse(response)) {
    const copy = response.clone();
    const requestUrl = new URL(event.request.url);
    event.waitUntil(
      cache
        .put(event.request, copy)
        .then(() => pruneSupersededAssets(cache, requestUrl))
        .catch(() => undefined),
    );
  }
  return response;
}

/**
 * Stale-while-revalidate: serve the cached copy instantly and refresh it in the
 * background. Used for mutable assets (icons, fonts, images) where a fast
 * response matters more than being strictly up to date.
 */
async function staleWhileRevalidate(event, cacheName) {
  const cache = await caches.open(cacheName);
  // Icons and manifest files are precached into the shell cache, so a runtime
  // request must be able to reuse them instead of surfacing a network error.
  const cached = (await cache.match(event.request)) || (await caches.match(event.request));

  const revalidate = fetch(event.request).then(async (response) => {
    if (isCacheableResponse(response)) {
      await cache.put(event.request, response.clone());
      await trimCache(cacheName, MAX_RUNTIME_ENTRIES);
    }
    return response;
  });

  if (cached) {
    // A failed background refresh (offline) must not surface as an unhandled
    // rejection, and must not delay the cached response either.
    event.waitUntil(revalidate.catch(() => undefined));
    return cached;
  }

  try {
    return await revalidate;
  } catch (error) {
    // Nothing cached and no connection: fail gracefully instead of hanging.
    return new Response("", { status: 504, statusText: "Offline" });
  }
}

/**
 * Rebuild the request used for the network leg of a navigation. A request in
 * "navigate" mode cannot be re-issued through fetch(), and "no-cache" keeps the
 * returned HTML fresh.
 */
function buildNetworkRequest(request) {
  try {
    return new Request(request.url, {
      cache: "no-cache",
      credentials: "same-origin",
      headers: request.headers,
      redirect: "follow",
    });
  } catch (error) {
    return request;
  }
}

/** Fetch with a deadline so a dead network cannot stall the UI. */
async function fetchWithTimeout(request, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(buildNetworkRequest(request), { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Consume the navigation-preload response when the browser provided one. */
async function readPreloadResponse(event) {
  if (!event.preloadResponse) return null;
  try {
    return (await event.preloadResponse) || null;
  } catch (error) {
    return null;
  }
}

/**
 * Offline fallback chain: exact cached document, trailing-slash variant, then
 * the cached shell (which boots the SPA and rehydrates from IndexedDB), and
 * finally a standalone offline page.
 */
async function matchCachedPage(pageCache, request) {
  const url = new URL(request.url);
  const candidates = [url.pathname];
  const withoutTrailingSlash = url.pathname.replace(/\/+$/, "");
  if (withoutTrailingSlash !== url.pathname) {
    candidates.push(withoutTrailingSlash);
  }

  for (const candidate of candidates) {
    const match = await pageCache.match(absoluteUrl(candidate));
    if (match) return match;
  }

  const shell =
    (await caches.match(OFFLINE_URL, { cacheName: SHELL_CACHE })) ||
    (await pageCache.match(absoluteUrl(OFFLINE_URL))) ||
    (await caches.match(OFFLINE_URL));
  if (shell) return shell;

  return createOfflineDocument();
}

/**
 * Navigation strategy: network-first with a cache fallback.
 * Successful HTML is stored per route so the exact screen opens offline, while a
 * server error is passed through untouched (an HTTP error is not a connectivity
 * problem, and hiding it would mask broken deployments).
 */
async function handleNavigationRequest(event) {
  const pageCache = await caches.open(PAGE_CACHE);

  let networkResponse = null;
  try {
    networkResponse =
      (await readPreloadResponse(event)) ||
      (await fetchWithTimeout(event.request, NETWORK_TIMEOUT_MS));
  } catch (error) {
    networkResponse = null;
  }

  if (networkResponse) {
    if (!isCacheableResponse(networkResponse)) return networkResponse;
    const copy = networkResponse.clone();
    const key = absoluteUrl(new URL(event.request.url).pathname);
    event.waitUntil(
      pageCache
        .put(key, copy)
        .then(() => trimCache(PAGE_CACHE, MAX_PAGE_ENTRIES))
        .catch(() => undefined),
    );
    return networkResponse;
  }

  return matchCachedPage(pageCache, event.request);
}

/** Minimal, dependency-free document for the "nothing cached yet" case. */
function createOfflineDocument() {
  const html = [
    "<!DOCTYPE html>",
    '<html lang="en"><head><meta charset="utf-8"/>',
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>',
    "<title>Cadence — Offline</title>",
    "<style>",
    ":root{color-scheme:dark}*{box-sizing:border-box}",
    "body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;",
    "background:#090d16;color:#e6e8ee;padding:24px;text-align:center;",
    "font-family:ui-sans-serif,system-ui,'Segoe UI',sans-serif}",
    "h1{font-size:1.25rem;margin:0 0 8px}p{margin:0;color:#9aa3b2;font-size:.9rem;line-height:1.6}",
    "</style></head><body><main>",
    "<h1>Cadence is offline</h1>",
    "<p>Open the app once while connected and it will start instantly from now on — even with no internet.</p>",
    "</main></body></html>",
  ].join("");

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

/* ------------------------------------------------------------------- events */

/**
 * Install: warm every cache before the worker is allowed to activate.
 * The client decides when to switch versions (it posts SKIP_WAITING), so a page
 * that is currently open keeps its own consistent assets for the moment.
 */
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const [shellCache, assetCache] = await Promise.all([
        caches.open(SHELL_CACHE),
        caches.open(ASSET_CACHE),
      ]);

      // 1. Core shell files: the document itself, the manifest and the icons.
      await Promise.all(PRECACHE_URLS.map((url) => precacheInto(shellCache, url, true)));

      // 2. Hashed entry assets referenced by the shell (main bundle + CSS).
      const entryAssets = await collectAssetReferences(OFFLINE_URL);
      await Promise.all(
        entryAssets.map(async (url) => {
          const stored = await precacheInto(assetCache, url, false);
          if (!stored) return;
          try {
            await pruneSupersededAssets(assetCache, new URL(url, self.location.origin));
          } catch (error) {
            // Pruning is best effort only.
          }
        }),
      );

      // 3. Every route: its HTML plus the chunk graph it preloads. This is what
      //    makes deep links work offline without the user having visited them.
      await precacheRoutes(APP_ROUTES);
    })().catch((error) => {
      // A flaky network must never leave the worker stuck in "installing".
      console.warn("[Cadence sw] Install finished with errors", error);
    }),
  );
});

/**
 * Activate: drop the caches of every previous version and start controlling the
 * clients that are already open (the client reloads once so the whole app runs
 * a single version).
 */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(`${CACHE_NAMESPACE}-`) && !ACTIVE_CACHES.includes(key))
          .map((key) => caches.delete(key)),
      );

      // Navigation preload starts the request while the worker boots up, which
      // removes the service-worker startup penalty from the network-first path.
      if (self.registration.navigationPreload) {
        try {
          await self.registration.navigationPreload.enable();
        } catch (error) {
          // Not supported: network-first still works, just without preloading.
        }
      }

      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only GETs are cacheable. Server functions, analytics beacons and form posts
  // go straight through untouched.
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch (error) {
    return;
  }

  // Same-origin only: third-party requests are never intercepted.
  if (url.origin !== self.location.origin) return;
  // The worker script itself is always fetched straight from the network.
  if (url.pathname === "/sw.js") return;
  // Vite dev server / HMR traffic must stay uncached.
  if (isDevServerRequest(url)) return;

  // 1. Documents: network-first, falling back to the cached shell offline.
  if (request.mode === "navigate") {
    event.respondWith(handleNavigationRequest(event));
    return;
  }

  // Range requests (audio / video streaming) are not cacheable as-is.
  if (request.headers.has("range")) return;

  // 2. Static assets.
  if (isStaticAssetRequest(request, url)) {
    event.respondWith(
      isImmutableAsset(url)
        ? cacheFirst(event, ASSET_CACHE)
        : staleWhileRevalidate(event, RUNTIME_CACHE),
    );
  }
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || typeof data !== "object") return;

  // The open page tells us it is ready to move to this version.
  if (data.type === "SKIP_WAITING") {
    void self.skipWaiting();
    return;
  }

  // Optional refresh of the offline documents, used by the client once per
  // session so cached HTML follows the deployment that is currently live.
  if (data.type === "CACHE_ROUTES" && Array.isArray(data.urls)) {
    const urls = data.urls.filter((url) => typeof url === "string" && url.startsWith("/"));
    if (urls.length === 0) return;
    event.waitUntil(precacheRoutes(urls).catch(() => undefined));
  }
});
