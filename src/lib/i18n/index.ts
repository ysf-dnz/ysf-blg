import { tr, type UiKey } from "./tr.ts";
import { en } from "./en.ts";

export type Lang = "tr" | "en";
export type { UiKey };

const dicts: Record<Lang, Record<UiKey, string>> = { tr, en };

/** Verilen dil için çeviri fonksiyonu döndürür. */
export function useTranslations(lang: Lang) {
  return (key: UiKey): string => dicts[lang][key];
}

/** URL path'inden dili çözer: /en/... → en, aksi halde tr. */
export function langFromUrl(pathname: string): Lang {
  return pathname === "/en" || pathname.startsWith("/en/") ? "en" : "tr";
}

/**
 * Dile göre yerel path üretir. TR prefix'siz, EN /en prefix'li.
 * localizePath("/yazilar", "en") → "/en/yazilar"
 */
export function localizePath(path: string, lang: Lang): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (lang === "tr") return clean;
  return clean === "/" ? "/en" : `/en${clean}`;
}
