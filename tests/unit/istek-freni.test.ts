import { describe, expect, it } from "vitest";
import { belgeGezintisiMi, kullaniciGezintisiMi } from "@/lib/urls.ts";

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

describe("dönen QR formu yalnız kullanıcının başlattığı gezintide kendiliğinden gönderilir (F4-05)", () => {
  it.each([
    [{ "sec-fetch-site": "none", "sec-fetch-dest": "document" }, true], // kamerayla QR okutma, adres çubuğu
    [{}, true], // başlığı göndermeyen eski tarayıcı
    [{ "sec-fetch-site": "cross-site", "sec-fetch-dest": "document" }, false], // başka sitedeki bağlantı
    [{ "sec-fetch-site": "same-origin", "sec-fetch-dest": "document" }, false], // üye içeriğindeki bağlantı
    [{ "sec-fetch-site": "same-site", "sec-fetch-dest": "document" }, false],
    [{ "sec-fetch-site": "none", "sec-fetch-dest": "iframe" }, false],
    [{ "sec-fetch-site": "same-origin", "sec-fetch-dest": "empty" }, false], // ön-yükleme
  ])("%j → %s", (basliklar, beklenen) => {
    expect(kullaniciGezintisiMi(istek(basliklar))).toBe(beklenen);
  });
});
