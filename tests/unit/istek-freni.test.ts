import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { belgeGezintisiMi, guvenliYol, kullaniciGezintisiMi, yolaParametreEkle } from "@/lib/urls.ts";

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

describe("GET durum değiştirmez — bekçi (her koşumda; e2e kanıtı yalnız seed sonrası ilk koşumda anlamlı)", () => {
  // Bu sayfalar yazan fonksiyonu İÇE AKTARMAMALI (yazım yalnız POST uçlarında); pano bildirimleri güncellememeli
  // Frontmatter'ın kod kısmı (yorumlar atılır): çok satırlı import ve doğrudan çağrı da yakalanır
  const iceAktarimlar = (dosya: string) =>
    (readFileSync(dosya, "utf8").split(/^---$/m)[1] ?? "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  it.each([
    ["src/pages/c/q/[etkinlik]/[token].astro", /\b(donenGiris|kayitOl|girisYap|biletGiris)\b/],
    ["src/pages/uye/mesajlar/[kisi].astro", /\b(okunduYaz|mesajGonder|engelle|engelKaldir)\b/],
    ["src/pages/uye/mesajlar/index.astro", /\b(okunduYaz|mesajGonder)\b/],
  ])("%s", (dosya, yasak) => {
    expect(iceAktarimlar(dosya)).toMatch(/from "@\/lib\//); // dosya okundu ve içe aktarımlar bulundu
    expect(iceAktarimlar(dosya)).not.toMatch(yasak);
  });
  it("src/pages/uye/index.astro bildirimleri GET'te okundu yazmaz", () => {
    expect(readFileSync("src/pages/uye/index.astro", "utf8")).not.toMatch(/update\(\s*schema\.notifications\s*\)/);
  });
});

describe("dönüş adresine bayrak eklemek site dışına çıkaramaz (açık yönlendirme)", () => {
  it.each([
    ["/topluluk", "/topluluk?hata=hiz"],
    ["/kurslar/x?b=1#soru-cevap", "/kurslar/x?b=1&hata=hiz#soru-cevap"],
    ["/topluluk#g-5", "/topluluk?hata=hiz#g-5"],
    // Nokta-segmentli yol YENİDEN YAZILMAZ: URL ile ayrıştırıp pathname basmak bunları //kotu.example yapardı
    ["/.//kotu.example", "/.//kotu.example?hata=hiz"],
    ["/..//kotu.example/a", "/..//kotu.example/a?hata=hiz"],
    ["/%2e%2e//kotu.example", "/%2e%2e//kotu.example?hata=hiz"],
  ])("%s → %s", (yol, beklenen) => {
    const sonuc = yolaParametreEkle(yol, "hata", "hiz");
    expect(sonuc).toBe(beklenen);
    expect(sonuc).toMatch(/^\/(?![\/\\])/); // tek eğik çizgiyle başlar: tarayıcıda site içinde kalır
    expect(new URL(sonuc, "https://yusufdeniz.com").host).toBe("yusufdeniz.com");
  });
  it("guvenliYol çift eğik çizgi ve ters eğik çizgiyle başlayanı zaten reddeder", () => {
    const form = (next: string) => {
      const f = new FormData();
      f.set("next", next);
      return f;
    };
    for (const kotu of ["//kotu.example", "/\\kotu.example", "https://kotu.example", "kotu"]) expect(guvenliYol(form(kotu), "/x")).toBe("/x");
    expect(guvenliYol(form("/kurslar/a?b=1#c"), "/x")).toBe("/kurslar/a?b=1#c");
  });
});

