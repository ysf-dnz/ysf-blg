import { describe, expect, it } from "vitest";
import { tr } from "@/lib/i18n/tr.ts";
import { en } from "@/lib/i18n/en.ts";
import { langFromUrl, localizePath, useTranslations } from "@/lib/i18n/index.ts";

describe("i18n sözlükleri", () => {
  it("tr ve en anahtarları birebir simetrik", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(tr).sort());
  });

  it("hiçbir çeviri boş değil", () => {
    for (const dict of [tr, en]) {
      for (const [key, value] of Object.entries(dict)) {
        expect(value, `${key} boş`).not.toBe("");
      }
    }
  });
});

describe("langFromUrl", () => {
  it.each([
    ["/", "tr"],
    ["/yazilar", "tr"],
    ["/en", "en"],
    ["/en/yazilar", "en"],
    ["/english-degil", "tr"],
  ])("%s → %s", (path, expected) => {
    expect(langFromUrl(path)).toBe(expected);
  });
});

describe("localizePath", () => {
  it("tr için prefix eklemez", () => {
    expect(localizePath("/yazilar", "tr")).toBe("/yazilar");
  });
  it("en için /en prefix'i ekler", () => {
    expect(localizePath("/yazilar", "en")).toBe("/en/yazilar");
    expect(localizePath("/", "en")).toBe("/en");
  });
});

describe("useTranslations", () => {
  it("dile göre doğru sözlükten okur", () => {
    expect(useTranslations("tr")("nav.yazilar")).toBe("Yazılar");
    expect(useTranslations("en")("nav.yazilar")).toBe("Posts");
  });
});
