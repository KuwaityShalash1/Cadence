import React, { createContext, useContext, useEffect } from "react";
import { useApp } from "@/stores/app-store";
import { dictionaries } from "./dictionaries";
import { LanguageCode, LanguageMeta } from "./types";

export const LANGUAGES: LanguageMeta[] = [
  { code: "en", name: "English", nativeName: "English", flag: "🇺🇸", dir: "ltr" },
  { code: "ar", name: "Arabic", nativeName: "العربية", flag: "🇪🇬", dir: "rtl" },
  { code: "es", name: "Spanish", nativeName: "Español", flag: "🇪🇸", dir: "ltr" },
  { code: "fr", name: "French", nativeName: "Français", flag: "🇫🇷", dir: "ltr" },
  { code: "de", name: "German", nativeName: "Deutsch", flag: "🇩🇪", dir: "ltr" },
];

interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { settings, updateSettings } = useApp();
  const language: LanguageCode = "en";

  useEffect(() => {
    document.documentElement.dir = "ltr";
    document.documentElement.lang = "en";
  }, []);

  const setLanguage = (_lang: LanguageCode) => {
    updateSettings({ language: "en" });
  };

  const t = (key: string, fallback?: string): string => {
    const enDict = dictionaries.en;
    const val = (enDict as Record<string, string>)[key] ?? fallback ?? key;
    return val;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    return {
      language: "en" as LanguageCode,
      setLanguage: () => {},
      t: (key: string, fallback?: string) => fallback ?? key,
    };
  }
  return ctx;
}
