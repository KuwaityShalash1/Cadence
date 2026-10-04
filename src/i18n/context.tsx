import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { dictionaries } from "./dictionaries";
import { LanguageCode, LanguageMeta } from "./types";

// ─── Language metadata ────────────────────────────────────────────────────────

export const LANGUAGES: LanguageMeta[] = [
  { code: "en", name: "English",  nativeName: "English",   flag: "🇺🇸", dir: "ltr" },
  { code: "ar", name: "Arabic",   nativeName: "العربية",   flag: "🇸🇦", dir: "rtl" },
];

// ─── localStorage persistence key ─────────────────────────────────────────────

const STORAGE_KEY = "cadence_language";

// Arabic font Google Fonts preconnect + stylesheet link id (injected once)
const ARABIC_FONT_LINK_ID = "cadence-arabic-font";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStoredLanguage(): LanguageCode {
  if (typeof window === "undefined") return "en";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && LANGUAGES.some((l) => l.code === stored)) {
      return stored as LanguageCode;
    }
  } catch {
    // localStorage may be unavailable in restricted contexts — fall through.
  }
  return "en";
}

/**
 * Inject the Cairo Arabic web font stylesheet the first time Arabic is
 * activated. We inject lazily rather than in the static document head so
 * English-only users never download the font file.
 */
function injectArabicFont() {
  if (document.getElementById(ARABIC_FONT_LINK_ID)) return;

  // Preconnect hints let the browser warm up the connection immediately.
  const preconnect1 = document.createElement("link");
  preconnect1.rel = "preconnect";
  preconnect1.href = "https://fonts.googleapis.com";
  document.head.appendChild(preconnect1);

  const preconnect2 = document.createElement("link");
  preconnect2.rel = "preconnect";
  preconnect2.href = "https://fonts.gstatic.com";
  preconnect2.crossOrigin = "anonymous";
  document.head.appendChild(preconnect2);

  // Cairo: a premium, highly readable Arabic typeface optimised for UI.
  const link = document.createElement("link");
  link.id = ARABIC_FONT_LINK_ID;
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800&display=swap";
  document.head.appendChild(link);
}

/**
 * Apply the language to the HTML element — sets `dir`, `lang`, and the font
 * class. This is the single source of truth for document-level language state.
 */
function applyLanguageToDocument(lang: LanguageCode) {
  const meta = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0]!;
  const html = document.documentElement;

  html.lang = lang;
  html.dir = meta.dir;

  if (lang === "ar") {
    injectArabicFont();
    html.classList.add("font-arabic");
  } else {
    html.classList.remove("font-arabic");
  }
}

// ─── Context shape ─────────────────────────────────────────────────────────────

export type TranslationParams = Record<string, string | number | undefined | null>;

function interpolate(text: string, params?: TranslationParams): string {
  if (!params) return text;
  return Object.entries(params).reduce((acc, [k, v]) => {
    return acc.replace(new RegExp(`\\{${k}\\}`, "g"), v !== undefined && v !== null ? String(v) : "");
  }, text);
}

interface LanguageContextType {
  /** Currently active language code (e.g. "en", "ar"). */
  language: LanguageCode;
  /** Switch the UI language and persist the choice in localStorage. */
  setLanguage: (lang: LanguageCode) => void;
  /**
   * Translate a dot-notation key. Supports optional fallback text and parameter
   * interpolation: e.g. `t("key", { name: "Cadence" })` or `t("key", "Default {name}", { name: "Cadence" })`.
   */
  t: (
    key: string,
    fallbackOrParams?: string | TranslationParams,
    params?: TranslationParams,
  ) => string;
  /** `true` when the active language is RTL (Arabic, Hebrew, etc.). */
  isRtl: boolean;
}

// ─── Context + provider ────────────────────────────────────────────────────────

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Read the persisted preference synchronously so the first render already
  // uses the correct language — avoids a visible flicker on reload.
  const [language, setLanguageState] = useState<LanguageCode>(getStoredLanguage);
  const isRtl = LANGUAGES.find((l) => l.code === language)?.dir === "rtl";

  // Apply the language to the document on mount and whenever it changes.
  useEffect(() => {
    applyLanguageToDocument(language);
  }, [language]);

  const setLanguage = useCallback((lang: LanguageCode) => {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Best-effort persistence.
    }
    setLanguageState(lang);
  }, []);

  const t = useCallback(
    (
      key: string,
      fallbackOrParams?: string | TranslationParams,
      params?: TranslationParams,
    ): string => {
      let fallback: string | undefined;
      let actualParams: TranslationParams | undefined;

      if (typeof fallbackOrParams === "object" && fallbackOrParams !== null) {
        actualParams = fallbackOrParams;
      } else {
        fallback = fallbackOrParams;
        actualParams = params;
      }

      const dict = dictionaries[language] as Record<string, string> | undefined;
      const raw =
        dict?.[key] ??
        (dictionaries.en as Record<string, string>)[key] ??
        fallback ??
        key;

      return interpolate(raw, actualParams);
    },
    [language],
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isRtl }}>
      {children}
    </LanguageContext.Provider>
  );
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useTranslation(): LanguageContextType {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    // Outside the provider tree — return safe no-op defaults so components
    // that call the hook never crash during SSR or isolated unit tests.
    return {
      language: "en",
      setLanguage: () => {},
      t: (
        key: string,
        fallbackOrParams?: string | TranslationParams,
        params?: TranslationParams,
      ) => {
        let fallback: string | undefined;
        let actualParams: TranslationParams | undefined;
        if (typeof fallbackOrParams === "object" && fallbackOrParams !== null) {
          actualParams = fallbackOrParams;
        } else {
          fallback = fallbackOrParams;
          actualParams = params;
        }
        return interpolate(fallback ?? key, actualParams);
      },
      isRtl: false,
    };
  }
  return ctx;
}
