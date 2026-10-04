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
    let titleKey = "seo.todayTitle";
    let descKey = "seo.todayDesc";

    const path = location.pathname;
    if (path.startsWith("/calendar")) {
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
    }

    const title = t(titleKey, t("seo.defaultTitle"));
    const description = t(descKey, t("seo.defaultDesc"));

    // 3. Update document title
    document.title = title;

    // 4. Update standard search description
    setOrUpdateMeta("name", "description", description);

    // 5. Update OpenGraph tags
    setOrUpdateMeta("property", "og:title", title);
    setOrUpdateMeta("property", "og:description", description);
    setOrUpdateMeta("property", "og:locale", language === "ar" ? "ar_SA" : "en_US");

    // 6. Update Twitter Card tags
    setOrUpdateMeta("name", "twitter:title", title);
    setOrUpdateMeta("name", "twitter:description", description);
  }, [t, language, isRtl, location.pathname]);

  return null;
}
