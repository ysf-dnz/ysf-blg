export const CATEGORIES = [
  "ai",
  "yazilim",
  "girisimcilik",
  "egitim",
  "kisisel",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const KAYNAK_TURLERI = [
  "notebooklm",
  "kitap",
  "makale",
  "video",
] as const;

export type KaynakTuru = (typeof KAYNAK_TURLERI)[number];
