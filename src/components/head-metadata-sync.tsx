import { useEffect } from "react";
import { useLocation } from "@tanstack/react-router";
import { useTranslation } from "@/i18n/context";

function setOrUpdateMeta(attribute: "name" | "property", key: string, content: string) {
  if (typeof document === "undefined") return;
  let el = document.querySelector(`meta[${attribute}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attribute, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setOrUpdateLink(rel: string, href: string, attributes: Record<string, string> = {}) {
  if (typeof document === "undefined") return;
  let el = document.querySelector(`link[rel="${rel}"][href="${href}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    el.setAttribute("href", href);
    for (const [k, v] of Object.entries(attributes)) {
      el.setAttribute(k, v);
    }
    document.head.appendChild(el);
  }
}

/**
 * HeadMetadataSync ensures document-level metadata (<title>, <meta description>,
 * OpenGraph, Twitter cards, and <html> lang/dir attributes) reactively and
 * dynamically adapt whenever the active language or route changes.
 */
export function HeadMetadataSync() {
  const { t, language, isRtl } = useTranslation();
  const location = useLocation();

  useEffect(() => {
    // 1. Maintain root <html lang="..."> and <html dir="..."> alignment
    const html = document.documentElement;
    html.lang = language;
    html.dir = isRtl ? "rtl" : "ltr";

    // 2. Select route-specific localized title and description
    const path = location.pathname;
    const isRoot = path === "/" || path === "";

    let titleKey = "seo.defaultTitle";
    let descKey = "seo.defaultDesc";

    if (isRoot) {
      titleKey = "seo.defaultTitle";
      descKey = "seo.defaultDesc";
    } else if (path.startsWith("/calendar")) {
      titleKey = "seo.calendarTitle";
      descKey = "seo.calendarDesc";
    } else if (path.startsWith("/stats")) {
      titleKey = "seo.analyticsTitle";
      descKey = "seo.analyticsDesc";
    } else if (path.startsWith("/goals")) {
      titleKey = "seo.goalsTitle";
      descKey = "seo.goalsDesc";
    } else if (path.startsWith("/routines")) {
      titleKey = "seo.routinesTitle";
      descKey = "seo.routinesDesc";
    } else if (path.startsWith("/quit-tracker")) {
      titleKey = "seo.quitTrackerTitle";
      descKey = "seo.quitTrackerDesc";
    } else if (path.startsWith("/settings")) {
      titleKey = "seo.settingsTitle";
      descKey = "seo.settingsDesc";
    } else if (path.startsWith("/about-us") || path.startsWith("/about")) {
      titleKey = "seo.aboutTitle";
      descKey = "seo.aboutDesc";
    } else if (path.startsWith("/dashboard")) {
      titleKey = "seo.dashboardTitle";
      descKey = "seo.dashboardDesc";
    } else if (path.startsWith("/auth")) {
      titleKey = "seo.authTitle";
      descKey = "seo.authDesc";
    }

    const title = t(titleKey, "Cadence | Minimalist Habit Tracker");
    const description = t(
      descKey,
      "Cadence is an offline-first, minimalist habit tracker designed to help you build routines, track goals, and stay consistent effortlessly.",
    );
    const ogDescription = isRoot
      ? t(
          "seo.ogDesc",
          "Track your habits and build routines with this offline-first minimalist app.",
        )
      : description;

    // 3. Update document title
    document.title = title;

    // 4. Update standard search description and keywords
    setOrUpdateMeta("name", "description", description);
    setOrUpdateMeta(
      "name",
      "keywords",
      "Cadence, habit tracker, offline habit tracker, متتبع عادات, تتبع العادات, بناء الروتين, إدارة الأهداف, تطبيق إنتاجية, بدون إنترنت",
    );

    // 5. Update OpenGraph tags
    setOrUpdateMeta("property", "og:title", title);
    setOrUpdateMeta("property", "og:description", ogDescription);
    setOrUpdateMeta("property", "og:type", "website");
    setOrUpdateMeta("property", "og:image", "/og-image.png");
    setOrUpdateMeta("property", "og:locale", language === "ar" ? "ar_AR" : "en_US");
    setOrUpdateMeta("property", "og:locale:alternate", language === "ar" ? "en_US" : "ar_AR");

    // 6. Update Twitter Card tags
    setOrUpdateMeta("name", "twitter:card", "summary_large_image");
    setOrUpdateMeta("name", "twitter:title", title);
    setOrUpdateMeta("name", "twitter:description", ogDescription);
    setOrUpdateMeta("name", "twitter:image", "/og-image.png");

    // 7. Ensure favicon and app icon links
    setOrUpdateLink("icon", "/favicon.ico");
    setOrUpdateLink("icon", "/logo192.png", { type: "image/png", sizes: "192x192" });
    setOrUpdateLink("apple-touch-icon", "/apple-touch-icon.png");
  }, [t, language, isRtl, location.pathname]);

  return null;
}
