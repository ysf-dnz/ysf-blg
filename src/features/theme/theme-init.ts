/**
 * No-flash tema başlatıcı — Base.astro'da is:inline olarak gömülür.
 * localStorage "ysf:theme" ∈ light|dark|system; system → matchMedia çözümü.
 * Bu dosya kaynak referansı içindir; asıl gömülü script Base.astro'dadır.
 */
export type ThemePref = "light" | "dark" | "system";

export const THEME_KEY = "ysf:theme";

export function resolveTheme(pref: ThemePref, prefersDark: boolean): "light" | "dark" {
  if (pref === "system") return prefersDark ? "dark" : "light";
  return pref;
}

export function nextTheme(current: ThemePref): ThemePref {
  const order: ThemePref[] = ["light", "dark", "system"];
  return order[(order.indexOf(current) + 1) % order.length]!;
}
