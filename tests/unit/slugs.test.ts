import { describe, expect, it } from "vitest";
import { slugify } from "@/lib/slugs.ts";

describe("slugify", () => {
  it.each([
    ["Yapay Zekâ ve Eğitim", "yapay-zeka-ve-egitim"],
    ["Işık Hızında Öğrenme", "isik-hizinda-ogrenme"],
    ["Girişimcilik 101", "girisimcilik-101"],
    ["  boşluk   temizliği  ", "bosluk-temizligi"],
    ["ÇĞİÖŞÜ çğıöşü", "cgiosu-cgiosu"],
  ])("%s → %s", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
});
