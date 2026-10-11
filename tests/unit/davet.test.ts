import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import type { AstroCookies } from "astro";
import { CROCKFORD, davetCereziOku, davetKanali, kisaHash, KOD_UZUNLUK, kodNormalize, kodUret, qrIcerigi, uygulamaIciTarayici } from "@/lib/davet.ts";

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

describe("karşılama çerezi: {course|event}:{hedefId}:{codeId}", () => {
  const cerez = (v: string | null) => ({ get: () => (v ? { value: v } : undefined) }) as unknown as AstroCookies;
  it.each([
    ["course:5:9", 5, "course", 9],
    ["event:5:9", 5, "event", 9],
    ["course:5:9", 5, "event", null], // tür uyuşmazlığı: kurs çerezi etkinlikte atıf üretmez
    ["event:5:9", 5, "course", null],
    ["event:6:9", 5, "event", null], // başka etkinliğin daveti (AC-9)
    ["event:5:9:1", 5, "event", null],
    ["kulup:5:9", 5, "event", null],
    ["", 5, "course", null],
    [null, 5, "event", null],
  ] as const)("%j, hedef %i/%s → kod %j", (deger, hedefId, tur, beklenen) => {
    expect(davetCereziOku(cerez(deger), hedefId, tur)).toBe(beklenen);
  });
  it("tür verilmezse kurs (Faz 2 çağıranları değişmedi)", () => {
    expect(davetCereziOku(cerez("course:5:9"), 5)).toBe(9);
    expect(davetCereziOku(cerez("event:5:9"), 5)).toBeNull();
    expect(davetCereziOku(undefined, 5)).toBeNull();
  });
});

describe("IP/UA takma adı — imzalarla alan ayrımı", () => {
  it("kisaHash saldırganın seçtiği metinle bilet/dönen QR imzasının HMAC'ini üretemez ('h:' öneki)", () => {
    const sir = (process.env.CRON_SECRET ??= "test-sirri");
    const ham = (m: string) => createHmac("sha256", sir).update(m).digest("hex").slice(0, 32);
    for (const metin of ["t:123", "c:5:57812345"]) expect(kisaHash(metin)).not.toBe(ham(metin));
    expect(kisaHash("1.2.3.4")).toBe(ham("h:1.2.3.4"));
    expect(kisaHash("1.2.3.4")).toBe(kisaHash("1.2.3.4")); // hız sınırı sayımı için kararlı
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
