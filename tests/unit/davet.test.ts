import { describe, expect, it } from "vitest";
import { CROCKFORD, davetKanali, KOD_UZUNLUK, kodNormalize, kodUret, qrIcerigi, uygulamaIciTarayici } from "@/lib/davet.ts";

describe("davet kodu — Crockford Base32", () => {
  it("alfabe I, L, O, U içermez; 32 karakter", () => {
    expect(CROCKFORD).toHaveLength(32);
    for (const c of "ILOU") expect(CROCKFORD).not.toContain(c);
  });
  it("üretilen kod 7 karakter ve alfabeden", () => {
    for (let i = 0; i < 50; i++) {
      const k = kodUret();
      expect(k).toHaveLength(KOD_UZUNLUK);
      for (const c of k) expect(CROCKFORD).toContain(c);
    }
  });
  it.each([
    ["7KQ2MXA", "7KQ2MXA"],
    ["7kq2mxa", "7KQ2MXA"], // AC-12: küçük harf
    ["7KQ2MXA ", "7KQ2MXA"],
    ["7KQ-2MXA", "7KQ2MXA"],
    ["OKQ2MXA", "0KQ2MXA"], // O → 0
    ["IKQ2MXA", "1KQ2MXA"], // I → 1
    ["lKQ2MXA", "1KQ2MXA"], // l → 1
    ["7KQ2MX", null], // kısa
    ["7KQ2MXAB", null], // uzun
    ["7KQ2MXU", null], // U alfabede yok
    ["", null],
  ])("normalize %j → %j", (girdi, beklenen) => {
    expect(kodNormalize(girdi)).toBe(beklenen);
  });
  it("QR içeriği tamamen büyük harf, /D/ yolu", () => {
    expect(qrIcerigi("https://yusufdeniz.com", "7KQ2MXA")).toBe("HTTPS://YUSUFDENIZ.COM/D/7KQ2MXA");
  });
  // Canlıda /d/kod da /d/q/'ya iner (Vercel harf duyarsız) → kanal kodun yazımından
  it.each([
    ["DEM07KQ", "qr"],
    ["dem07kq", "link"],
    ["Dem07kq", "link"],
    ["1234567", "qr"],
    ["", "qr"],
  ] as const)("kanal %j → %s", (ham, kanal) => {
    expect(davetKanali(ham)).toBe(kanal);
  });
});

describe("uygulama içi tarayıcı algılama", () => {
  it.each([
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Instagram 300.0", true],
    ["Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 [FB_IAB/FB4A;FBAV/450.0;]", true],
    ["Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36", false],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15", false],
    [null, false],
  ])("%s → %s", (ua, beklenen) => {
    expect(uygulamaIciTarayici(ua)).toBe(beklenen);
  });
});
