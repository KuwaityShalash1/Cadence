export type LanguageCode = "en" | "ar" | "es" | "fr" | "de";

export interface LanguageMeta {
  code: LanguageCode;
  name: string;
  nativeName: string;
  flag: string;
  dir: "ltr" | "rtl";
}
