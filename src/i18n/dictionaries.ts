import { LanguageCode } from "./types";
import { en } from "./locales/en";
import { ar } from "./locales/ar";
import { es } from "./locales/es";
import { fr } from "./locales/fr";
import { de } from "./locales/de";

export const dictionaries: Record<LanguageCode, Record<string, string>> = {
  en,
  ar,
  es,
  fr,
  de,
};
