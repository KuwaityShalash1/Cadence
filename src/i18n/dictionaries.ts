import { LanguageCode } from "./types";
import { en } from "./locales/en";
import { ar } from "./locales/ar";

export const dictionaries: Record<LanguageCode, Record<string, string>> = {
  en,
  ar,
};
