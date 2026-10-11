import { describe, expect, it } from "vitest";
import { belgeGezintisiMi, getIleYazilabilirMi } from "@/lib/urls.ts";

const istek = (basliklar: Record<string, string>) => new Request("https://yusufdeniz.com/x", { headers: basliklar });

describe("davet çerezi yalnız üst düzey belge gezintisinde kurulur", () => {
  it.each([
    [{ "sec-fetch-dest": "document" }, true],
    [{}, true], // başlığı göndermeyen eski tarayıcı (karsilama.ts ile aynı kural)
    [{ "sec-fetch-dest": "image" }, false], // aynı kökenli <img src="…?d=KOD"> atfı çalamaz
    [{ "sec-fetch-dest": "empty" }, false], // fetch / prefetch / ClientRouter
    [{ "sec-fetch-dest": "iframe" }, false],
    [{ "sec-fetch-dest": "script" }, false],
  ])("%j → %s", (basliklar, beklenen) => {
    expect(belgeGezintisiMi(istek(basliklar))).toBe(beklenen);
  });
});

describe("GET ile yazan eski akışın (kurs ?katil=1) freni", () => {
  it.each([
    [{ "sec-fetch-dest": "document", "sec-fetch-site": "none" }, true], // adres çubuğu / uygulamadan açılan bağlantı
    [{ "sec-fetch-dest": "document", "sec-fetch-site": "same-origin" }, true],
    [{ "sec-fetch-dest": "empty", "sec-fetch-site": "same-origin" }, true], // ClientRouter (Clerk dönüşü)
    [{ "sec-fetch-dest": "document", "sec-fetch-site": "same-site" }, true], // accounts.yusufdeniz.com dönüşü
    [{}, true],
    [{ "sec-fetch-dest": "document", "sec-fetch-site": "cross-site" }, false], // başka siteden (GET CSRF)
    [{ "sec-fetch-dest": "image", "sec-fetch-site": "same-origin" }, false], // kurs kapağı / markdown görseli
    [{ "sec-fetch-dest": "iframe", "sec-fetch-site": "same-origin" }, false],
    [{ "sec-fetch-dest": "empty", "sec-fetch-site": "same-origin", "sec-purpose": "prefetch" }, false],
    [{ "sec-fetch-dest": "empty", "sec-fetch-site": "same-origin", "sec-purpose": "prefetch;prerender" }, false],
    [{ "sec-fetch-dest": "empty", purpose: "prefetch" }, false],
    [{ "x-moz": "prefetch" }, false],
  ])("%j → %s", (basliklar, beklenen) => {
    expect(getIleYazilabilirMi(istek(basliklar))).toBe(beklenen);
  });
});
